/**
 * libraryConditions.ts — podmienky query buildera.
 *
 * Facety odpovedajú na „ktoré z týchto", podmienky na „všetko, čo spĺňa".
 * Sú to dve rôzne otázky a preto dva nástroje: facet sa klikne, podmienka
 * sa zostaví.
 *
 * **Podmienky žijú v adrese**, rovnako ako facety — opakovaný kľúč `cond`,
 * jedna podmienka na jeden. Vďaka tomu sa zostavený dotaz dá poslať odkazom
 * a builder nepotrebuje ani riadok JavaScriptu: pridanie aj odobranie riadka
 * je odoslanie formulára.
 *
 * ## Prečo sa nemieša A a ALEBO
 *
 * Prototyp má spojku pri každom riadku zvlášť. Lenže `A alebo B a C` nemá bez
 * zátvoriek jednoznačný význam — a builder, ktorý si význam domyslí sám,
 * vracia potichu iné výsledky, než si človek myslí. Namiesto toho je **jeden
 * režim pre celý dotaz**: spĺňa *všetky* podmienky, alebo *ktorúkoľvek*.
 * Zátvorky sú samostatná úloha a bez nich je toto jediný poctivý tvar.
 */

import type { RawQuery } from "./urlParams"

/** Polia, podľa ktorých sa dá pýtať. Uzavretý zoznam — hodnota ide z adresy. */
export const CONDITION_FIELDS = ["title", "category", "status", "tag", "accessLevel", "updatedAt"] as const
export type ConditionField = (typeof CONDITION_FIELDS)[number]

export const CONDITION_OPS = ["is", "not", "contains", "before", "after"] as const
export type ConditionOp = (typeof CONDITION_OPS)[number]

export type MatchMode = "all" | "any"

export interface Condition {
  field: ConditionField
  op: ConditionOp
  value: string
}

/**
 * Ktoré operátory dávajú pri ktorom poli zmysel.
 *
 * „Obsahuje" pri číselníku je pasca: hodnoty sú kľúče (`metodicky_pokyn`),
 * ale človek by hľadal podľa toho, čo vidí na obrazovke. „Pred/po" pri texte
 * je nezmysel rovnako.
 */
export const OPS_FOR_FIELD: Record<ConditionField, readonly ConditionOp[]> = {
  title: ["contains", "is", "not"],
  category: ["is", "not"],
  status: ["is", "not"],
  tag: ["is", "not"],
  accessLevel: ["is", "not"],
  updatedAt: ["before", "after"],
}

function isField(v: string): v is ConditionField {
  return (CONDITION_FIELDS as readonly string[]).includes(v)
}

/**
 * Jedna podmienka v adrese: `pole~operátor~hodnota`.
 *
 * Hodnota sa kóduje, ale **`encodeURIComponent` vlnovku nechá tak** — je medzi
 * znakmi, ktoré považuje za bezpečné. Preto sa nedelí na kúsky: odrežú sa
 * prvé dva oddeľovače a zvyšok je hodnota, nech je v nej čokoľvek. S naivným
 * `split("~")` by sa názov s vlnovkou ticho zahodil ako pokazená podmienka.
 */
export function encodeCondition(c: Condition): string {
  return `${c.field}~${c.op}~${encodeURIComponent(c.value)}`
}

export function decodeCondition(raw: string): Condition | null {
  const first = raw.indexOf("~")
  const second = raw.indexOf("~", first + 1)
  if (first < 0 || second < 0) return null
  const field = raw.slice(0, first)
  const op = raw.slice(first + 1, second)
  const value = raw.slice(second + 1)
  if (!isField(field)) return null
  if (!(OPS_FOR_FIELD[field] as readonly string[]).includes(op)) return null
  let decoded = ""
  try {
    decoded = decodeURIComponent(value)
  } catch {
    // Pokazené kódovanie z ručne upravenej adresy nemá zhodiť stránku.
    return null
  }
  if (!decoded.trim()) return null
  return { field, op: op as ConditionOp, value: decoded.trim() }
}

export function readConditions(q: RawQuery): Condition[] {
  const raw = Array.isArray(q.cond) ? q.cond : q.cond === undefined ? [] : [q.cond]
  return raw.map(decodeCondition).filter((c): c is Condition => c !== null)
}

export function readMatch(q: RawQuery): MatchMode {
  const v = Array.isArray(q.match) ? q.match[0] : q.match
  return v === "any" ? "any" : "all"
}

/** Podmienky ako polia adresy. Predvolený režim „všetky" sa nezapisuje. */
export function conditionFields(conds: Condition[], match: MatchMode): [string, string][] {
  const out: [string, string][] = conds.map(c => ["cond", encodeCondition(c)])
  if (match === "any" && conds.length > 1) out.push(["match", "any"])
  return out
}

/** Názov poľa v databáze. Štítok je pole, preto `tags`. */
const FIELD_PATH: Record<ConditionField, string> = {
  title: "title",
  category: "category",
  status: "status",
  tag: "tags",
  accessLevel: "accessLevel",
  updatedAt: "updatedAt",
}

function one(c: Condition): Record<string, unknown> | null {
  const path = FIELD_PATH[c.field]

  if (c.field === "updatedAt") {
    const at = new Date(c.value)
    // Neplatný dátum z adresy sa zahodí. `$lt: Invalid Date` by nevrátilo nič
    // a vyzeralo by to, že v knižnici nie je nič.
    if (Number.isNaN(at.getTime())) return null
    return { [path]: c.op === "before" ? { $lt: at } : { $gt: at } }
  }

  if (c.op === "contains") {
    // Vstup od človeka ide do regulárneho výrazu — bez escapovania by `(`
    // zhodilo dotaz a `.*` prehľadalo všetko.
    const safe = c.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return { [path]: { $regex: safe, $options: "i" } }
  }

  // `$ne` chytí aj dokumenty, ktoré to pole nemajú vôbec — a to je správne:
  // dokument bez druhu naozaj „nie je norma".
  if (c.op === "not") return { [path]: { $ne: c.value } }
  return { [path]: c.value }
}

/**
 * Podmienka do dotazu na Mongo.
 *
 * `null`, keď nie je čo pridať — prázdny `$and` alebo `$or` by dotaz zhodil.
 */
export function conditionQuery(
  conds: Condition[],
  match: MatchMode,
): Record<string, unknown> | null {
  const parts = conds.map(one).filter((p): p is Record<string, unknown> => p !== null)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return match === "any" ? { $or: parts } : { $and: parts }
}

/**
 * Náhľad dotazu vetou. Je to kontrola, že človek a systém rozumejú tomu
 * istému — preto sa skladá z uložených podmienok, nie z rozpísaného
 * formulára.
 */
export function describeConditions(
  conds: Condition[],
  match: MatchMode,
  label: (field: ConditionField) => string,
  opLabel: (op: ConditionOp) => string,
  join: (match: MatchMode) => string,
): string {
  if (conds.length === 0) return ""
  return conds
    .map(c => `${label(c.field)} ${opLabel(c.op)} „${c.value}"`)
    .join(` ${join(match)} `)
}
