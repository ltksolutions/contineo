/**
 * Typy k `chunker.mjs`.
 *
 * **Prečo zostáva `.mjs` a nie je prepísaný do TypeScriptu:** je to jediné
 * miesto, kde žije pravidlo, ako sa norma delí na chunky, a to pravidlo je
 * odladené na deviatich skutočných predpisoch. Prepis by znamenal stovky
 * mechanických zmien v algoritme, ktorý sa meniť nemá — a tichá zmena
 * členenia sa prejaví až tým, že model odcituje nesprávny článok.
 *
 * Súbor sa preto presunul do `src/lib/` **bez jediného zásahu do kódu**
 * a typy sú tu vedľa. Skripty ho importujú cez preberací bod
 * `scripts/lib/chunker.mjs`, takže definícia je jedna — rovnako ako pri
 * `csv.ts`. Obrazovka knižnice a `import.mjs` musia rezať rovnako; dve kópie
 * by sa rozišli presne pri novele, keď na tom najviac záleží.
 */

export const TARGET_MIN: number
export const TARGET_MAX: number

/**
 * Profil členenia (D58). Konfiguruje sa **slovom, nie regulárnym výrazom** —
 * vzor od zákazníka je jednak vec, ktorú nikto neodladí, jednak spôsob, ako
 * jedným zápisom zavesiť spracovanie celého dokumentu.
 */
export interface ChunkingProfile {
  slovoClanok: string
  annexWord: string
  headerRepeats: number
  cielMinTokenov: number
  cielMaxTokenov: number
}

export const DEFAULT_PROFILE: ChunkingProfile

export function patternsForProfile(profile?: Partial<ChunkingProfile>): unknown

export function estimateTokens(s: string): number

export interface Chunk {
  chunkIndex: number
  text: string
  heading: string
  articleRef: string | null
  kind?: "clanok" | "priloha" | "preambula"
  hasTable?: boolean
  wholeUnit?: boolean
}

export interface ChunkStats {
  linesAfterClean: number
  odstranene: { header: number; pageNumber: number; footnote: number; prazdne: number }
  clankov: number
  chunkov: number
  tokenyMin: number
  tokenyMax: number
  tokenyPriemer: number
  priloh: number
  withTable: number
  nadLimit: number
  shortFragments: number
  kratkeUplne: number
}

export function clean(
  text: string,
  meta?: { documentName?: string },
): { lines: string[]; odstranene: ChunkStats["odstranene"] }

export function parseStructure(lines: string[]): unknown[]

export function chunkText(
  text: string,
  meta?: { documentName?: string; profil?: Partial<ChunkingProfile> },
): { chunks: Chunk[]; stats: ChunkStats }
