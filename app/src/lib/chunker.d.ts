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

export const CIEL_MIN: number
export const CIEL_MAX: number

export function odhadTokenov(s: string): number

export interface Chunk {
  chunkIndex: number
  text: string
  heading: string
  articleRef: string | null
  typ?: "clanok" | "priloha" | "preambula"
  obsahujeTabulku?: boolean
  uplnaJednotka?: boolean
}

export interface Statistiky {
  riadkovPoOcisteni: number
  odstranene: { hlavicka: number; cisloStrany: number; poznamka: number; prazdne: number }
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

export function ocisti(
  text: string,
  meta?: { nazovDokumentu?: string },
): { riadky: string[]; odstranene: Statistiky["odstranene"] }

export function parsujStrukturu(riadky: string[]): unknown[]

export function chunkuj(
  text: string,
  meta?: { nazovDokumentu?: string },
): { chunky: Chunk[]; statistiky: Statistiky }
