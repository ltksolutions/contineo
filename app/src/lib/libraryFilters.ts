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
import {
  readConditions, readMatch, conditionFields, normalizeGroups, splitAt, mergeUp,
  type Condition, type MatchMode,
} from "./libraryConditions"

/**
 * Facety, ktoré sa dajú vybrať viackrát.
 *
 * `ownerDepartment` je medzi nimi zámerne: „ktoré z troch oddelení to
 * spravuje" je rovnako bežná otázka ako „norma alebo smernica". Je to
 * **vlastníctvo dokumentu**, nie jeho adresáti — tí sú v `assignments`
 * a počítajú sa, keď na ne raz príde rad.
 */
export const MULTI_KEYS = ["category", "status", "tag", "accessLevel", "language", "ownerDepartment"] as const
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
 * `auto` je predvolený stav: na širokej obrazovke tabuľka, lebo v knižnici sa
 * dokumenty porovnávajú, na telefóne karty — tabuľka má deväť stĺpcov a na
 * 375 px je z nej vidieť názov dokumentu a nič viac. Vyberá CSS, nie server:
 * šírku obrazovky server nepozná a tá istá adresa má vyzerať rovnako všade.
 * `table` a `cards` sú výslovná voľba človeka a šírku prebijú.
 */
export type View = "auto" | "table" | "cards"

export function normalizeView(value: string | string[] | undefined): View {
  const value_ = one(value)
  return value_ === "cards" ? "cards" : value_ === "table" ? "table" : "auto"
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
  /** Oddelenia, ktoré dokumenty spravujú — identifikátory zo stromu (D49). */
  ownerDepartment: string[]
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
  /** Podmienky query buildera a režim ich spájania. */
  conditions: Condition[]
  match: MatchMode
  /**
   * Označené dokumenty — **v adrese, nie v stave formulára.**
   *
   * Dovtedy to boli zaškrtávacie políčka jedného formulára, takže výber
   * platil pre viditeľnú stranu a prechod na ďalšiu ho zabudol. Knižnica
   * beží bez JavaScriptu, takže inde než v adrese sa medzi dvomi
   * požiadavkami nemá kde držať.
   *
   * Dôsledok, ktorý treba niesť: označený dokument môže po zmene filtra
   * vypadnúť z viditeľného zoznamu a zostať vybraný. Preto sa nad zoznamom
   * píše, koľko z označených nie je vidieť — tichý výber, ktorý sa vlečie
   * naprieč filtrami, je zdroj prekvapení pri hromadnej akcii.
   */
  picked: string[]
}

export const EMPTY: ActiveFilters = {
  category: [], status: [], tag: [], accessLevel: [], language: [], ownerDepartment: [],
  conditions: [], match: "all", picked: [],
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

/**
 * Hodnoty, ktoré facet „Stav" pozná.
 *
 * `expired` je medzi nimi **prechodne**: `MASTER.md` ho medzi hodnoty facetu
 * neráta (expirované znenie *je* publikované), ale kým query builder nevie
 * pole „Platné do", je to jediný spôsob, ako expirované vypísať. Odchod
 * hodnoty je samostatný krok aj s prekladom starých odkazov —
 * `MASTER.md`, „Prechodný stav".
 */
export const STATUS_VALUES = ["published", "draft", "in-review", "expired"] as const

/**
 * Neznáma hodnota stavu sa **ticho zahodí**.
 *
 * Adresa je vstup od kohokoľvek — uložená záložka, odkaz v e-maile, preklep.
 * Doteraz sa neznáma hodnota niesla ďalej: nefiltrovala nič, ale vykreslila
 * sa ako pilulka aktívneho filtra, ktorú sa človek snažil pochopiť. Rovnaký
 * prístup ako pri triedení a stránkovaní nižšie — zahodiť, nie spadnúť
 * a nie ukazovať.
 */
export function normalizeStatuses(value: string | string[] | undefined): string[] {
  return list(value).filter(v => (STATUS_VALUES as readonly string[]).includes(v))
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
    status: normalizeStatuses(q.status),
    tag: list(q.tag),
    accessLevel: list(q.accessLevel),
    language: list(q.language),
    ownerDepartment: list(q.ownerDepartment),
    layout: one(q.layout),
    // Automatický pohľad sa nedrží ako hodnota — `undefined` znamená „podľa
    // šírky" a do adresy sa nezapíše. Inak by ho niesol každý odkaz.
    view: normalizeView(q.view) === "auto" ? undefined : normalizeView(q.view),
    sort: normalizeSort(q.sort),
    dir: normalizeDir(q.dir),
    page: normalizePage(q.page),
    conditions: readConditions(q),
    match: readMatch(q),
    picked: list(q.pick),
  }
}

/**
 * Pridanie podmienky. Obe cesty vracajú na prvú stranu.
 *
 * `join` hovorí, ako sa nová podmienka pripája k tej pred ňou: `and` ju dá do
 * poslednej skupiny, `or` otvorí novú. Predvolené je `and` — pri pridávaní
 * druhej podmienky človek najčastejšie zužuje, nie rozširuje.
 */
export function addCondition(
  filters: ActiveFilters,
  condition: Condition,
  join: "and" | "or" = "and",
): ActiveFilters {
  const rows = normalizeGroups(filters.conditions, filters.match)
  const last = rows.length > 0 ? rows[rows.length - 1].group! : 0
  const group = rows.length === 0 ? 0 : join === "or" ? last + 1 : last
  return firstPage({
    ...filters,
    conditions: [...rows, { ...condition, group }],
    // Od tejto chvíle nesú skupinu samotné podmienky; `match` zostáva len na
    // čítanie starších odkazov a nemá už čo prepínať.
    match: "all",
  })
}

export function removeCondition(filters: ActiveFilters, index: number): ActiveFilters {
  const rows = normalizeGroups(filters.conditions, filters.match)
  return firstPage({
    ...filters,
    // `normalizeGroups` po odobraní prečísluje skupiny, takže po zmazaní
    // celej skupiny nezostane diera v číslovaní.
    conditions: normalizeGroups(rows.filter((_, i) => i !== index)),
    match: "all",
  })
}

/** „ALEBO odtiaľto" — od tohto riadka začne nová skupina. */
export function splitConditions(filters: ActiveFilters, index: number): ActiveFilters {
  return firstPage({
    ...filters,
    conditions: splitAt(filters.conditions, index, filters.match),
    match: "all",
  })
}

/** „A namiesto ALEBO" — tento riadok patrí k predchádzajúcej skupine. */
export function mergeConditions(filters: ActiveFilters, index: number): ActiveFilters {
  return firstPage({
    ...filters,
    conditions: mergeUp(filters.conditions, index, filters.match),
    match: "all",
  })
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
  return { ...filters, view: view === "auto" ? undefined : view }
}

export function currentView(filters: ActiveFilters): View {
  return filters.view ?? "auto"
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
/**
 * Zruší filtre. **Výber zostáva** — sú to dve rôzne veci a človek, ktorý
 * si označil dokumenty a potom rozšíril zoznam, o ne prísť nechcel. Zrušiť
 * výber sa dá vedľa, vlastným odkazom.
 */
export function clearFilters(filters: ActiveFilters): ActiveFilters {
  return {
    ...EMPTY,
    layout: filters.layout, view: filters.view, sort: filters.sort, dir: filters.dir,
    picked: filters.picked,
  }
}

export function isEmpty(filters: ActiveFilters): boolean {
  return !filters.search && !filters.folder && filters.conditions.length === 0 &&
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
  out.push(...conditionFields(filters.conditions, filters.match))
  // Výber sa nesie **v každom odkaze**, aj v tom, ktorý mení filter alebo
  // stranu. To je celý zmysel: prežije prechod, ktorý ho predtým zahodil.
  for (const id of filters.picked) out.push(["pick", id])
  return out
}

/**
 * Označenie a odznačenie jedného dokumentu.
 *
 * **Nemení stranu.** Zvyšok filtrov na prvú stranu vracia (po zúžení by
 * strana 4 mohla byť prázdna), ale označenie riadka zoznam nezúži — vrátiť
 * človeka na začiatok pri každom zaškrtnutí by znamenalo, že sa na strane 3
 * nedá označiť nič.
 */
/**
 * Koľko dokumentov sa dá mať označených naraz.
 *
 * Výber sa nesie v adrese (`pick=<id>` pri každom), aby prežil prechod na
 * ďalšiu stranu a fungoval bez JavaScriptu. Identifikátor má okolo 24 znakov,
 * takže 200 označených je zhruba 6 kB — pod bežnou hranicou 8 kB, ktorú
 * servery a prehliadače znesú, ale už blízko. **Strop je tu preto, aby
 * pretečenie nebolo tiché:** bez neho sa adresa niekde po ceste oreže
 * a výber zmizne bez vysvetlenia, alebo požiadavka skončí chybou 431.
 *
 * Nie je to konečné riešenie, len poctivá hranica. Keď bude treba označovať
 * viac, správna odpoveď je „všetko, čo vyhovuje filtru" ako jeden príznak
 * v adrese — zapísané v `docs/TODO.md`.
 */
export const MAX_PICKED = 200

export function togglePick(filters: ActiveFilters, documentId: string): ActiveFilters {
  const id = documentId.trim()
  if (!id) return filters
  const has = filters.picked.includes(id)
  // Odznačiť sa dá vždy — strop nesmie uväzniť výber, ktorý už vznikol.
  if (!has && filters.picked.length >= MAX_PICKED) return filters
  return {
    ...filters,
    picked: has ? filters.picked.filter(x => x !== id) : [...filters.picked, id],
  }
}

/**
 * Označí všetko na viditeľnej strane, alebo to z nej odznačí.
 *
 * Zvyšok výberu zostáva. „Označiť stranu" je pomôcka na tejto strane, nie
 * príkaz „chcem presne toto" — kto chce začať odznova, má vedľa „zrušiť
 * výber".
 */
export function pickPage(filters: ActiveFilters, ids: string[], on: boolean): ActiveFilters {
  const page = ids.map(i => i.trim()).filter(Boolean)
  if (on) {
    const add = page.filter(i => !filters.picked.includes(i))
    // Strana sa pridá po prvok, ktorým by sa strop prekročil — nie celá
    // alebo nič. Kto označí stranu pri 195 označených, dostane päť ďalších
    // a hlášku; zahodiť celú stranu by bolo prekvapivejšie.
    const room = Math.max(0, MAX_PICKED - filters.picked.length)
    return { ...filters, picked: [...filters.picked, ...add.slice(0, room)] }
  }
  const drop = new Set(page)
  return { ...filters, picked: filters.picked.filter(i => !drop.has(i)) }
}

/** Zruší celý výber. Filtre zostávajú — sú to dve rôzne veci. */
export function clearPicked(filters: ActiveFilters): ActiveFilters {
  return { ...filters, picked: [] }
}

/**
 * Koľko z označených nie je vo viditeľnom zozname.
 *
 * Toto číslo je cena za výber, ktorý prežije zmenu filtra: bez neho by
 * človek presunul dvanásť dokumentov, o ktorých už nevie, že sú vybrané.
 */
export function pickedOutsideCount(picked: string[], visible: string[]): number {
  const shown = new Set(visible)
  return picked.filter(id => !shown.has(id)).length
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
