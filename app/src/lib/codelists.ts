/**
 * codelists.ts — číselníky pre obrazovku, nie len pre skript (D53).
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
import workplace from "@/codelists/workplace.json"
import { AppError } from "./appError"

/**
 * Úloha dokumentu — vlastnosť **druhu** (ADR-034, D215).
 *
 *   • `binding`  — záväzný (zákon, stanovy, poriadok, smernica): mení ho len
 *     orgán novým schváleným znením; v kontrole súladu je len referenciou a
 *     analýza helpdesku k nemu nenavrhuje text, len podnet pre legislatívu;
 *   • `guidance` — výkladový (manuál, návod, metodický pokyn): mení ho správca
 *     obsahu; kontroluje sa proti záväzným a analýza helpdesku doň navrhuje
 *     doplnenia;
 *   • `record`   — záznam (zápisnica, zmluva, tlačivo): nemení sa a nekontroluje.
 */
export type DocumentRole = "binding" | "guidance" | "record"
export const DOCUMENT_ROLES: readonly DocumentRole[] = ["binding", "guidance", "record"]

export interface CodelistItem {
  key: string
  label?: string
  description?: string
  /** Len pri `category` (ADR-034). */
  role?: DocumentRole
  /** Poradie záväznosti pri `category` — menšie číslo je vyššie (zákon 0). */
  rank?: number
  isActive?: boolean
}

export interface Codelist {
  closed: boolean
  items: CodelistItem[]
}

type RawCodelist = { closed?: boolean; items?: CodelistItem[] }

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
  workplace: prepare(workplace),
}

/**
 * Úloha druhu dokumentu (ADR-034, D215). Vlastný druh organizácie ju nesie,
 * keď ju pri ňom správca vybral; inak a pri neznámom druhu je **výkladový** —
 * dokument bez určenej úlohy sa smie kontrolovať, ale nemá byť meradlom pre
 * iné (záväznosť sa neprisudzuje potichu).
 */
export function documentRole(category: string | null | undefined, extras?: CodelistExtras): DocumentRole {
  if (!category) return "guidance"
  const item = codelistFor("category", extras).items.find(p => p.key === category)
  return item?.role ?? "guidance"
}

/** Záväzný druh bez čísla (vlastný druh organizácie) sa radí za smernicu. */
const CUSTOM_BINDING_RANK = 4
/** Výkladový a neznámy druh — za všetky záväzné. */
const GUIDANCE_RANK = 10

/**
 * Poradie záväznosti druhu — menšie číslo je vyššie (ADR-034, D216). Slúži na
 * zoradenie referencií v kontrole súladu a ako predvoľba, kým dokument nemá
 * miesto v hierarchii dokumentov.
 */
export function categoryRank(category: string | null | undefined, extras?: CodelistExtras): number {
  const item = category ? codelistFor("category", extras).items.find(p => p.key === category) : undefined
  if (typeof item?.rank === "number") return item.rank
  return item?.role === "binding" ? CUSTOM_BINDING_RANK : GUIDANCE_RANK
}

/** Povinné metadáta dokumentu — zhodné s `scripts/lib/meta.mjs`. */
// `sectionKey` od ADR-010 nie je povinný — zaradenie zlúčil Druh. Migrácia
// 2026-09-22 (O21 krok 2) ho odstránila **aj z dát**, takže dnes ho nenesie
// žiadny dokument. Číselník zostáva kôli importom, ktoré ho ešte posielajú:
// keď hodnota príde, overuje sa ako doteraz, a keď nepríde, nikoľvek ju
// nedoplní.
export const REQUIRED_CODELISTS = ["title", "companyCode", "scope", "accessLevel", "language"] as const

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
 * Sú to tie, ktoré popisujú **jej vlastné pomery**: aké druhy dokumentov má,
 * akými značkami ich triedi a kde jej ľudia pracujú. `scope`, `accessLevel`
 * a `language` zostávajú globálne a uzavreté — sú to filtre, na ktorých stojí
 * prístup k obsahu, a keby si ich zákazník rozšíril, vznikla by hodnota,
 * ktorej nikde inde v systéme nikto nerozumie.
 *
 * `workplace` (D85) je prvý z nich, ktorý popisuje **ľudí, nie obsah**.
 * Preto `codelistUsage()` musí vedieť, nad ktorou kolekciou daný číselník
 * žije — počítať pracoviská nad `documents` by vždy vrátilo nulu a personalista
 * by odoberal položku, o ktorej mu systém tvrdí, že ju nikto nemá.
 */
export const CUSTOM_CODELISTS = ["category", "tags", "workplace"] as const
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
    // Čistý popisok, bez kľúča v zátvorke. „Norma (norma)" vo facetoch aj
    // formulároch bol pozostatok ladenia — kľúč je adresa pre stroj a tam,
    // kde ho správca potrebuje vidieť, sa ukazuje zvlášť (nastavenie
    // číselníkov), nie prilepený ku každému popisku (vzor, PR 7).
    label: p.label ?? p.key,
  }))
}

/**
 * Overí položku, ktorú organizácia pridáva do vlastného číselníka.
 *
 * Kľúč sa **nedá vziať späť**: otaguje sa ním obsah a zostane v `documents`
 * aj v `document_chunks`. Preto ten istý úzky tvar ako všade inde.
 */
export function checkCustomItem(key: string, label: string, role?: string): CodelistItem {
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
  // Úloha druhu (ADR-034) — len známa hodnota; bez nej je druh výkladový.
  const r = DOCUMENT_ROLES.find(x => x === role)
  return { key: k, ...(l ? { label: l } : {}), ...(r ? { role: r } : {}) }
}
