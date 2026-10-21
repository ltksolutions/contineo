/**
 * chunkSize.ts — jedno meranie úseku a jedno pravidlo „nesedí" pre Členenie
 * (pohľady Dnes, Návrh, Rozdiel) aj pre odmietnutie návrhu AI.
 *
 * Do 21. 10. 2026 merali pohľady inak: Dnes rátal úsek tak, ako ho dostane
 * asistent (s riadkom kontextu „Zákon č. 440/2015 › Čl. I › …", o 30–35
 * tokenov viac), Návrh len holé bloky a zlomky nehlásil vôbec. Kolo 3 nad
 * zákonom o športe tak ukazovalo „bez nálezov" a po prijatí ten istý rez
 * „5 úsekov nesedí"; odmietnutie návrhu pustilo úsek s 1 350 tokenmi, ktorý
 * asistent dostal ako 1 384.
 *
 * Meria sa teda vždy úsek po reze (`cutByBoundaries()`), s riadkom kontextu
 * — tak, ako ide do indexu. Čisté funkcie.
 */

import { estimateTokens } from "./chunker.mjs"
import { cutByBoundaries } from "./chunkBlocks"
import { CUT_MIN, CUT_HARD } from "./chunkHeadings"

/** Nad týmto úsek „nesedí" ako veľký — asistent z neho dostane priveľa naraz. */
export const CHUNK_LIMIT = CUT_HARD
/** Pod týmto je kúsok rozdelenej časti zlomok — má málo kontextu. */
export const FRAGMENT_MAX = CUT_MIN / 2

export interface MeasuredChunk {
  tokens: number
  /** Úsek začína nadpisom — je celá jednotka, nie pokračovanie rozdelenej. */
  complete: boolean
}

/** Úseky rezu podľa hraníc, zmerané ako pri indexovaní. */
export function measureCut(markdown: string, boundaries: number[], title: string): MeasuredChunk[] {
  return cutByBoundaries(markdown, boundaries, title).map(c => ({ tokens: estimateTokens(c.text), complete: c.uplnaJednotka }))
}

export type ChunkFinding = "oversized" | "fragment" | null

/**
 * Čo na úseku nesedí. Krátka **celá** časť je prirodzená jednotka (nadpis
 * hlavy, krátky paragraf); zlomok vzniká len delením. Nevedieť, či je úsek
 * celý (`complete` chýba pri zastaranom indexe), znamená zlomok nehlásiť.
 */
export function chunkFinding(c: { tokens: number; complete?: boolean }): ChunkFinding {
  if (c.tokens > CHUNK_LIMIT) return "oversized"
  if (c.complete === false && c.tokens < FRAGMENT_MAX) return "fragment"
  return null
}
