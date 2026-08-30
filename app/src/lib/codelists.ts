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

export interface CodelistItem {
  key: string
  label?: string
  description?: string
}

export interface Codelist {
  closed: boolean
  polozky: CodelistItem[]
}

type Surovy = { closed?: boolean; items?: { key: string; label?: string; description?: string }[] }

function priprav(c: unknown): Codelist {
  const s = c as Surovy
  // `closed` chýbajúce znamená uzavretý — prísnejšia predvoľba je správna:
  // nový číselník bez rozhodnutia nemá potichu prijímať čokoľvek.
  return { closed: s.closed !== false, polozky: s.items ?? [] }
}

export const CODELISTS: Record<string, Codelist> = {
  accessLevel: priprav(accessLevel),
  category: priprav(category),
  companyCode: priprav(companyCode),
  language: priprav(jazyk),
  scope: priprav(scope),
  sectionKey: priprav(sectionKey),
  sourceType: priprav(sourceType),
  tags: priprav(tags),
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

export class CodelistError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CiselnikError"
  }
}

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
export function codelistFor(nazov: string, doplnky?: CodelistExtras): Codelist {
  const zaklad = CODELISTS[nazov]
  if (!zaklad) return { closed: true, polozky: [] }
  const vlastne = doplnky?.[nazov] ?? []
  const uz = new Set(zaklad.polozky.map(p => p.key))
  return {
    closed: zaklad.closed,
    polozky: [...zaklad.polozky, ...vlastne.filter(p => !uz.has(p.key))],
  }
}

/** Overí jednu hodnotu proti číselníku. Vracia normalizovaný kľúč. */
export function checkValue(ciselnik: string, hodnota: string, doplnky?: CodelistExtras): string {
  const c = codelistFor(ciselnik, doplnky)
  const v = (hodnota ?? "").trim()
  if (!v) throw new CodelistError(`Chýba hodnota pre ${ciselnik}.`)
  if (!CODELISTS[ciselnik]) throw new CodelistError(`Číselník ${ciselnik} neexistuje.`)

  if (c.polozky.some(p => p.key === v)) return v

  if (c.closed) {
    throw new CodelistError(
      `„${v}" nie je platná hodnota pre ${ciselnik}. Povolené: ${c.polozky.map(p => p.key).join(", ")}.`,
    )
  }
  if (!KEY_PATTERN.test(v)) {
    throw new CodelistError(
      `„${v}" sa nedá použiť ako kľúč pre ${ciselnik}. Malé písmená bez diakritiky, číslice ` +
      "a podčiarkovník — kľúč ide do identifikátora dokumentu a do adries.",
    )
  }
  return v
}

/** Overí zoznam (tagy). Prázdny zoznam je v poriadku. */
export function checkList(ciselnik: string, hodnoty: string[], doplnky?: CodelistExtras): string[] {
  const out: string[] = []
  for (const h of hodnoty) {
    const v = (h ?? "").trim()
    if (!v) continue
    out.push(checkValue(ciselnik, v, doplnky))
  }
  return [...new Set(out)]
}

/** Voľby do výberu na obrazovke. */
export function codelistOptions(ciselnik: string, doplnky?: CodelistExtras): { hodnota: string; popis: string }[] {
  return codelistFor(ciselnik, doplnky).polozky.map(p => ({
    hodnota: p.key,
    popis: p.label ? `${p.label} (${p.key})` : p.key,
  }))
}

/**
 * Overí položku, ktorú organizácia pridáva do vlastného číselníka.
 *
 * Kľúč sa **nedá vziať späť**: otaguje sa ním obsah a zostane v `documents`
 * aj v `document_chunks`. Preto ten istý úzky tvar ako všade inde.
 */
export function checkCustomItem(kluc: string, popis: string): CodelistItem {
  const k = (kluc ?? "").trim().toLowerCase()
  if (!KEY_PATTERN.test(k)) {
    throw new CodelistError(
      `„${kluc}" sa nedá použiť ako kľúč. Malé písmená bez diakritiky, číslice ` +
      "a podčiarkovník — kľúčom sa označuje obsah a zostane v ňom natrvalo.",
    )
  }
  const l = (popis ?? "").trim()
  return l ? { key: k, label: l } : { key: k }
}
