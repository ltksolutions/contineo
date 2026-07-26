/**
 * queryPreprocessor.ts
 * Voliteľný preprocessing vstupného promptu pred vyhľadávaním.
 * Spúšťa sa iba pre hybrid/vector mód a dlhé/zložité dotazy.
 *
 * Model sa volí utility adaptérom z profilu tenanta (ADR-001) —
 * zámerne lacnejším než ten, ktorý tvorí odpoveď.
 */

import { GenerationProvider } from "./providers/types"

export interface PreprocessedQuery {
  rewritten: string        // vyčistený/prepísaný dotaz
  subQueries: string[]     // pod-otázky pre decomposition
  keywords: string[]       // kľúčové pojmy pre fulltext boost
}

const PREPROCESS_PROMPT = `Spracuj nasledujúci vyhľadávací dotaz. Odpovedaj VÝLUČNE vo formáte JSON bez markdown blokov.

Dotaz: "{query}"

Vráť JSON objekt s týmito poľami:
{
  "rewritten": "prepísaný a vyčistený dotaz v prirodzenom slovenskom jazyku",
  "subQueries": ["pod-otázka 1", "pod-otázka 2"],
  "keywords": ["kľúčový pojem 1", "kľúčový pojem 2"]
}

Pravidlá:
- rewritten: oprav preklepy, doplň kontext, zachovaj pôvodný zámer
- subQueries: max 3, iba ak je dotaz zložený z viacerých otázok, inak prázdne pole
- keywords: 3-6 najdôležitejších pojmov pre fulltext vyhľadávanie`

// ── Parsovanie odpovede modelu ───────────────────────────────────────────────

/**
 * Modely radi zabalia JSON do markdown bloku, aj keď sa im to zakáže.
 * Preto sa pred parsovaním odstráni obal a vyberie sa prvý objekt.
 */
export function parsePreprocessed(raw: string, fallbackQuery: string): PreprocessedQuery {
  let t = raw.trim()

  // ```json ... ``` alebo ``` ... ```
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) t = fence[1].trim()

  // Text okolo objektu — vezmeme od prvej { po poslednú }
  const first = t.indexOf("{")
  const last = t.lastIndexOf("}")
  if (first >= 0 && last > first) t = t.slice(first, last + 1)

  const parsed = JSON.parse(t)

  const rewritten = typeof parsed.rewritten === "string" && parsed.rewritten.trim()
    ? parsed.rewritten.trim()
    : fallbackQuery

  const asStrings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []

  return {
    rewritten,
    subQueries: asStrings(parsed.subQueries).slice(0, 3),
    keywords: asStrings(parsed.keywords).slice(0, 6),
  }
}

// ── Hlavný export ────────────────────────────────────────────────────────────

const SHORT_QUERY_WORDS = 4  // krátke dotazy nepredspracovávame

/** Bezpečný výsledok, keď sa preprocessing nepodarí — pôvodný dotaz bez zmeny. */
const passthrough = (query: string): PreprocessedQuery =>
  ({ rewritten: query, subQueries: [], keywords: [] })

/**
 * Prepis dotazu pred vyhľadávaním. Beží na utility adaptéri (ADR-001),
 * teda na lacnejšom modeli než samotná odpoveď.
 *
 * Zlyhanie nikdy nezhodí dotaz — vráti sa pôvodné znenie. Horší prepis
 * je prijateľný, žiadna odpoveď nie je.
 */
export async function preprocessQuery(
  query: string,
  provider?: GenerationProvider
): Promise<PreprocessedQuery> {
  if (query.trim().split(/\s+/).length <= SHORT_QUERY_WORDS) return passthrough(query)
  if (!provider) return passthrough(query)

  try {
    const raw = await provider.complete(
      PREPROCESS_PROMPT.replace("{query}", query),
      { maxTokens: 256, temperature: 0.1, timeoutMs: 5000 }
    )
    return parsePreprocessed(raw, query)
  } catch {
    return passthrough(query)
  }
}
