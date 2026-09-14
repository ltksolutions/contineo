/**
 * chunkingAnalysis.ts — ktorý profil členenia sedí na tento text (D79, etapa 2).
 *
 * ## Čo to robí a čo zámerne nerobí
 *
 * **Navrhuje, nerozhoduje.** Vráti poradie profilov so skóre a s vetou, prečo —
 * a človek potvrdí. Je to tá istá zásada ako pri uložení profilu (D58) a pri
 * kontrole konzistencie (D59): oprava je vždy rozhodnutie, a skript, ktorý „to
 * spraví za teba", pri prvej nečakanej odchýlke prereže knižnicu inak, než
 * niekto chcel.
 *
 * **Bez jazykového modelu a bez databázy.** Signály sú spočítateľné riadky:
 * koľkokrát text začína slovom článku, koľko je odsekov, koľko nadpisov. Model
 * by na tom nepridal nič okrem ceny a nezopakovateľnosti — a hlavne by sa nedal
 * otestovať. Ak raz bude treba druhý názor pri sporných prípadoch, príde ako
 * samostatná vrstva nad týmto, nie namiesto neho.
 *
 * ## Prečo skóre a nie „áno/nie"
 *
 * Dokument, ktorý má 3 % riadkov ako články, nie je „článkový so šumom" — je to
 * dokument, ktorý chunker nerozpozná, a to treba vedieť **predtým**, než sa
 * naimportuje. Preto sa vracia číslo aj prah, nie verdikt.
 */

/** Čo sa v texte našlo. Čísla, nie dojmy — aby sa dali ukázať človeku. */
export interface StructureSignals {
  /** Riadkov spolu (neprázdnych). */
  lines: number
  /** Riadkov v tvare `Článok 5` alebo `Článok 5 - Názov`. */
  articleWord: number
  /** Riadkov v tvare `§ 5`. */
  paragraphSign: number
  /** Riadkov v tvare `Bod 5`. */
  pointWord: number
  /** Riadkov v tvare `(3) …` — odseky vnútri článkov. */
  numberedParagraphs: number
  /** Nadpisy Markdownu (`#`, `##`, …). */
  markdownHeadings: number
  /** Riadkov, ktoré sa opakujú viac než dvakrát — hlavičky a päty z PDF. */
  repeatedLines: number
}

/** Jeden návrh. `score` je podiel riadkov, ktoré vzor chytil. */
export interface ProfileSuggestion {
  /** Kľúč predvoleného profilu, ktorý tomuto vzoru zodpovedá. */
  key: string
  /** Slovo článku, ktoré by profil mal mať. `null` pre voľný text. */
  articleWord: string | null
  /** Podiel riadkov 0–1. */
  score: number
  /** Koľko riadkov vzor chytil. */
  hits: number
}

export interface ChunkingAnalysis {
  signals: StructureSignals
  /** Najlepší návrh prvý. Vždy neprázdne — posledný je „voľný text". */
  suggestions: ProfileSuggestion[]
  /** Prekročil najlepší návrh prah? Keď nie, je to dokument bez členenia. */
  confident: boolean
}

/**
 * Prah, nad ktorým sa vzor považuje za členenie dokumentu.
 *
 * **Je to podiel, nie počet.** Desať článkov v päťstranovom predpise je členenie;
 * desať článkov v trojstovkovej zmluve, kde sa slovo „článok" vyskytuje v texte,
 * je náhoda. Hodnota je nízka zámerne: predpisy SFZ majú okolo 2–6 % riadkov ako
 * hlavičky článkov (overené na deviatich) — zvyšok sú odseky pod nimi.
 */
export const STRUCTURE_THRESHOLD = 0.005

/** Kľúč profilu pre dokument, na ktorý štruktúrny chunker nestačí. */
export const PLAIN_PROFILE_KEY = "volny_text"

const ARTICLE = /^Článok\s+\d+[a-z]?\b/
const PARAGRAPH_SIGN = /^§\s*\d+[a-z]?\b/
const POINT = /^Bod\s+\d+[a-z]?\b/
const NUMBERED = /^\(\d+\)\s/
const HEADING = /^#{1,6}\s+\S/

/**
 * Spočíta, čo v texte je. Čistá funkcia — žiadny vstup okrem textu.
 *
 * Počítajú sa **neprázdne riadky**: prázdne sú formátovanie a pri PDF ich býva
 * polovica súboru, takže by podiel zriedili na nezmysel.
 */
export function structureSignals(markdown: string): StructureSignals {
  const all = String(markdown ?? "").split(/\r?\n/).map(l => l.trim())
  const lines = all.filter(Boolean)

  const seen = new Map<string, number>()
  for (const l of lines) seen.set(l, (seen.get(l) ?? 0) + 1)

  return {
    lines: lines.length,
    articleWord: lines.filter(l => ARTICLE.test(l)).length,
    paragraphSign: lines.filter(l => PARAGRAPH_SIGN.test(l)).length,
    pointWord: lines.filter(l => POINT.test(l)).length,
    numberedParagraphs: lines.filter(l => NUMBERED.test(l)).length,
    markdownHeadings: lines.filter(l => HEADING.test(l)).length,
    repeatedLines: [...seen.values()].filter(n => n > 2).reduce((a, b) => a + b, 0),
  }
}

/**
 * Poradie profilov podľa toho, čo v texte skutočne je.
 *
 * Posledný návrh je **vždy** „voľný text" a nemá skóre z riadkov: nie je to
 * vzor, ktorý by sa dal spočítať, ale to, čo zostane, keď žiadny vzor nesedí.
 * Keby chýbal, analyzátor by pri manuáli vrátil prázdno — a prázdno sa na
 * obrazovke nedá potvrdiť ani odmietnuť.
 */
export function analyseChunking(markdown: string): ChunkingAnalysis {
  const signals = structureSignals(markdown)
  const total = Math.max(signals.lines, 1)

  const candidates: ProfileSuggestion[] = [
    { key: "sfz_predpis", articleWord: "Článok", hits: signals.articleWord, score: signals.articleWord / total },
    { key: "zakon", articleWord: "§", hits: signals.paragraphSign, score: signals.paragraphSign / total },
    { key: "body", articleWord: "Bod", hits: signals.pointWord, score: signals.pointWord / total },
  ]
    .filter(c => c.hits > 0)
    .sort((a, b) => b.score - a.score)

  const best = candidates[0]
  const confident = Boolean(best && best.score >= STRUCTURE_THRESHOLD && best.hits >= 3)

  return {
    signals,
    suggestions: [
      ...candidates,
      { key: PLAIN_PROFILE_KEY, articleWord: null, hits: 0, score: 0 },
    ],
    confident,
  }
}

/**
 * Veta pre človeka — čo sa našlo a prečo to vedie k tomuto návrhu.
 *
 * Zámerne **v knižnici, nie v obrazovke**: tú istú vetu potrebuje aj dávkový
 * skript, ktorý beží v termináli. Dve formulácie toho istého by sa rozišli
 * presne vtedy, keď sa podľa nich niekto rozhoduje.
 */
export function analysisReason(a: ChunkingAnalysis): string {
  const s = a.signals
  const best = a.suggestions[0]

  if (!a.confident) {
    return `Žiadne štruktúrne členenie: ${s.lines} riadkov, ` +
      `${s.articleWord}× „Článok", ${s.paragraphSign}× „§", ${s.pointWord}× „Bod", ` +
      `${s.markdownHeadings} nadpisov. Štruktúrny chunker tu nemá čoho chytiť.`
  }

  const percent = (best.score * 100).toFixed(1)
  return `${best.hits} hlavičiek vzoru „${best.articleWord}" z ${s.lines} riadkov (${percent} %), ` +
    `${s.numberedParagraphs} očíslovaných odsekov` +
    (s.repeatedLines > 0 ? `, ${s.repeatedLines} opakovaných riadkov (hlavičky a päty)` : "") +
    "."
}
