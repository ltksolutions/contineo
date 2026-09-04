/**
 * Typy k `chunker.mjs`.
 *
 * **Prípona `.d.mts`, nie `.d.ts`.** TypeScript hľadá k `chunker.mjs` súbor
 * `chunker.d.mts`; pri `.d.ts` ho nenájde a typy si ticho odvodí priamo
 * z JavaScriptu. Práve to sa stalo predtým: deklarácie sa rozišli so
 * skutočným kódom (`annexWord` proti `slovoPriloha`, `chunks` proti `chunky`)
 * a nikto sa to nedozvedel, lebo súbor nikdy nikto nečítal.
 *
 * **Prečo `chunker.mjs` zostáva `.mjs` a nie je prepísaný do TypeScriptu:**
 * je to jediné miesto, kde žije pravidlo, ako sa norma delí na chunky, a to
 * pravidlo je odladené na deviatich skutočných predpisoch. Prepis by znamenal
 * stovky mechanických zmien v algoritme, ktorý sa meniť nemá — a tichá zmena
 * členenia sa prejaví až tým, že model odcituje nesprávny článok.
 *
 * **Názvy sú jeho, nie naše.** Parametre aj výstup sú po slovensky, lebo tak
 * ich má chunker. Zvyšok aplikácie ich nevidí: prekladá sa v
 * `chunkingProfile.ts` (`toChunkerProfile()`), ktorý je jediné miesto, kde sa
 * tieto názvy vyslovujú. Skripty ho importujú cez preberací bod
 * `scripts/lib/chunker.mjs`, takže definícia je jedna — obrazovka knižnice
 * a `import.mjs` musia rezať rovnako; dve kópie by sa rozišli presne pri
 * novele, keď na tom najviac záleží.
 */

export const TARGET_MIN: number
export const TARGET_MAX: number

/**
 * Profil členenia tak, ako mu rozumie chunker (D58). Konfiguruje sa
 * **slovom, nie regulárnym výrazom** — vzor od zákazníka je jednak vec,
 * ktorú nikto neodladí, jednak spôsob, ako jedným zápisom zavesiť
 * spracovanie celého dokumentu.
 *
 * Anglický náprotivok pre databázu a aplikáciu je `ChunkingProfile`
 * v `chunkingProfile.ts`.
 */
export interface ChunkerProfile {
  slovoClanok: string
  slovoPriloha: string
  opakovaniHlavicky: number
  cielMinTokenov: number
  cielMaxTokenov: number
}

export const DEFAULT_PROFILE: ChunkerProfile

/** Zostavené vzory pre daný profil. Podoba je vnútorná vec chunkera. */
export function patternsForProfile(profile?: Partial<ChunkerProfile>): unknown

export function estimateTokens(s: string): number

export interface Chunk {
  chunkIndex: number
  text: string
  heading: string
  articleRef: string | null
  /** Časť predpisu, do ktorej článok patrí. Prílohy ju nemajú. */
  cast: string | null
  typ: "clanok" | "priloha" | "preambula"
  /** `true`, keď je chunk celý článok, nie jeho úlomok. */
  uplnaJednotka: boolean
  obsahujeTabulku?: boolean
}

export interface Removed {
  hlavicka: number
  cisloStrany: number
  poznamka: number
  prazdne: number
}

export interface ChunkStats {
  riadkovPoOcisteni: number
  odstranene: Removed
  clankov: number
  chunkov: number
  tokenyMin: number
  tokenyMax: number
  tokenyPriemer: number
  priloh: number
  sTabulkou: number
  nadLimit: number
  kratkeUlomky: number
  kratkeUplne: number
}

export function clean(
  text: string,
  meta?: { nazovDokumentu?: string; vzory?: unknown },
): { riadky: string[]; odstranene: Removed }

export function parseStructure(lines: string[], vzory?: unknown): unknown[]

export function chunkText(
  text: string,
  meta?: { nazovDokumentu?: string; profil?: Partial<ChunkerProfile> },
): { chunky: Chunk[]; statistiky: ChunkStats }
