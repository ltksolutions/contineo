/**
 * chunkPages.ts — z ktorých strán PDF je úsek.
 *
 * Odpoveď cituje úsek, ale schválená podoba je PDF (ADR-011). Pri Pravidlách
 * futbalu (224 strán, schémy ihriska a diagramy mimo hry) človeku nestačí
 * „Pravidlo 11" — chce vidieť stranu so schémou. Úsek preto nesie rozsah
 * strán a citácia naň vedie (Ján 3. 11. 2026).
 *
 * Strany sa zisťujú tým istým porovnaním slov ako kontrola prevodu
 * (`conversionCheck.ts`): slovo textu, ktoré sa zhoduje so slovom textovej
 * vrstvy, má jeho stranu. Úsek sa v texte nájde podľa svojich prvých slov.
 * Čisté funkcie.
 */

import { contentImages, diffTokens, layerTokens, markdownTokens, type LayerPage } from "./conversionCheck"

export interface PageRange {
  from: number
  to: number
  /**
   * Strana schémy, ktorú úsek opisuje odsekom „Obrázok v origináli" (Ján
   * 3. 11. 2026). Náhľad a odkaz citácie vedú sem, nie na začiatok úseku —
   * pri otázke na schému človek hľadá práve tú stranu.
   */
  figure?: number
}

/** Koľko slov úseku musí sedieť za sebou, aby sa v texte našiel. */
const ANCHOR_WORDS = 6

/** Začiatok opisu schémy v tokenoch textu (`aiConversion.ts`). */
const FIGURE = ["Obrázok", "v", "origináli"]

/**
 * Strana pre každé slovo textu; slovo bez zhody preberie stranu suseda.
 * `matched` hovorí, ktoré slová stranu majú zo zhody — opis schémy textová
 * vrstva nemá, takže jeho strana je len odhad od suseda.
 */
export function wordPages(layer: LayerPage[], markdown: string): { keys: string[]; pages: number[]; matched: boolean[] } {
  const pdf = layerTokens(layer)
  const md = markdownTokens(markdown)
  const pages: (number | null)[] = md.map(() => null)
  for (const op of diffTokens(pdf.map(t => t.key), md.map(t => t.key))) {
    if (op.kind !== "same") continue
    for (let k = 0; k < op.bEnd - op.bStart; k++) pages[op.bStart + k] = pdf[op.aStart + k].at
  }
  const matched = pages.map(p => p !== null)
  let last: number | null = null
  for (let i = 0; i < pages.length; i++) pages[i] = last = pages[i] ?? last
  let next: number | null = null
  for (let i = pages.length - 1; i >= 0; i--) pages[i] = next = pages[i] ?? next
  return { keys: md.map(t => t.key), pages: pages.map(p => p ?? 1), matched }
}

/** Telo úseku bez riadku kontextu („Názov › Časť"), ktorý v texte dokumentu nie je. */
function bodyOf(text: string, title: string): string {
  const cut = text.indexOf("\n\n")
  if (cut < 0) return text
  const first = text.slice(0, cut).trim()
  return title && (first === title.trim() || first.startsWith(`${title.trim()} ›`)) ? text.slice(cut + 2) : text
}

function findAt(keys: string[], want: string[], from: number): number {
  const n = Math.min(ANCHOR_WORDS, want.length)
  for (let i = from; i + n <= keys.length; i++) {
    let ok = true
    for (let j = 0; j < n && ok; j++) ok = keys[i + j] === want[j]
    if (ok) return i
  }
  return -1
}

/**
 * Strana schémy, ktorej opis začína na slove `at`. Opis v textovej vrstve
 * nie je, takže leží medzi poslednou stranou pred ním a prvou za ním; z nich
 * sa berie prvá, na ktorej je obrázok obsahu (logá sa nerátajú). Keď taká
 * nie je, strana textu pred opisom.
 */
function figurePage(at: number, pages: number[], matched: boolean[], images: number[]): number {
  let before = at
  while (before > 0 && !matched[before]) before--
  let after = at
  while (after < pages.length - 1 && !matched[after]) after++
  for (let p = pages[before]; p <= pages[after]; p++) if (images[p - 1] > 0) return p
  return pages[before]
}

function findFigure(keys: string[], from: number, to: number): number {
  for (let i = from; i + FIGURE.length - 1 <= to; i++) {
    if (FIGURE.every((w, j) => keys[i + j] === w)) return i
  }
  return -1
}

/**
 * Rozsah strán každého úseku, v poradí úsekov. `null`, keď sa úsek v texte
 * nenašiel — citácia potom stranu len neukáže, nič sa nepokazí.
 */
export function chunkPageRanges(layer: LayerPage[], markdown: string, chunkTexts: string[], title = ""): (PageRange | null)[] {
  if (!layer.length) return chunkTexts.map(() => null)
  const { keys, pages, matched } = wordPages(layer, markdown)
  const images = contentImages(layer)
  let cursor = 0
  return chunkTexts.map(text => {
    const want = markdownTokens(bodyOf(text, title)).map(t => t.key)
    if (!want.length) return null
    let at = findAt(keys, want, cursor)
    if (at < 0) at = findAt(keys, want, 0)
    if (at < 0) return null
    const end = Math.min(keys.length - 1, at + want.length - 1)
    cursor = at + 1
    const range: PageRange = { from: Math.min(pages[at], pages[end]), to: Math.max(pages[at], pages[end]) }
    const fig = findFigure(keys, at, end)
    if (fig >= 0) range.figure = figurePage(fig, pages, matched, images)
    return range
  })
}
