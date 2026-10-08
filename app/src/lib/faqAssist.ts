/**
 * faqAssist.ts — pomocník pri písaní záznamu FAQ: hľadanie podkladu
 * v knižnici a v konektoroch (Ján 8. 10. 2026).
 *
 * **Stav je v adrese, nie v klientovi.** Hľadanie aj „Použiť ako zdroj" /
 * „Vložiť do odpovede" sú tlačidlá `GET` v tom istom formulári ako rozpísaný
 * záznam, takže stránka sa načíta znova **aj s tým, čo človek napísal**
 * (otázka, odpoveď, zdroje). Funguje bez JavaScriptu; uloženie záznamu ostáva
 * serverová akcia toho istého formulára.
 *
 * Kde sa hľadá, vyberá človek prepínačmi; predvolene len knižnica — rovnako
 * ako pri „Opýtať sa" (#313). Konektor nesmie byť predvolený: dnešný Sportnet
 * vracia anglickú technickú dokumentáciu, ktorá by väčšinou zavadzala.
 */

import { MAX_ANSWER, MAX_SOURCES } from "./faq"

/** Hodnota prepínača knižnice; konektor je `c:<id>:<rozsah>`. */
export const LIBRARY_SOURCE = "library"
/** Koľko znakov sa vloží do odpovede z jedného výsledku. */
export const INSERT_MAX = 900

export interface AssistDraft {
  question: string
  variants: string
  answer: string
  audience: string
  sources: { documentId: string; articleRef: string }[]
}

export interface AssistState {
  query: string
  /** Vybrané zdroje hľadania; prázdne = nehľadá sa nikde. */
  sources: string[]
  draft: AssistDraft
}

type Raw = Record<string, string | string[] | undefined>

const all = (v: string | string[] | undefined): string[] => (Array.isArray(v) ? v : v === undefined ? [] : [v])
const one = (v: string | string[] | undefined): string => all(v)[0] ?? ""

export function connectorSource(connectorId: string, scopeKey: string): string {
  return `c:${connectorId}:${scopeKey}`
}

export function parseConnectorSource(value: string): { connectorId: string; scopeKey: string } | null {
  const m = /^c:([^:]+):(.*)$/.exec(value)
  return m ? { connectorId: m[1], scopeKey: m[2] } : null
}

/**
 * Adresa → stav pomocníka. Bez `q` v adrese (prvé otvorenie) je vybraná
 * knižnica; s ním platí presne to, čo bolo zaškrtnuté.
 */
export function parseAssist(raw: Raw): AssistState {
  const searched = raw.q !== undefined
  const docs = all(raw.sourceDocument)
  const articles = all(raw.sourceArticle)
  const sources = docs
    .map((documentId, i) => ({ documentId: documentId.trim(), articleRef: (articles[i] ?? "").trim() }))
    .filter(s => s.documentId)
  const draft: AssistDraft = {
    question: one(raw.question),
    variants: one(raw.variants),
    answer: one(raw.answer),
    audience: one(raw.audience),
    sources,
  }
  return applyAssist(
    { query: one(raw.q).trim().slice(0, 300), sources: searched ? all(raw.src) : [LIBRARY_SOURCE], draft },
    { use: one(raw.use), insert: one(raw.insert) },
  )
}

/**
 * „Použiť ako zdroj" (`dokument|článok`) a „Vložiť do odpovede" (text).
 * Čisté — rovnaký zdroj sa nepridá dvakrát, zdrojov je najviac `MAX_SOURCES`
 * a odpoveď neprekročí `MAX_ANSWER`.
 */
export function applyAssist(state: AssistState, action: { use?: string; insert?: string }): AssistState {
  let { sources, answer } = state.draft
  if (action.use) {
    const [documentId, articleRef = ""] = action.use.split("|")
    const exists = sources.some(s => s.documentId === documentId && s.articleRef === articleRef)
    if (documentId && !exists && sources.length < MAX_SOURCES) sources = [...sources, { documentId, articleRef }]
  }
  if (action.insert) {
    const text = action.insert.trim().slice(0, INSERT_MAX)
    answer = (answer.trim() ? `${answer.trimEnd()}\n\n${text}` : text).slice(0, MAX_ANSWER)
  }
  return { ...state, draft: { ...state.draft, sources, answer } }
}

/** Úryvok na obrazovku a na vloženie — bez opakovaných medzier. */
export function excerptOf(text: string, max = INSERT_MAX): string {
  const flat = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
  return flat.length > max ? `${flat.slice(0, max).trimEnd()} …` : flat
}

/** Bez diakritiky a veľkých písmen — „Prestup" nájde aj „prestupovy". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

/**
 * Hľadanie v záznamoch FAQ v editore (Ján 8. 10. 2026: „záznamov bude veľa").
 * Každé slovo musí byť v otázke, ďalších zneniach, odpovedi alebo „pre koho".
 * Vracia **pôvodné poradie** — číslo záznamu sa podľa filtra nemení.
 */
export function filterEntries<T extends { question: string; variants: string[]; answer: string; audience: string[] }>(
  entries: T[], find: string,
): { entry: T; index: number }[] {
  const words = foldText(find).split(/\s+/).filter(Boolean)
  const all = entries.map((entry, index) => ({ entry, index }))
  if (!words.length) return all
  return all.filter(({ entry: e }) => {
    const hay = foldText([e.question, ...e.variants, e.answer, ...e.audience].join(" "))
    return words.every(w => hay.includes(w))
  })
}
