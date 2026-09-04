/**
 * ciselniky.ts — číselníky pre obrazovku, nie len pre skript (D53).
 *
 * Doteraz ich čítal `scripts/lib/meta.mjs` zo súborového systému. Vo funkcii
 * na Verceli sa na súborový systém spoliehať nedá, a hlavne — obrazovka
 * a skript musia validovať **rovnako**. Dve kópie pravidla, čo je platná
 * hodnota `sectionKey`, by znamenali, že to, čo prejde importom, obrazovka
 * odmietne (alebo horšie, naopak).
 *
 * `closed: true` znamená **uzavretý slovník**: čo tam nie je, neprejde
 * (`CISELNIKY_governance.md`). Otvorený číselník novú hodnotu prijme — ale
 * nie hocijakú: musí vyzerať ako kľúč, nie ako veta.
 */

import accessLevel from "@/codelists/accessLevel.json"
import category from "@/codelists/category.json"
import companyCode from "@/codelists/companyCode.json"
import jazyk from "@/codelists/language.json"
import scope from "@/codelists/scope.json"
import sectionKey from "@/codelists/sectionKey.json"
import sourceType from "@/codelists/sourceType.json"
import tags from "@/codelists/tags.json"
import { AppError } from "./appError"

export interface CodelistItem {
  key: string
  label?: string
  description?: string
}

export interface Codelist {
  closed: boolean
  items: CodelistItem[]
}

type RawCodelist = { closed?: boolean; items?: { key: string; label?: string; description?: string }[] }

function prepare(c: unknown): Codelist {
  const s = c as RawCodelist
  // `closed` chýbajúce znamená uzavretý — prísnejšia predvoľba je správna:
  // nový číselník bez rozhodnutia nemá potichu prijímať čokoľvek.
  return { closed: s.closed !== false, items: s.items ?? [] }
}

export const CODELISTS: Record<string, Codelist> = {
  accessLevel: prepare(accessLevel),
  category: prepare(category),
  companyCode: prepare(companyCode),
  language: prepare(jazyk),
  scope: prepare(scope),
  sectionKey: prepare(sectionKey),
  sourceType: prepare(sourceType),
  tags: prepare(tags),
}

/** Povinné metadáta dokumentu — zhodné s `scripts/lib/meta.mjs`. */
export const REQUIRED_CODELISTS = ["title", "sectionKey", "companyCode", "scope", "accessLevel", "language"] as const

/**
 * Tvar nového kľúča v otvorenom číselníku.
 *
 * Malé písmená, číslice a podčiarkovník. Je to zámerne úzke: kľúč ide do
 * `documentId` (`sfz:sutazny_poriadok`) a ten sa objaví v adresách, v logoch
 * a v exportoch. Diakritika a medzery by tam robili neplechu roky.
 */
export const KEY_PATTERN = /^[a-z0-9][a-z0-9_]{1,60}$/

export class CodelistError extends AppError {}

/**
 * Číselníky, ktoré si organizácia spravuje sama (D55).
 *
 * Len tie, ktoré popisujú **jej obsah**: aké druhy dokumentov má a akými
 * značkami ich triedi. `scope`, `accessLevel` a `language` zostávajú
 * globálne a uzavreté — sú to filtre, na ktorých stojí prístup k obsahu,
 * a keby si ich zákazník rozšíril, vznikla by hodnota, ktorej nikde inde
 * v systéme nikto nerozumie.
 */
export const CUSTOM_CODELISTS = ["category", "tags"] as const
export type CustomCodelist = (typeof CUSTOM_CODELISTS)[number]

/** Položky, ktoré si k číselníku dopísala organizácia. */
export type CodelistExtras = Partial<Record<string, CodelistItem[]>>

/**
 * Číselník aj s tým, čo si k nemu organizácia pridala.
 *
 * Globálne položky sa **neprepisujú ani neskrývajú**: sú v nich hodnoty,
 * ktorými sú už otagované existujúce dokumenty, a zmiznutie kľúča z ponuky
 * by z nich spravilo neplatné údaje.
 */
export function codelistFor(name: string, extras?: CodelistExtras): Codelist {
  const base = CODELISTS[name]
  if (!base) return { closed: true, items: [] }
  const custom = extras?.[name] ?? []
  const seen = new Set(base.items.map(p => p.key))
  return {
    closed: base.closed,
    items: [...base.items, ...custom.filter(p => !seen.has(p.key))],
  }
}

/** Overí jednu hodnotu proti číselníku. Vracia normalizovaný kľúč. */
export function checkValue(codelist: string, value: string, extras?: CodelistExtras): string {
  const c = codelistFor(codelist, extras)
  const v = (value ?? "").trim()
  if (!v) throw new CodelistError("codelist.valueMissing", `Chýba hodnota pre ${codelist}.`, { codelist })
  if (!CODELISTS[codelist]) throw new CodelistError("codelist.unknown", `Číselník ${codelist} neexistuje.`, { codelist })

  if (c.items.some(p => p.key === v)) return v

  if (c.closed) {
    throw new CodelistError(
      "codelist.notAllowed",
      `„${v}" nie je platná hodnota pre ${codelist}. Povolené: ${c.items.map(p => p.key).join(", ")}.`,
      { value: v, codelist, allowed: c.items.map(p => p.key).join(", ") },
    )
  }
  if (!KEY_PATTERN.test(v)) {
    throw new CodelistError(
      "codelist.badKeyFor",
      `„${v}" sa nedá použiť ako kľúč pre ${codelist}. Malé písmená bez diakritiky, číslice ` +
      "a podčiarkovník — kľúč ide do identifikátora dokumentu a do adries.",
      { value: v, codelist },
    )
  }
  return v
}

/** Overí zoznam (tagy). Prázdny zoznam je v poriadku. */
export function checkList(codelist: string, values: string[], extras?: CodelistExtras): string[] {
  const out: string[] = []
  for (const h of values) {
    const v = (h ?? "").trim()
    if (!v) continue
    out.push(checkValue(codelist, v, extras))
  }
  return [...new Set(out)]
}

/** Voľby do výberu na obrazovke. */
export function codelistOptions(codelist: string, extras?: CodelistExtras): { value: string; label: string }[] {
  return codelistFor(codelist, extras).items.map(p => ({
    value: p.key,
    label: p.label ? `${p.label} (${p.key})` : p.key,
  }))
}

/**
 * Overí položku, ktorú organizácia pridáva do vlastného číselníka.
 *
 * Kľúč sa **nedá vziať späť**: otaguje sa ním obsah a zostane v `documents`
 * aj v `document_chunks`. Preto ten istý úzky tvar ako všade inde.
 */
export function checkCustomItem(key: string, label: string): CodelistItem {
  const k = (key ?? "").trim().toLowerCase()
  if (!KEY_PATTERN.test(k)) {
    throw new CodelistError(
      "codelist.badKey",
      `„${key}" sa nedá použiť ako kľúč. Malé písmená bez diakritiky, číslice ` +
      "a podčiarkovník — kľúčom sa označuje obsah a zostane v ňom natrvalo.",
      { key },
    )
  }
  const l = (label ?? "").trim()
  return l ? { key: k, label: l } : { key: k }
}
