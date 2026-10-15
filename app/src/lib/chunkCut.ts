/**
 * chunkCut.ts — ktorým spôsobom sa znenie nareže pri indexovaní
 * (KNIZ-rezac-blokov, Q3 A).
 *
 * Dve cesty, jedno miesto rozhodnutia:
 *
 *   - **ručné hranice** prijaté kurátorom (`documents.chunkCuts`) — keď sedí
 *     odtlačok textu, majú prednosť;
 *   - inak **profil** dokumentu cez `chunker.mjs` (D79), ako doteraz.
 *
 * Všetky miesta, ktoré režú na zápis (`publish`, `reindexVersion`, stav
 * preindexovania, Členenie), volajú `cutForIndex()`. Keby si každé vyberalo
 * samo, jedno by zabudlo na ručné hranice a stav by tvrdil, že treba
 * preindexovať, hoci je všetko v poriadku — alebo naopak.
 *
 * Do odtlačku členenia (`chunkingFingerprint`) vstupujú aj hranice, takže
 * prijatie nového rezu sa prejaví ako „treba preindexovať".
 */

import { chunkText, DEFAULT_PROFILE, type Chunk, type ChunkerProfile } from "./chunker.mjs"
import { textFingerprint } from "./chunkIdentity"
import { cutByBoundaries } from "./chunkBlocks"

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
  /** Tvar z `toChunkerProfile()` — `undefined` = predvolený profil. */
  forChunker: Partial<ChunkerProfile> | Record<string, string | number> | undefined,
  cuts?: ChunkCut[] | null,
): { chunks: Chunk[]; fingerprintProfile: unknown; manual: ChunkCut | null } {
  const manual = manualCutFor(cuts, markdown)
  if (manual) {
    return {
      chunks: cutByBoundaries(markdown, manual.boundaries),
      fingerprintProfile: { rucne: manual.boundaries },
      manual,
    }
  }
  const { chunky } = chunkText(markdown, { nazovDokumentu: title, profil: forChunker as Partial<ChunkerProfile> | undefined })
  return { chunks: chunky, fingerprintProfile: { ...DEFAULT_PROFILE, ...forChunker }, manual: null }
}
