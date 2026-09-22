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
 * ## Zátvorky sú skupiny, nie znaky
 *
 * `A alebo B a C` nemá bez zátvoriek jednoznačný význam a builder, ktorý si
 * význam domyslí sám, vracia potichu iné výsledky, než si človek myslí.
 * Namiesto písania zátvoriek preto podmienky **patria do skupín**: vnútri
 * skupiny platí A, medzi skupinami ALEBO. Teda `(A a B) alebo (C a D)` —
 * disjunktná normálna forma.
 *
 * Prečo práve tento tvar a nie ľubovoľné zanorenie: do DNF sa dá previesť
 * každý booleovský výraz, takže sa tým nič nestráca, a rozhranie zostáva
 * dvojúrovňové — teda opísateľné jednou vetou a **ovládateľné bez
 * JavaScriptu**, na čom celá knižnica zámerne stojí. Strom ľubovoľnej hĺbky
 * by si vyžiadal klientsky stav a s ním by prestala fungovať bez skriptu.
 *
 * **Staré adresy fungujú ďalej.** Podmienka bez skupiny sa vykladá podľa
 * `match`: `all` znamená jedna skupina so všetkým, `any` znamená každá
 * podmienka vo vlastnej skupine. Sú to presne tie dva krajné prípady, ktoré
 * builder mal predtým, takže odkaz spred tejto zmeny vracia to isté.
 */

import type { RawQuery } from "./urlParams"

/** Polia, podľa ktorých sa dá pýtať. Uzavretý zoznam — hodnota ide z adresy. */
export const CONDITION_FIELDS = ["title", "category", "status", "tag", "accessLevel", "updatedAt", "effectiveTo"] as const
export type ConditionField = (typeof CONDITION_FIELDS)[number]

export const CONDITION_OPS = ["is", "not", "contains", "before", "after"] as const
export type ConditionOp = (typeof CONDITION_OPS)[number]

export type MatchMode = "all" | "any"

export interface Condition {
  field: ConditionField
  op: ConditionOp
  value: string
  /**
   * Do ktorej skupiny podmienka patrí. Vnútri skupiny A, medzi skupinami
   * ALEBO.
   *
   * `undefined` znamená „adresa to nepovedala" — starý odkaz. Vyplní ho
   * `normalizeGroups()` podľa `match`, nie tento typ: kód, ktorý si default
   * domyslí na desiatich miestach, sa na jednom z nich raz domyslí inak.
   */
  group?: number
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
  effectiveTo: ["before", "after"],
}

/**
 * Hodnota `today` — **token, nie dátum**.
 *
 * `MASTER.md` hovorí, že zoznam expirovaných sa dostane podmienkou
 * „Platné do · pred · dnes". Keby sa do adresy zapísal dnešný dátum, odkaz
 * poslaný kolegovi by o týždeň znamenal minulý týždeň — a ukázal by iné
 * dokumenty než tomu, kto ho poslal. Token sa vyhodnocuje až pri dotaze.
 *
 * Kľúč je anglický, lebo je to strojová hodnota v adrese, rovnako ako
 * `published` alebo `in-review`. Na obrazovke z neho `i18n` spraví „dnes".
 */
export const TODAY = "today"

/** Slová, ktoré človek napíše, keď myslí dnešok. Vstup je voľné pole. */
const TODAY_WORDS = new Set(["dnes", "dneska", "today", "heute"])

/**
 * Dátumová hodnota podmienky.
 *
 * `null` znamená „nedá sa použiť" — neplatný dátum z adresy sa **zahodí**.
 * `$lt: Invalid Date` by nevrátilo nič a vyzeralo by to, že v knižnici nič
 * nie je.
 */
export function resolveDateValue(value: string, asOf: Date = new Date()): Date | null {
  if (value === TODAY) return asOf
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at
}

/** Napísané „dnes" sa uloží ako token, nie ako dnešný dátum. */
export function normalizeDateValue(value: string): string {
  return TODAY_WORDS.has(value.trim().toLowerCase()) ? TODAY : value
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
  // Skupina je **predpona**, nie štvrtá časť: hodnota môže obsahovať čokoľvek
  // vrátane vlnovky, takže čokoľvek za hodnotou by sa nedalo odlíšiť od nej.
  const prefix = c.group === undefined ? "" : `g${c.group}~`
  return `${prefix}${c.field}~${c.op}~${encodeURIComponent(c.value)}`
}

/** `g3~` na začiatku. Bez nej je to podmienka zo staršieho odkazu. */
const GROUP_PREFIX = /^g(\d{1,2})~/

export function decodeCondition(raw: string): Condition | null {
  let rest = raw
  let group: number | undefined
  const m = GROUP_PREFIX.exec(raw)
  if (m) {
    group = Number(m[1])
    rest = raw.slice(m[0].length)
  }

  const first = rest.indexOf("~")
  const second = rest.indexOf("~", first + 1)
  if (first < 0 || second < 0) return null
  const field = rest.slice(0, first)
  const op = rest.slice(first + 1, second)
  const value = rest.slice(second + 1)
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

  /*
   * Napísané „dnes" sa uloží ako token `today`, nie ako dnešný dátum.
   *
   * Hodnota je voľné pole a človek do neho slovo napíše — v troch jazykoch
   * rozhrania trochu inak. Prevod je tu, na jedinom vstupe podmienok, aby
   * sa odtiaľ ďalej niesol už len token. Inak by odkaz poslaný dnes
   * znamenal zajtra stále dnešok.
   */
  const je_datum = field === "updatedAt" || field === "effectiveTo"
  const hodnota = je_datum ? normalizeDateValue(decoded.trim()) : decoded.trim()

  return {
    field,
    op: op as ConditionOp,
    value: hodnota,
    ...(group === undefined ? {} : { group }),
  }
}

export function readConditions(q: RawQuery): Condition[] {
  const raw = Array.isArray(q.cond) ? q.cond : q.cond === undefined ? [] : [q.cond]
  return raw.map(decodeCondition).filter((c): c is Condition => c !== null)
}

export function readMatch(q: RawQuery): MatchMode {
  const v = Array.isArray(q.match) ? q.match[0] : q.match
  return v === "any" ? "any" : "all"
}

/**
 * Doplní chýbajúce skupiny a prečísluje ich na 0, 1, 2… bez dier.
 *
 * Dve veci naraz, lebo obe musia platiť súčasne: **starý odkaz** nesie
 * podmienky bez skupiny a vykladá sa podľa `match`, a **odobranie riadka**
 * môže po sebe nechať prázdnu skupinu. Diera v číslovaní by sama dotaz
 * nepokazila (prázdna skupina sa zahodí), ale odkazy „ALEBO odtiaľto"
 * počítajú s tým, že číslo skupiny je jej poradie — a s dierou by presúvali
 * riadok inam, než na čo človek klikol.
 */
export function normalizeGroups(conds: Condition[], match: MatchMode = "all"): Condition[] {
  const withGroups = conds.map((c, i) => ({
    ...c,
    // Bez skupiny: `all` je jedna skupina so všetkým, `any` je každá
    // podmienka sama — presne tie dva krajné prípady, ktoré builder mal
    // predtým, takže starý odkaz vracia to isté.
    group: c.group ?? (match === "any" ? i : 0),
  }))

  const order = [...new Set(withGroups.map(c => c.group))].sort((a, b) => a - b)
  const renumbered = new Map(order.map((g, i) => [g, i]))
  return withGroups.map(c => ({ ...c, group: renumbered.get(c.group)! }))
}

/** Podmienky po skupinách, v poradí skupín. Prázdne skupiny nevznikajú. */
export function groupsOf(conds: Condition[], match: MatchMode = "all"): Condition[][] {
  const rows = normalizeGroups(conds, match)
  const out: Condition[][] = []
  for (const c of rows) {
    const g = c.group!
    if (!out[g]) out[g] = []
    out[g].push(c)
  }
  return out.filter(g => g && g.length > 0)
}

/**
 * Od tohto riadka začne nová skupina — teda „ALEBO odtiaľto".
 *
 * Riadky **za** ním sa posunú s ním, nie len on sám: keby zostali v starej
 * skupine, vznikol by z jedného kliknutia dotaz s inou logikou na dvoch
 * miestach, než na aké človek klikol.
 */
export function splitAt(conds: Condition[], index: number, match: MatchMode = "all"): Condition[] {
  const rows = normalizeGroups(conds, match)
  if (index <= 0 || index >= rows.length) return rows
  const from = rows[index].group!
  if (rows[index - 1].group! !== from) return rows
  return normalizeGroups(
    rows.map((c, i) => (i >= index && c.group === from ? { ...c, group: from + 0.5 } : c)),
  )
}

/**
 * Tento riadok patrí k predchádzajúcej skupine — teda „A namiesto ALEBO".
 *
 * Presúva sa **len ten riadok**, na ktorý sa klikne. Tu to je správne: spojka
 * pred riadkom je vec toho riadka, na rozdiel od rozdelenia, ktoré je vecou
 * celého zvyšku skupiny.
 */
export function mergeUp(conds: Condition[], index: number, match: MatchMode = "all"): Condition[] {
  const rows = normalizeGroups(conds, match)
  if (index <= 0 || index >= rows.length) return rows
  const previous = rows[index - 1].group!
  if (rows[index].group === previous) return rows
  return normalizeGroups(rows.map((c, i) => (i === index ? { ...c, group: previous } : c)))
}

/** Je tento riadok prvý vo svojej skupine? Pred ním teda stojí ALEBO. */
export function startsGroup(conds: Condition[], index: number, match: MatchMode = "all"): boolean {
  const rows = normalizeGroups(conds, match)
  if (index <= 0) return true
  return rows[index].group !== rows[index - 1].group
}

/**
 * Podmienky ako polia adresy.
 *
 * Skupina sa píše vždy, aj keď je jediná: bez nej by sa podmienka po
 * nasledujúcom čítaní vyložila podľa `match`, teda podľa hodnoty, ktorú už
 * nový builder nepoužíva. `match` sa preto do adresy nezapisuje vôbec —
 * zostáva len na čítanie starých odkazov.
 */
export function conditionFields(conds: Condition[], match: MatchMode = "all"): [string, string][] {
  return normalizeGroups(conds, match).map(c => ["cond", encodeCondition(c)])
}

/** Názov poľa v databáze. Štítok je pole, preto `tags`. */
const FIELD_PATH: Record<ConditionField, string> = {
  title: "title",
  category: "category",
  status: "status",
  tag: "tags",
  accessLevel: "accessLevel",
  updatedAt: "updatedAt",
  // Platnosť nie je pole dokumentu — počíta sa zo znení. Cesta je tu len
  // preto, aby bol záznam úplný; `one()` si to pole berie zvlášť.
  effectiveTo: "versions.effectiveTo",
}

/**
 * „Platné do" — **o platnosti dokumentu, nie o jednom znení**.
 *
 * `effectiveTo` je v schéme na znení, nie na dokumente, a dokument ich má
 * viac. Naivné `versions.effectiveTo < X` by zobralo aj dokument, ktorý má
 * staré zrušené znenie **a zároveň dnes platné** — a ten neexpiroval.
 *
 * Preto sa pýtame na platnosť dokumentu k dátumu:
 *
 * - **pred X** — k dátumu X dokument **nemá platné znenie**, hoci aspoň
 *   jedno už mal. To je presne `expiredCondition()` z `libraryRead.ts`
 *   bez podmienky na `status`; stav je vlastný filter a dva filtre sa tu
 *   miešať nemajú. Vďaka tomu dá „Platné do pred dnes" ten istý zoznam ako
 *   dnešný facet `expired` — na tom stojí preklad starých odkazov.
 *
 * - **po X** — dokument má k dátumu X platné znenie a jeho platnosť
 *   **je ohraničená** a končí po X. Odpovedá na „čo mi expiruje neskôr",
 *   nie „čo ešte platí": znenie bez konca platnosti sa sem neráta, lebo
 *   žiadne „platné do" nemá.
 */
function validityCondition(op: ConditionOp, at: Date): Record<string, unknown> {
  const eStillValid = {
    effectiveFrom: { $lte: at },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gt: at } }],
  }

  if (op === "before") {
    return { "versions.0": { $exists: true }, versions: { $not: { $elemMatch: eStillValid } } }
  }

  return {
    versions: {
      $elemMatch: { effectiveFrom: { $lte: at }, effectiveTo: { $gt: at } },
    },
  }
}

function one(c: Condition, asOf: Date = new Date()): Record<string, unknown> | null {
  const path = FIELD_PATH[c.field]

  if (c.field === "effectiveTo") {
    const at = resolveDateValue(c.value, asOf)
    if (!at) return null
    return validityCondition(c.op, at)
  }

  if (c.field === "updatedAt") {
    const at = resolveDateValue(c.value, asOf)
    // Neplatný dátum z adresy sa zahodí. `$lt: Invalid Date` by nevrátilo nič
    // a vyzeralo by to, že v knižnici nie je nič.
    if (!at) return null
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
  match: MatchMode = "all",
  /** Čo znamená „dnes". Parameter, nie `new Date()` vnútri — inak sa to
      nedá otestovať inak než čakaním do zajtra. */
  asOf: Date = new Date(),
): Record<string, unknown> | null {
  // Skupina → `$and`, medzi skupinami `$or`. Podmienka, ktorú sa nepodarilo
  // preložiť (napríklad neplatný dátum z adresy), zo skupiny vypadne; keď
  // tým skupina zostane prázdna, zahodí sa celá — prázdny `$and` by dotaz
  // zhodil a prázdny `$or` by nevrátil nič.
  const groups = groupsOf(conds, match)
    .map(g => g.map(c => one(c, asOf)).filter((p): p is Record<string, unknown> => p !== null))
    .filter(g => g.length > 0)
    .map(g => (g.length === 1 ? g[0] : { $and: g }))

  if (groups.length === 0) return null
  if (groups.length === 1) return groups[0]
  return { $or: groups }
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
  const groups = groupsOf(conds, match)
  if (groups.length === 0) return ""

  const and = join("all")
  const or = join("any")
  const one = (c: Condition) => `${label(c.field)} ${opLabel(c.op)} „${c.value}"`

  // Zátvorky sa píšu, **len keď sú skupiny aspoň dve**. Pri jedinej skupine
  // by boli ozdoba, ktorá vetu predlžuje a nič nerozlišuje — a náhľad má byť
  // kontrola, či človek a systém rozumejú tomu istému, nie zápis syntaxe.
  const wrap = groups.length > 1
  return groups
    .map(g => {
      const inner = g.map(one).join(` ${and} `)
      return wrap && g.length > 1 ? `(${inner})` : inner
    })
    .join(` ${or} `)
}
