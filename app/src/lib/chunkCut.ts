/**
 * chunkCut.ts — ktorým spôsobom sa znenie nareže pri indexovaní
 * (KNIZ-rezac-blokov Q3 A, ADR-035 D225).
 *
 * Jedno miesto rozhodnutia, v tomto poradí:
 *
 *   1. **ručné hranice** prijaté kurátorom (`documents.chunkCuts`) — keď sedí
 *      odtlačok textu;
 *   2. **rez zo štruktúry Markdownu** (`chunkHeadings.ts`, ADR-035 D223) —
 *      text s nadpismi, teda takmer každý;
 *   3. **chunker s predvolenými hodnotami** — text bez nadpisov (starý prepis).
 *
 * Profily členenia (D58, D79) zanikli (ADR-035 D224) — nič z organizácie
 * ani z dokumentu sem nevstupuje.
 *
 * Všetky miesta, ktoré režú na zápis (`publish`, `reindexVersion`, stav
 * preindexovania, Členenie), volajú `cutForIndex()`. Keby si každé vyberalo
 * samo, jedno by zabudlo na ručné hranice a stav by tvrdil, že treba
 * preindexovať, hoci je všetko v poriadku — alebo naopak.
 *
 * Do odtlačku členenia (`chunkingFingerprint`) vstupuje spôsob aj hranice,
 * takže zmena rezu sa prejaví ako „treba preindexovať".
 */

import { chunkText, DEFAULT_PROFILE, type Chunk } from "./chunker.mjs"
import { textFingerprint } from "./chunkIdentity"
import { cutByBoundaries } from "./chunkBlocks"
import { headingBoundaries, HEADINGS_CUT_VERSION, CUT_MIN, CUT_MAX } from "./chunkHeadings"

/** Prijatý ručný rez — pri dokumente, viazaný na text, z ktorého vznikol. */
export interface ChunkCut {
  /** `textFingerprint()` textu, pre ktorý hranice platia. */
  textHash: string
  /** Indexy blokov, ktorými začína nový úsek (`chunkBlocks.ts`). */
  boundaries: number[]
  /** Kolo návrhu, z ktorého rez pochádza. */
  round: number
  at: Date
  by: string
}

/** Spôsob rezu — „Spôsob" na stránke Členenie. */
export type CutMethod = "manual" | "headings" | "plain"

/** Koľko prijatých rezov sa drží pri dokumente (staršie znenia). */
export const CUTS_KEPT = 10

/** Prijatý rez pre presne tento text, alebo `null`. Najnovší vyhráva. */
export function manualCutFor(cuts: ChunkCut[] | null | undefined, markdown: string): ChunkCut | null {
  if (!cuts?.length) return null
  const hash = textFingerprint(markdown)
  for (let i = cuts.length - 1; i >= 0; i--) if (cuts[i]?.textHash === hash) return cuts[i]
  return null
}

/**
 * Rez textu na zápis. `fingerprintProfile` je to, čo ide do
 * `chunkingFingerprint()` ako profil.
 */
export function cutForIndex(
  markdown: string,
  title: string,
  cuts?: ChunkCut[] | null,
): { chunks: Chunk[]; fingerprintProfile: unknown; manual: ChunkCut | null; method: CutMethod; boundaries: number[] | null } {
  const manual = manualCutFor(cuts, markdown)
  if (manual) {
    return {
      chunks: cutByBoundaries(markdown, manual.boundaries, title),
      fingerprintProfile: { rucne: manual.boundaries },
      manual,
      method: "manual",
      boundaries: manual.boundaries,
    }
  }
  const fromHeadings = headingBoundaries(markdown)
  if (fromHeadings) {
    return {
      chunks: cutByBoundaries(markdown, fromHeadings, title),
      fingerprintProfile: { nadpisy: HEADINGS_CUT_VERSION, min: CUT_MIN, max: CUT_MAX },
      manual: null,
      method: "headings",
      boundaries: fromHeadings,
    }
  }
  const { chunky } = chunkText(markdown, { nazovDokumentu: title })
  return { chunks: chunky, fingerprintProfile: { ...DEFAULT_PROFILE }, manual: null, method: "plain", boundaries: null }
}
