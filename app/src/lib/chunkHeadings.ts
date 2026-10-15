/**
 * chunkHeadings.ts — prvý rez úsekov zo štruktúry Markdownu (ADR-035, D223).
 *
 * Bez nastavenia, pre každý dokument rovnako. Štruktúru nesie text sám —
 * nadpisy podľa úrovne a číslovanie; prevod PDF, nahratý `.md` aj editor
 * dávajú Markdown. Pravidlo:
 *
 *   1. úsek začína na nadpise najvyššej úrovne, ktorá dá rozumnú veľkosť —
 *      časť nad cieľ sa delí na najbližšiu nižšiu úroveň nadpisov v nej;
 *   2. časť bez podnadpisov nad cieľ sa delí medzi blokmi (odsek, položka),
 *      nikdy pred tabuľkou alebo zoznamom, ktorý uvádza veta s dvojbodkou;
 *   3. časť pod minimum sa pripojí k nasledujúcej, ak tá nezačína vyššou
 *      úrovňou a spolu nepresiahnu cieľ.
 *
 * Výsledok sú hranice v indexoch blokov (`chunkBlocks.ts`) — rovnaký tvar
 * ako ručné hranice a návrh AI, takže všetky tri sa dajú porovnať a kresliť.
 * Čisté funkcie.
 */

import { estimateTokens } from "./chunker.mjs"
import { splitBlocks, joinBlocks, normalizeBoundaries, type TextBlock } from "./chunkBlocks"

/** Cieľová veľkosť úseku v tokenoch (ADR-035). Nie je to nastavenie. */
export const CUT_MIN = 300
export const CUT_MAX = 900

/** Verzia pravidla — vstupuje do odtlačku členenia; zvýši ju človek pri zmene výsledku. */
export const HEADINGS_CUT_VERSION = 1

/** Koľko nadpisov treba, aby text mal štruktúru (inak chunker pre text bez nadpisov). */
const MIN_HEADINGS = 2

export function hasStructure(blocks: TextBlock[]): boolean {
  return blocks.filter(b => b.kind === "heading").length >= MIN_HEADINGS
}

const tokensOf = (blocks: TextBlock[], from: number, to: number) => estimateTokens(joinBlocks(blocks.slice(from, to)))

/** Pred týmto blokom sa nereže: tabuľka alebo zoznam za vetou s dvojbodkou, položka za položkou. */
function glued(blocks: TextBlock[], b: number): boolean {
  const prev = blocks[b - 1]
  const cur = blocks[b]
  if (!prev || !cur) return false
  if ((cur.kind === "table" || cur.kind === "item") && /:\s*$/.test(prev.text)) return true
  if (cur.kind === "item" && prev.kind === "item") return true
  if (cur.kind === "table" && prev.kind === "heading") return true
  return false
}

/** Delenie časti bez podnadpisov medzi blokmi — chamtivo do cieľa. */
function splitByBlocks(blocks: TextBlock[], from: number, to: number): number[] {
  const out: number[] = []
  let start = from
  for (let b = from + 1; b < to; b++) {
    if (tokensOf(blocks, start, b + 1) > CUT_MAX && !glued(blocks, b) && tokensOf(blocks, start, b) >= CUT_MIN / 2) {
      out.push(b)
      start = b
    }
  }
  return out
}

/** Hranice v časti `[from, to)` — rekurzívne po úrovniach nadpisov. */
function cutRange(blocks: TextBlock[], from: number, to: number): number[] {
  if (to - from <= 1 || tokensOf(blocks, from, to) <= CUT_MAX) return []
  // Najvyššia úroveň nadpisu vnútri časti (bez bloku, ktorým časť začína).
  let level = 7
  for (let b = from + 1; b < to; b++) if (blocks[b].kind === "heading") level = Math.min(level, blocks[b].level)
  if (level === 7) return splitByBlocks(blocks, from, to)
  const starts = [from]
  for (let b = from + 1; b < to; b++) if (blocks[b].kind === "heading" && blocks[b].level === level) starts.push(b)
  const out: number[] = []
  starts.forEach((s, i) => {
    const e = i + 1 < starts.length ? starts[i + 1] : to
    if (i > 0) out.push(s)
    out.push(...cutRange(blocks, s, e))
  })
  return out
}

/** Úroveň, ktorou úsek začína — nadpis, inak „pokračovanie" (najnižšia). */
const startLevel = (blocks: TextBlock[], b: number) => (blocks[b]?.kind === "heading" ? blocks[b].level : 7)

/** Malé úseky k nasledujúcim (bod 3). */
function mergeSmall(blocks: TextBlock[], boundaries: number[]): number[] {
  const cuts = [...boundaries]
  let changed = true
  while (changed) {
    changed = false
    const edges = [0, ...cuts, blocks.length]
    for (let i = 0; i < edges.length - 2; i++) {
      const [a, b, c] = [edges[i], edges[i + 1], edges[i + 2]]
      const small = tokensOf(blocks, a, b) < CUT_MIN
      // Nasledujúci úsek nesmie začínať vyššou úrovňou než tento — inak by sa
      // koniec jednej časti zlepil so začiatkom inej.
      const sameOrDeeper = startLevel(blocks, b) >= startLevel(blocks, a)
      if (small && sameOrDeeper && tokensOf(blocks, a, c) <= CUT_MAX) {
        cuts.splice(cuts.indexOf(b), 1)
        changed = true
        break
      }
    }
    if (changed) continue
    // Malý úsek, ktorý dopredu nemohol (posledný, alebo za ním vyššia úroveň),
    // ide k predošlému — ak sám nezačína vyššou úrovňou než on.
    for (let i = 1; i < edges.length - 1; i++) {
      const [p, a, b] = [edges[i - 1], edges[i], edges[i + 1]]
      if (tokensOf(blocks, a, b) >= CUT_MIN) continue
      if (startLevel(blocks, a) >= startLevel(blocks, p) && tokensOf(blocks, p, b) <= CUT_MAX) {
        cuts.splice(cuts.indexOf(a), 1)
        changed = true
        break
      }
    }
  }
  return cuts
}

/** Hranice prvého rezu zo štruktúry. Text bez štruktúry → `null` (chunker). */
export function headingBoundaries(markdown: string): number[] | null {
  const blocks = splitBlocks(markdown)
  if (!hasStructure(blocks)) return null
  return normalizeBoundaries(mergeSmall(blocks, cutRange(blocks, 0, blocks.length)), blocks.length)
}
