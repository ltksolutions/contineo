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

import { diffTokens, layerTokens, markdownTokens, type LayerPage } from "./conversionCheck"

export interface PageRange { from: number; to: number }

/** Koľko slov úseku musí sedieť za sebou, aby sa v texte našiel. */
const ANCHOR_WORDS = 6

/** Strana pre každé slovo textu; slovo bez zhody preberie stranu suseda. */
export function wordPages(layer: LayerPage[], markdown: string): { keys: string[]; pages: number[] } {
  const pdf = layerTokens(layer)
  const md = markdownTokens(markdown)
  const pages: (number | null)[] = md.map(() => null)
  for (const op of diffTokens(pdf.map(t => t.key), md.map(t => t.key))) {
    if (op.kind !== "same") continue
    for (let k = 0; k < op.bEnd - op.bStart; k++) pages[op.bStart + k] = pdf[op.aStart + k].at
  }
  let last: number | null = null
  for (let i = 0; i < pages.length; i++) pages[i] = last = pages[i] ?? last
  let next: number | null = null
  for (let i = pages.length - 1; i >= 0; i--) pages[i] = next = pages[i] ?? next
  return { keys: md.map(t => t.key), pages: pages.map(p => p ?? 1) }
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
 * Rozsah strán každého úseku, v poradí úsekov. `null`, keď sa úsek v texte
 * nenašiel — citácia potom stranu len neukáže, nič sa nepokazí.
 */
export function chunkPageRanges(layer: LayerPage[], markdown: string, chunkTexts: string[], title = ""): (PageRange | null)[] {
  if (!layer.length) return chunkTexts.map(() => null)
  const { keys, pages } = wordPages(layer, markdown)
  let cursor = 0
  return chunkTexts.map(text => {
    const want = markdownTokens(bodyOf(text, title)).map(t => t.key)
    if (!want.length) return null
    let at = findAt(keys, want, cursor)
    if (at < 0) at = findAt(keys, want, 0)
    if (at < 0) return null
    const end = Math.min(keys.length - 1, at + want.length - 1)
    cursor = at + 1
    const from = Math.min(pages[at], pages[end])
    return { from, to: Math.max(pages[at], pages[end]) }
  })
}
