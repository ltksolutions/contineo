/**
 * chunkingProfile.ts — profil členenia po anglicky, chunker po svojom.
 *
 * `chunker.mjs` je zámerne nedotknutý (viď hlavičku toho súboru) a jeho
 * parametre sa volajú `slovoClanok`, `slovoPriloha`, `opakovaniHlavicky`.
 * Sú to **jeho** názvy — nie názvy, ktoré chceme mať v databáze a vo
 * zvyšku aplikácie. Preklad je preto na jednom mieste: tu.
 *
 * **Prečo to nestačí premenovať aj v chunkeri:** algoritmus je odladený na
 * deviatich skutočných predpisoch a tichá zmena členenia sa prejaví až tým,
 * že model odcituje nesprávny článok. Adaptér je lacnejší než ten risk.
 *
 * **Pozor na odtlačok.** `chunkingFingerprint()` hashuje profil tak, ako ho
 * dostane. Keby sa doň dostala anglická podoba, zmenil by sa odtlačok
 * každého dokumentu a celá knižnica by naraz vyzerala ako „narezaná inak“ —
 * hoci by sa v texte nezmenilo nič. Preto sa fingerprintuje **vždy** to, čo
 * vráti `toChunkerProfile()`.
 */

import { DEFAULT_PROFILE } from "./chunker.mjs"

/** Profil členenia tak, ako ho vidí databáza a aplikácia. */
export interface ChunkingProfile {
  /** Slovo, ktorým začína článok — napr. `Článok`, `§`, `Bod`. */
  articleWord: string
  /** Slovo, ktorým začína príloha. */
  annexWord: string
  /** Riadok opakovaný viac ráz je hlavička alebo päta. */
  headerRepeats: number
  /** Cieľová veľkosť úseku v tokenoch — od. */
  minTokens: number
  /** Cieľová veľkosť úseku v tokenoch — do. */
  maxTokens: number
}

/** Predvolený profil v anglickej podobe. Hodnoty sú z chunkera, nie vedľa neho. */
export const DEFAULT_CHUNKING: ChunkingProfile = {
  articleWord: DEFAULT_PROFILE.slovoClanok,
  annexWord: DEFAULT_PROFILE.slovoPriloha,
  headerRepeats: DEFAULT_PROFILE.opakovaniHlavicky,
  minTokens: DEFAULT_PROFILE.cielMinTokenov,
  maxTokens: DEFAULT_PROFILE.cielMaxTokenov,
}

/**
 * Prevedie profil do tvaru, ktorému rozumie `chunker.mjs`.
 *
 * Nevyplnené položky sa **nedopĺňajú** predvolenými — chunker si ich doplní
 * sám (`{ ...DEFAULT_PROFILE, ...profile }`) a keby sme ich doplnili aj tu,
 * dostal by prázdny profil iný odtlačok než profil, ktorý chýba úplne.
 */
export function toChunkerProfile(
  profile?: Partial<ChunkingProfile> | null,
): Record<string, string | number> | undefined {
  if (!profile) return undefined
  const out: Record<string, string | number> = {}
  if (profile.articleWord !== undefined) out.slovoClanok = profile.articleWord
  if (profile.annexWord !== undefined) out.slovoPriloha = profile.annexWord
  if (profile.headerRepeats !== undefined) out.opakovaniHlavicky = profile.headerRepeats
  if (profile.minTokens !== undefined) out.cielMinTokenov = profile.minTokens
  if (profile.maxTokens !== undefined) out.cielMaxTokenov = profile.maxTokens
  return Object.keys(out).length > 0 ? out : undefined
}
