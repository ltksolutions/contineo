/**
 * peopleSearch.ts — hľadanie v zozname osôb (KOMPONENT-hladanie-osob).
 *
 * Čistá logika bez Reactu, aby sa dala otestovať bez prehliadača:
 * kto vyhovuje dotazu, čo zvýrazniť a čo robí kláves v poli. Obrazovku
 * skladá `components/PeopleSearch.tsx`.
 */

import { fold } from "@/components/MultiSelect"

/**
 * Od koľkých osôb sa ukáže pole hľadania. Rovnaké pravidlo ako pri výbere
 * oddelenia (`KOMPONENT-vyber-oddelenia.md`): pri pár menách pole len zavadzia,
 * pri desiatkach sa bez neho meno v rámiku 260 px hľadá rolovaním.
 */
export const SEARCH_FROM = 8

export interface PersonChoice {
  id: string
  fullName: string
  email: string
  department?: string
}

export function canSearch(count: number): boolean {
  return count >= SEARCH_FROM
}

/** Slová dotazu bez diakritiky a veľkých písmen. Prázdny dotaz = žiadne slová. */
export function queryTerms(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean)
}

/**
 * Vyhovuje osoba všetkým slovám? Hľadá sa v mene, e-maile a oddelení naraz,
 * takže „it gal" nájde Galkovú z IT — viac slov zužuje, nie rozširuje.
 */
export function matchesPerson(p: PersonChoice, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = fold(`${p.fullName} ${p.email} ${p.department ?? ""}`)
  return terms.every(t => haystack.includes(t))
}

/** Identifikátory osôb, ktoré dotazu vyhovujú, v pôvodnom poradí zoznamu. */
export function visibleIds(people: PersonChoice[], query: string): string[] {
  const terms = queryTerms(query)
  return people.filter(p => matchesPerson(p, terms)).map(p => p.id)
}

/**
 * Položka všeobecného zoznamu s hľadaním (`ListSearch`) — osoba aj norma
 * (HR-pridelit-normy-hladanie, bod 2). Zo servera ide len údaj, nie funkcia.
 */
export interface ListItem {
  id: string
  /** Hlavný riadok; hľadá sa v ňom vždy. */
  name: string
  /** Riadok pod ním, časti sa spoja „ · ". */
  meta?: string[]
  /** Hľadá sa aj v `meta`? Pri osobách áno (e-mail, oddelenie), pri normách nie. */
  searchMeta?: boolean
  /** Príznak pre filter „len bez …" a štítok vpravo (norma bez právneho základu). */
  flagged?: boolean
}

export function matchesItem(item: ListItem, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = fold([item.name, ...(item.searchMeta ? item.meta ?? [] : [])].join(" "))
  return terms.every(t => haystack.includes(t))
}

/** Viditeľné položky v pôvodnom poradí; `onlyFlagged` zúži na označené. */
export function visibleItemIds(items: ListItem[], query: string, onlyFlagged = false): string[] {
  const terms = queryTerms(query)
  return items.filter(i => (!onlyFlagged || i.flagged) && matchesItem(i, terms)).map(i => i.id)
}

export function personItem(p: PersonChoice): ListItem {
  return {
    id: p.id,
    name: p.fullName,
    meta: [p.department, p.email].filter((x): x is string => Boolean(x)),
    searchMeta: true,
  }
}

export interface Segment {
  text: string
  hit: boolean
}

/**
 * Text rozdelený na kúsky so zhodou a bez nej — pre `<mark>`.
 *
 * Skladá sa **po znakoch**, nie `fold(text)` naraz: pozície v zloženom texte
 * musia sedieť s pôvodným, inak by sa pri „Šimko" zvýraznilo o znak vedľa.
 * Väčšina znakov sa zloží na jeden, ale nie všetky („İ" dá dva).
 */
export function highlight(text: string, terms: string[]): Segment[] {
  if (terms.length === 0 || !text) return [{ text, hit: false }]
  const chars = Array.from(text)
  let folded = ""
  const origin: number[] = [] // pozícia v `folded` → index znaku v `chars`
  chars.forEach((c, i) => {
    const f = fold(c)
    folded += f
    for (let k = 0; k < f.length; k++) origin.push(i)
  })
  const marked = new Array<boolean>(chars.length).fill(false)
  for (const t of terms) {
    let at = folded.indexOf(t)
    while (at > -1) {
      for (let k = at; k < at + t.length; k++) marked[origin[k]] = true
      at = folded.indexOf(t, at + t.length)
    }
  }
  const out: Segment[] = []
  chars.forEach((c, i) => {
    const last = out[out.length - 1]
    if (last && last.hit === marked[i]) last.text += c
    else out.push({ text: c, hit: marked[i] })
  })
  return out
}

export type SearchKeyAction =
  | { kind: "none" }
  /** Enter: formulár sa neodošle; pri jednom výsledku sa osoba vyberie. */
  | { kind: "enter"; pick: string | null }
  | { kind: "clear" }
  | { kind: "focusList" }

/**
 * Čo robí kláves v poli hľadania.
 *
 * **Enter nikdy neodošle formulár** — pole stojí vo formulári prípravy znenia
 * a Enter by spustil „Predložiť na schválenie", teda úkon s následkom pre
 * ostatných. Pri práve jednom výsledku osobu vyberie (Q2, 29. 9. 2026).
 */
export function searchKeyAction(key: string, query: string, visible: string[]): SearchKeyAction {
  if (key === "Enter") return { kind: "enter", pick: visible.length === 1 ? visible[0] : null }
  if (key === "Escape") return query ? { kind: "clear" } : { kind: "none" }
  if (key === "ArrowDown") return visible.length > 0 ? { kind: "focusList" } : { kind: "none" }
  return { kind: "none" }
}
