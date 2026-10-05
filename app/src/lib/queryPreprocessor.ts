/**
 * queryPreprocessor.ts
 * Voliteľný preprocessing vstupného promptu pred vyhľadávaním.
 * Spúšťa sa iba pre hybrid/vector mód a dlhé/zložité dotazy.
 *
 * Model sa volí utility adaptérom z profilu tenanta (ADR-001) —
 * zámerne lacnejším než ten, ktorý tvorí odpoveď.
 */

import type { GenerationProvider, CompleteOptions } from "./providers/types"
import { parseModelTime } from "./queryTime"
import type { QueryTime } from "./queryTime"
import { calendarDate } from "./versionContext"

export interface PreprocessedQuery {
  rewritten: string        // vyčistený/prepísaný dotaz
  subQueries: string[]     // pod-otázky pre decomposition
  keywords: string[]       // kľúčové pojmy pre fulltext boost
  /**
   * Ku ktorému dňu sa otázka pýta — záloha za pravidlá `queryTime.ts` pre
   * formulácie, ktoré pravidlá nepokryjú („pred poslednou novelou").
   * `null` = model nič nenašiel alebo vrátil nezmysel.
   */
  time: QueryTime | null
}

const PREPROCESS_PROMPT = `Spracuj nasledujúci vyhľadávací dotaz. Odpovedaj VÝLUČNE vo formáte JSON bez markdown blokov.

Dotaz: "{query}"

Vráť JSON objekt s týmito poľami:
{
  "rewritten": "prepísaný a vyčistený dotaz v prirodzenom slovenskom jazyku",
  "subQueries": ["pod-otázka 1", "pod-otázka 2"],
  "keywords": ["kľúčový pojem 1", "kľúčový pojem 2"],
  "time": { "kind": "today", "date": null }
}

Pravidlá:
- rewritten: oprav preklepy, doplň kontext, zachovaj pôvodný zámer
- subQueries: max 3, iba ak je dotaz zložený z viacerých otázok, inak prázdne pole
- keywords: 3-6 najdôležitejších pojmov pre fulltext vyhľadávanie
- time.kind: "asOf", len ak sa dotaz výslovne pýta na stav k inému dňu alebo roku (minulému či budúcemu); "compare", ak sa pýta, čo sa zmenilo alebo aký je rozdiel medzi zneniami; inak "today"
- time.date: pri "asOf" dátum v tvare RRRR-MM-DD, pri roku bez dňa 31. 12. toho roka; inak null. Dnes je {today}.
- rewritten: časový údaj z dotazu vynechaj, rieši ho time`

// ── Parsovanie odpovede modelu ───────────────────────────────────────────────

/**
 * Modely radi zabalia JSON do markdown bloku, aj keď sa im to zakáže.
 * Preto sa pred parsovaním odstráni obal a vyberie sa prvý objekt.
 */
export function parsePreprocessed(raw: string, fallbackQuery: string, now: Date = new Date()): PreprocessedQuery {
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
    time: parseModelTime(parsed.time, now),
  }
}

// ── Hlavný export ────────────────────────────────────────────────────────────

const SHORT_QUERY_WORDS = 4  // krátke dotazy nepredspracovávame

/**
 * Strop na prepis. Platí sa zaň priamo v čase po prvý token, takže
 * pomalý prepis sa nečaká — ide sa s pôvodnou otázkou a dátum zachytia
 * pravidlá (`detectQueryTime`). Bolo 5 s. 1,5 s by bolo príliš: na 23
 * prepisoch (15.–29. 9. 2026) trvalo 9 dlhšie, takže by sa zahodil pri
 * ~40 % otázok. Pri 2,5 s je to jeden z 23 a odreže sa chvost až do 5 s.
 */
export const PREPROCESS_TIMEOUT_MS = 2500

/** Bezpečný výsledok, keď sa preprocessing nepodarí — pôvodný dotaz bez zmeny. */
const passthrough = (query: string): PreprocessedQuery =>
  ({ rewritten: query, subQueries: [], keywords: [], time: null })

/**
 * Prepis dotazu pred vyhľadávaním. Beží na utility adaptéri (ADR-001),
 * teda na lacnejšom modeli než samotná odpoveď.
 *
 * Zlyhanie nikdy nezhodí dotaz — vráti sa pôvodné znenie. Horší prepis
 * je prijateľný, žiadna odpoveď nie je.
 */
export async function preprocessQuery(
  query: string,
  provider?: GenerationProvider,
  now: Date = new Date(),
  /** Spotreba do výkazu (D158) — volajúci vie, kto sa pýta. */
  onUsage?: CompleteOptions["onUsage"],
): Promise<PreprocessedQuery> {
  if (query.trim().split(/\s+/).length <= SHORT_QUERY_WORDS) return passthrough(query)
  if (!provider) return passthrough(query)

  try {
    const raw = await provider.complete(
      PREPROCESS_PROMPT.replace("{query}", query).replace("{today}", calendarDate(now).toISOString().slice(0, 10)),
      { maxTokens: 256, timeoutMs: PREPROCESS_TIMEOUT_MS, onUsage }
    )
    return parsePreprocessed(raw, query, now)
  } catch {
    return passthrough(query)
  }
}
