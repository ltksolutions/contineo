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

/**
 * Pomenovaný profil členenia (D79).
 *
 * **Prečo pomenovaný a nie vlastné hodnoty na každom dokumente.** Ad-hoc
 * nastavenie na dokumente je opačný extrém než jeden profil na organizáciu:
 * o pol roka nikto nevie povedať, prečo sú dva podobné predpisy narezané inak,
 * a oprava chunkera sa musí premietnuť do N kópií. Pomenovaný profil sa opraví
 * na jednom mieste a je vidieť, koľko dokumentov ho používa.
 *
 * Dôsledok, ktorý je vlastnosťou a nie obmedzením: keď dokument nesadne ani
 * jednému profilu, **vzniká nový pomenovaný profil**. Odchýlka sa tým zapíše
 * raz, s menom a viditeľne.
 *
 * `key` je identita (nemenná, `KEY_PATTERN`), `label` je menovka pre človeka
 * a dá sa premenovať kedykoľvek. **Ani jedno nevstupuje do odtlačku členenia** —
 * hashuje sa výhradne to, čo vráti `toChunkerProfile()`, takže premenovanie
 * profilu nikdy nespôsobí preindexovanie.
 */
export interface ChunkingProfileDef extends ChunkingProfile {
  key: string
  label: string
}

/**
 * Kľúč profilu, ktorý dostane dokument bez vlastného zaradenia.
 *
 * Je zámerne bez domény („základný", nie „predpis SFZ") — vzniká migráciou
 * v každej organizácii a jej obsah nepozná. Premenovať sa dá `label`, kľúč nie:
 * ukazujú naň dokumenty.
 */
export const DEFAULT_PROFILE_KEY = "zakladny"

/**
 * Ktorý profil platí pre dokument.
 *
 * Reťaz je zámerne štvorčlánková a každý článok má dôvod:
 *
 * 1. **profil dokumentu** — to, čo kurátor rozhodol;
 * 2. **základný profil organizácie** — keď dokument nemá vlastný;
 * 3. **`tenant.chunking`** — organizácia spred D79, ktorá ešte nemá profily.
 *    Bez tohto článku by po nasadení začali všetky jej dokumenty rezať
 *    predvolenými hodnotami namiesto jej vlastného nastavenia, a prejavilo by
 *    sa to až tým, že model odcituje nesprávny článok;
 * 4. **`undefined`** — chunker si doplní vlastné predvolené hodnoty. Vrátiť
 *    tu `DEFAULT_CHUNKING` by nebolo to isté: prázdny profil má iný odtlačok
 *    než profil, ktorý chýba úplne (viď `toChunkerProfile()`).
 */
export function chunkingFor(
  tenant: {
    chunkingProfiles?: ChunkingProfileDef[]
    chunking?: Partial<ChunkingProfile>
  } | null | undefined,
  documentProfileKey?: string | null,
): Partial<ChunkingProfile> | undefined {
  const profiles = tenant?.chunkingProfiles ?? []
  const wanted = (documentProfileKey ?? "").trim()

  const found = wanted ? profiles.find(p => p.key === wanted) : undefined
  const base = found ?? profiles.find(p => p.key === DEFAULT_PROFILE_KEY)
  if (base) {
    // Kľúč ani menovka do chunkera nepatria — a hlavne nesmú do odtlačku.
    const { key: _key, label: _label, ...params } = base
    return params
  }

  return tenant?.chunking
}

/**
 * Profil, z ktorého sa dá spraviť menovka na obrazovku.
 *
 * Vracia aj vtedy, keď profil neexistuje — dokument, ktorý ukazuje na
 * zmazaný kľúč, sa má dať nájsť, nie zmiznúť zo zoznamu.
 */
export function profileLabel(
  profiles: ChunkingProfileDef[] | undefined,
  key: string | null | undefined,
): string | null {
  const wanted = (key ?? "").trim()
  if (!wanted) return null
  return (profiles ?? []).find(p => p.key === wanted)?.label ?? wanted
}
