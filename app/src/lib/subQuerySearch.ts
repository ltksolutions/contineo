/**
 * subQuerySearch.ts — hlavné hľadanie a podotázky naraz (čas po prvý token, fáza 2).
 *
 * Podotázky z prepisu otázky do 1. 10. 2026 čakali, kým dobehne hlavné
 * hľadanie — celé jedno kolo hľadania (0,6–4 s) navyše pred prvým tokenom.
 * Navzájom na sebe nezávisia, takže bežia súbežne. Výsledok je rovnaký ako
 * predtým: najprv hlavné výsledky v ich poradí, za nimi nové úseky
 * z podotázok, bez duplikátov a najviac `MAX_MERGED`.
 */
import type { ChunkResult } from "./mongoSearch"

/** Najviac podotázok na otázku — každá je ďalšie hybridné hľadanie. */
export const MAX_SUB_QUERIES = 3

/** Strop úsekov po zlúčení s podotázkami (kontext pre model). */
export const MAX_MERGED = 8

export async function searchWithSubQueries(
  main: () => Promise<ChunkResult[]>,
  subQueries: string[],
  sub: (query: string) => Promise<ChunkResult[]>,
): Promise<ChunkResult[]> {
  const queries = subQueries.slice(0, MAX_SUB_QUERIES)
  const [chunks, ...subResults] = await Promise.all([main(), ...queries.map(q => sub(q))])
  // Bez podotázok sa výsledok hlavného hľadania nemení ani neorezáva.
  if (queries.length === 0) return chunks

  const merged = [...chunks]
  const seen = new Set(chunks.map(c => String(c._id)))
  for (const results of subResults) {
    for (const chunk of results) {
      if (!seen.has(String(chunk._id))) {
        seen.add(String(chunk._id))
        merged.push(chunk)
      }
    }
  }
  return merged.slice(0, MAX_MERGED)
}
