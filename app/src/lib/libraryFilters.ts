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

/**
 * Stĺpce, podľa ktorých sa dá triediť.
 *
 * Uzavretý zoznam zámerne: hodnota ide z adresy, teda od kohokoľvek, a keby
 * sa použila priamo ako názov poľa, dala by sa ňou vypýtať vec, ktorá do
 * zoznamu nepatrí.
 */
export const SORT_KEYS = ["title", "category", "status", "updatedAt"] as const
export type SortKey = (typeof SORT_KEYS)[number]
export type SortDir = "asc" | "desc"

/** Najnovšie hore — v knižnici sa najčastejšie hľadá to, čo sa práve zmenilo. */
export const DEFAULT_SORT: SortKey = "updatedAt"
export const DEFAULT_DIR: SortDir = "desc"

/**
 * Predvolený smer pri prvom kliknutí na hlavičku.
 *
 * Pri texte je to A→Z, pri dátume najnovšie hore. Jednotný smer pre všetko by
 * znamenal, že prvý klik na „Zmenené" ukáže najstaršie dokumenty — čo nikto
 * nechce a každý to musí opraviť druhým klikom.
 */
export function defaultDirFor(key: SortKey): SortDir {
  return key === "updatedAt" ? "desc" : "asc"
}

/** Koľko riadkov na stranu. */
export const PAGE_SIZE = 25

/**
 * Pohľad na zoznam.
 *
 * Tabuľka je predvolená, lebo v knižnici sa dokumenty porovnávajú. Karty sú
 * pre prezeranie — na telefóne a vtedy, keď človek nevie, čo hľadá, a listuje.
 */
export type View = "table" | "cards"

export function normalizeView(value: string | string[] | undefined): View {
  return one(value) === "cards" ? "cards" : "table"
}

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
  view?: View
  /** Triedenie a strana. Tiež v adrese, aby sa dal poslať aj zoradený pohľad. */
  sort?: SortKey
  dir?: SortDir
  page?: number
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

/** Neznáme triedenie sa zahodí, nie použije — hodnota ide z adresy. */
export function normalizeSort(value: string | string[] | undefined): SortKey | undefined {
  const v = one(value)
  return (SORT_KEYS as readonly string[]).includes(v ?? "") ? (v as SortKey) : undefined
}

export function normalizeDir(value: string | string[] | undefined): SortDir | undefined {
  const v = one(value)
  return v === "asc" || v === "desc" ? v : undefined
}

/** Strana je vždy aspoň prvá. Nezmysel v adrese nemá stránku zhodiť. */
export function normalizePage(value: string | string[] | undefined): number | undefined {
  const n = Number.parseInt(one(value) ?? "", 10)
  return Number.isFinite(n) && n > 1 ? n : undefined
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
    // Predvolený pohľad sa nedrží ako hodnota — `undefined` znamená tabuľka
    // a do adresy sa nezapíše. Inak by každý odkaz niesol `view=table`.
    view: normalizeView(q.view) === "cards" ? "cards" : undefined,
    sort: normalizeSort(q.sort),
    dir: normalizeDir(q.dir),
    page: normalizePage(q.page),
  }
}

/**
 * Zmena výberu vracia na prvú stranu.
 *
 * Bez toho by človek po zúžení filtra skončil na piatej strane zoznamu, ktorý
 * má strany dve — teda na prázdnej obrazovke, ktorá vyzerá ako „nič sa
 * nenašlo". Triedenie stranu nemení: rovnaký zoznam, iné poradie.
 */
function firstPage(filters: ActiveFilters): ActiveFilters {
  return { ...filters, page: undefined }
}

/** Prepne jednu hodnotu facetu. Vybraná zmizne, nevybraná pribudne. */
export function toggle(filters: ActiveFilters, key: MultiKey, value: string): ActiveFilters {
  const has = filters[key].includes(value)
  return firstPage({
    ...filters,
    [key]: has ? filters[key].filter(v => v !== value) : [...filters[key], value],
  })
}

/** Nahradí celý zoznam hodnôt facetu — pre viacnásobný výber. */
export function replace(filters: ActiveFilters, key: MultiKey, values: string[]): ActiveFilters {
  return firstPage({ ...filters, [key]: [...new Set(values.filter(Boolean))] })
}

export function setValue(
  filters: ActiveFilters,
  key: "search" | "folder" | "layout",
  value: string | undefined,
): ActiveFilters {
  const next = { ...filters, [key]: value?.trim() ? value.trim() : undefined }
  // Variant navigácie nie je filter, ten stranu nemení.
  return key === "layout" ? next : firstPage(next)
}

/**
 * Prepnutie pohľadu. Stranu ani filtre nemení — je to tá istá množina
 * dokumentov, len inak nakreslená.
 */
export function setView(filters: ActiveFilters, view: View): ActiveFilters {
  return { ...filters, view: view === "cards" ? "cards" : undefined }
}

export function currentView(filters: ActiveFilters): View {
  return filters.view === "cards" ? "cards" : "table"
}

/**
 * Klik na hlavičku stĺpca. Ten istý stĺpec obráti smer, iný začne svojím
 * predvoleným — a vždy sa ide na prvú stranu, lebo poradie sa mení celé.
 */
export function sortBy(filters: ActiveFilters, key: SortKey): ActiveFilters {
  const active = (filters.sort ?? DEFAULT_SORT) === key
  const dir: SortDir = active
    ? (filters.dir ?? defaultDirFor(key)) === "asc" ? "desc" : "asc"
    : defaultDirFor(key)
  return firstPage({ ...filters, sort: key, dir })
}

/** Ako je zoznam zoradený teraz — s predvolenými hodnotami doplnenými. */
export function currentSort(filters: ActiveFilters): { key: SortKey; dir: SortDir } {
  const key = filters.sort ?? DEFAULT_SORT
  return { key, dir: filters.dir ?? defaultDirFor(key) }
}

export function pageOf(filters: ActiveFilters): number {
  return filters.page && filters.page > 1 ? filters.page : 1
}

export function withPage(filters: ActiveFilters, page: number): ActiveFilters {
  return { ...filters, page: page > 1 ? page : undefined }
}

/**
 * Zruší filtre, **nie zobrazenie**. Variant navigácie a pohľad človek
 * nastavoval zvlášť a tlačidlom „Zrušiť" ich zrušiť nechcel.
 */
export function clearFilters(filters: ActiveFilters): ActiveFilters {
  return { ...EMPTY, layout: filters.layout, view: filters.view, sort: filters.sort, dir: filters.dir }
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
  // Predvolené triedenie sa do adresy nepíše — inak by odkaz na nefiltrovaný
  // zoznam vyzeral zakaždým inak podľa toho, odkiaľ vznikol.
  if (filters.sort && filters.sort !== DEFAULT_SORT) out.push(["sort", filters.sort])
  if (filters.dir && filters.dir !== defaultDirFor(filters.sort ?? DEFAULT_SORT)) {
    out.push(["dir", filters.dir])
  }
  if (filters.page && filters.page > 1) out.push(["page", String(filters.page)])
  return out
}

/** Aktívne filtre ako chips — v poradí, v akom sa zapisujú do adresy. */
export function activeChips(filters: ActiveFilters): { key: MultiKey; value: string }[] {
  return MULTI_KEYS.flatMap(key => filters[key].map(value => ({ key, value })))
}

/**
 * Triedenie a stránkovanie riadkov.
 *
 * Prečo v Node a nie v databáze: zoznam sa aj tak ťahá celý — `folderTrail`
 * (cesta priečinkov) a označenie platného znenia sa dopočítavajú z verzií až
 * tu, takže podľa nich sa v Monge triediť ani nedá. Pri knižnici predpisov
 * jednej organizácie sú to stovky riadkov, nie milióny.
 *
 * A hlavne: **texty sa musia triediť po slovensky.** `localeCompare(…, "sk")`
 * pozná diakritiku a poradie „Č" po „C"; binárne porovnanie by hodilo „Čas"
 * až za „Zima". V databáze by to znamenalo `collation` a index na každý
 * stĺpec zvlášť.
 *
 * Keď zoznam narastie, presunie sa to do dotazu s indexom — dovtedy by to bola
 * zložitosť za nič.
 */
export interface SortableRow {
  title: string
  category?: string
  status: string
  updatedAt?: Date
}

export function sortRows<T extends SortableRow>(rows: T[], key: SortKey, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1
  const text = (v: string | undefined) => v ?? ""
  const time = (v: Date | undefined) => (v ? new Date(v).getTime() : 0)

  return rows.slice().sort((a, b) => {
    let d = 0
    if (key === "updatedAt") d = time(a.updatedAt) - time(b.updatedAt)
    else if (key === "title") d = text(a.title).localeCompare(text(b.title), "sk")
    else if (key === "category") d = text(a.category).localeCompare(text(b.category), "sk")
    else d = text(a.status).localeCompare(text(b.status), "sk")
    if (d !== 0) return d * sign
    /*
     * Pri rovnosti rozhodne názov — a **vždy vzostupne**, bez ohľadu na smer
     * hlavného triedenia. Keby sa obrátil aj on, dva dokumenty s tým istým
     * dátumom by si pri prepnutí smeru vymenili miesto bez zjavnej príčiny
     * a zoznam by vyzeral, že sa mieša pod rukami.
     */
    return key === "title" ? 0 : text(a.title).localeCompare(text(b.title), "sk")
  })
}

export interface Paged<T> {
  rows: T[]
  page: number
  pages: number
  /** Poradie prvého a posledného riadka na strane, počítané od 1. */
  from: number
  to: number
}

/**
 * Vyreže stranu. Strana za koncom sa **nevracia prázdna, ale posledná** —
 * prázdna obrazovka po zmazaní dokumentu vyzerá ako porucha, nie ako
 * „táto strana už neexistuje".
 */
export function pageRows<T>(rows: T[], page: number, size = PAGE_SIZE): Paged<T> {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(Math.max(1, page), pages)
  const start = (current - 1) * size
  const slice = rows.slice(start, start + size)
  return {
    rows: slice,
    page: current,
    pages,
    from: rows.length === 0 ? 0 : start + 1,
    to: start + slice.length,
  }
}
