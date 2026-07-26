/**
 * embeddingGuard.ts
 *
 * Strážca vektorového priestoru (ADR-001, sekcia 4, pravidlo 4).
 *
 * Prečo to existuje: vektory NIE SÚ prenositeľné medzi modelmi. `voyage-4`
 * a `BGE-M3` majú obe 1024 dimenzií, ale sémanticky sú to nekompatibilné
 * priestory. Keď sa zmieša model dotazu s modelom korpusu, **nič nespadne** —
 * len sa ticho zhoršia výsledky a nikto nebude vedieť prečo.
 *
 * Preto radšej tvrdé zlyhanie než tichý fallback.
 *
 * Výnimka: modely rodiny voyage-4 zdieľajú vektorový priestor (potvrdené
 * výrobcom), takže sú navzájom zameniteľné — cloud môže embedovať cez
 * `voyage-4` a on-prem cez `voyage-4-nano` bez re-embedu.
 */

import { ChunkResult } from "./mongoSearch"

/**
 * Rodiny modelov, v rámci ktorých sú vektory navzájom porovnateľné.
 * Zdroj: karta modelu voyageai/voyage-4-nano — „Shared Embedding Space
 * with voyage-4 series… can be directly compared and used interchangeably."
 */
const SHARED_SPACES: Record<string, string[]> = {
  "voyage-4": ["voyage-4", "voyage-4-large", "voyage-4-lite", "voyage-4-nano"],
}

/** Vráti názov zdieľaného priestoru, do ktorého model patrí (alebo model sám). */
export function embeddingSpace(model: string): string {
  const m = model.trim().toLowerCase()
  for (const [space, members] of Object.entries(SHARED_SPACES)) {
    if (members.includes(m)) return space
  }
  return m
}

/** Sú vektory z týchto dvoch modelov navzájom porovnateľné? */
export function isCompatible(a: string, b: string): boolean {
  return embeddingSpace(a) === embeddingSpace(b)
}

export class EmbeddingSpaceMismatchError extends Error {
  constructor(
    readonly expected: string,
    readonly found: string[],
    readonly sampleChunkIds: string[]
  ) {
    super(
      `Nezhoda vektorového priestoru: profil tenanta používa "${expected}", ` +
      `ale korpus obsahuje chunky z modelu ${found.map(f => `"${f}"`).join(", ")}. ` +
      `Retrieval by tíško vracal nezmysly. Treba re-embed korpusu ` +
      `(app/scripts/reembed.mjs). Vzorka chunkov: ${sampleChunkIds.slice(0, 3).join(", ")}`
    )
    this.name = "EmbeddingSpaceMismatchError"
  }
}

/**
 * Overí, že načítané chunky pochádzajú z rovnakého vektorového priestoru,
 * aký má tenant v profile.
 *
 * Chunky bez `embeddingModel` sa preskočia — sú to staré záznamy pred
 * zavedením poľa. Doplní ich backfill (app/scripts/reembed.mjs --backfill).
 */
export function assertEmbeddingSpace(chunks: ChunkResult[], profileModel: string): void {
  const nezhodne = new Map<string, string[]>()

  for (const c of chunks) {
    const m = c.embeddingModel
    if (!m) continue                       // starý chunk, backfill ho doplní
    if (isCompatible(m, profileModel)) continue
    const list = nezhodne.get(m) ?? []
    list.push(String(c._id))
    nezhodne.set(m, list)
  }

  if (nezhodne.size === 0) return
  throw new EmbeddingSpaceMismatchError(
    profileModel,
    [...nezhodne.keys()],
    [...nezhodne.values()].flat()
  )
}

/**
 * Mäkká kontrola pre monitoring — nevyhadzuje, len vráti prehľad.
 * Hodí sa na dashboard „koľko korpusu čaká na re-embed".
 */
export function embeddingStats(chunks: ChunkResult[], profileModel: string) {
  let ok = 0, nezhodne = 0, bezModelu = 0
  const modely = new Set<string>()
  for (const c of chunks) {
    if (!c.embeddingModel) { bezModelu++; continue }
    modely.add(c.embeddingModel)
    if (isCompatible(c.embeddingModel, profileModel)) ok++
    else nezhodne++
  }
  return { spolu: chunks.length, ok, nezhodne, bezModelu, modely: [...modely] }
}
