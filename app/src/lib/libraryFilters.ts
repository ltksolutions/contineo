/**
 * libraryFilters.ts — filtre knižnice ako hodnota, nie ako reťazec v adrese.
 *
 * **Adresa je zdroj pravdy.** Pohľad na knižnicu sa dá poslať odkazom, otvoriť
 * zo záložky a funguje bez JavaScriptu — to je vlastnosť, ktorú stránka už
 * dnes má (`normalizeQuery` + `withFilter`) a ktorú nový panel filtrov nesmie
 * stratiť. Preto sa filtre neukladajú do stavu komponentu: prečítajú sa
 * z adresy, prepnú sa čistou funkciou a zapíšu sa späť do adresy.
 *
 * **Facety sú viachodnotové.** „Norma alebo smernica" je bežná otázka
 * a jednohodnotový filter na ňu odpovedať nevie. V adrese je to opakovaný
 * kľúč (`?category=norma&category=smernica`), teda presne to, čo prehliadač
 * pošle z formulára s viacerými zaškrtnutými políčkami — nie vlastný formát
 * s čiarkami, ktorý by nikto iný neprečítal.
 *
 * Priečinok zostáva jednohodnotový zámerne: je to strom, v ktorom sa človek
 * nachádza, nie vlastnosť dokumentu — a filtruje sa cestou vrátane podstromu.
 */

import type { RawQuery } from "./urlParams"

/** Facety, ktoré sa dajú vybrať viackrát. */
export const MULTI_KEYS = ["category", "status", "tag", "accessLevel", "language"] as const
export type MultiKey = (typeof MULTI_KEYS)[number]

export interface ActiveFilters {
  /** Fulltext v názve, identifikátore a kľúči sekcie. */
  search?: string
  /** Priečinok vrátane podpriečinkov, alebo `nezaradene`. */
  folder?: string
  category: string[]
  status: string[]
  tag: string[]
  accessLevel: string[]
  language: string[]
  /**
   * Nie filtre, ale nesú sa spolu s nimi — inak by prvý klik na facet
   * prepol navigáciu späť na predvolený variant a pohľad na predvolený.
   */
  layout?: string
  view?: string
}

const EMPTY: ActiveFilters = {
  category: [], status: [], tag: [], accessLevel: [], language: [],
}

/** Jedna hodnota z adresy. Pole (opakovaný kľúč) → prvá hodnota. */
function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  const trimmed = v?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Zoznam hodnôt z adresy. Prijíma opakovaný kľúč aj jednu hodnotu — starý
 * odkaz s `?category=norma` musí ďalej fungovať.
 *
 * Rozdeľuje **aj podľa čiarky**, a to kvôli ceste bez JavaScriptu: `MultiSelect`
 * má v `<noscript>` obyčajné textové pole s hodnotami oddelenými čiarkou
 * (rovnako ako `TagSelect`), a bez tohto rozdelenia by z troch značiek vznikla
 * jedna nezmyselná. Kľúče číselníkov čiarku obsahovať nemôžu (`KEY_PATTERN`),
 * takže sa tým nič platné nerozseká.
 */
export function list(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value : value === undefined ? [] : [value]
  return [...new Set(raw.flatMap(v => v.split(",")).map(v => v.trim()).filter(Boolean))]
}

export function readFilters(q: RawQuery): ActiveFilters {
  return {
    search: one(q.search),
    folder: one(q.folder),
    category: list(q.category),
    status: list(q.status),
    tag: list(q.tag),
    accessLevel: list(q.accessLevel),
    language: list(q.language),
    layout: one(q.layout),
    view: one(q.view),
  }
}

/** Prepne jednu hodnotu facetu. Vybraná zmizne, nevybraná pribudne. */
export function toggle(filters: ActiveFilters, key: MultiKey, value: string): ActiveFilters {
  const has = filters[key].includes(value)
  return {
    ...filters,
    [key]: has ? filters[key].filter(v => v !== value) : [...filters[key], value],
  }
}

/** Nahradí celý zoznam hodnôt facetu — pre viacnásobný výber. */
export function replace(filters: ActiveFilters, key: MultiKey, values: string[]): ActiveFilters {
  return { ...filters, [key]: [...new Set(values.filter(Boolean))] }
}

export function setValue(
  filters: ActiveFilters,
  key: "search" | "folder" | "layout" | "view",
  value: string | undefined,
): ActiveFilters {
  return { ...filters, [key]: value?.trim() ? value.trim() : undefined }
}

/**
 * Zruší filtre, **nie zobrazenie**. Variant navigácie a pohľad človek
 * nastavoval zvlášť a tlačidlom „Zrušiť" ich zrušiť nechcel.
 */
export function clearFilters(filters: ActiveFilters): ActiveFilters {
  return { ...EMPTY, layout: filters.layout, view: filters.view }
}

export function isEmpty(filters: ActiveFilters): boolean {
  return !filters.search && !filters.folder &&
    MULTI_KEYS.every(k => filters[k].length === 0)
}

/**
 * Späť do adresy. Poradie kľúčov je pevné, aby sa tá istá voľba filtrov
 * vždy zapísala rovnako — inak by dva odkazy na ten istý pohľad vyzerali
 * ako dva rôzne a neposadli by na seba v histórii prehliadača.
 */
export function toQuery(filters: ActiveFilters, base = "/library"): string {
  const p = new URLSearchParams(carryFields(filters))
  const s = p.toString()
  return s ? `${base}?${s}` : base
}

/**
 * Filtre ako polia formulára — jedna dvojica na jednu hodnotu.
 *
 * Viachodnotový facet je **opakovaný kľúč**, takže sa nedá poslať objektom
 * (`Object.fromEntries` by z troch značiek nechal jednu). Používa sa aj na
 * skryté polia vo formulároch, ktoré musia zachovať pohľad po odoslaní.
 */
export function carryFields(filters: ActiveFilters): [string, string][] {
  const out: [string, string][] = []
  if (filters.search) out.push(["search", filters.search])
  if (filters.folder) out.push(["folder", filters.folder])
  for (const key of MULTI_KEYS) {
    for (const v of filters[key]) out.push([key, v])
  }
  if (filters.layout) out.push(["layout", filters.layout])
  if (filters.view) out.push(["view", filters.view])
  return out
}

/** Aktívne filtre ako chips — v poradí, v akom sa zapisujú do adresy. */
export function activeChips(filters: ActiveFilters): { key: MultiKey; value: string }[] {
  return MULTI_KEYS.flatMap(key => filters[key].map(value => ({ key, value })))
}
