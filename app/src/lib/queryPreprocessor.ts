/**
 * queryPreprocessor.ts
 * Voliteľný LLM preprocessing vstupného promptu pred vyhľadávaním.
 * Spúšťa sa iba pre hybrid/vector mód a dlhé/zložité dotazy.
 * Primárny: Ollama (lokálny). Fallback: Claude API.
 */

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

// ── Ollama preprocessing (lokálny, preferovaný) ──────────────────────────────

async function preprocessByOllama(query: string): Promise<PreprocessedQuery> {
  const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.2",
      prompt: PREPROCESS_PROMPT.replace("{query}", query),
      stream: false,
      options: { temperature: 0.1, num_predict: 200 },
    }),
    signal: AbortSignal.timeout(5000),
  })

  if (!response.ok) throw new Error("Ollama nedostupný")

  const data = await response.json()
  const raw = (data.response as string).trim()
  return JSON.parse(raw) as PreprocessedQuery
}

// ── Claude API preprocessing (fallback) ─────────────────────────────────────

async function preprocessByClaude(query: string): Promise<PreprocessedQuery> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",   // najrýchlejší/najlacnejší model
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: PREPROCESS_PROMPT.replace("{query}", query),
        }
      ],
    }),
  })

  if (!response.ok) throw new Error("Claude API nedostupný")

  const data = await response.json()
  const raw = data.content[0].text.trim()
  return JSON.parse(raw) as PreprocessedQuery
}

// ── Hlavný export ────────────────────────────────────────────────────────────

const SHORT_QUERY_WORDS = 4  // krátke dotazy nepredspracovávame

export async function preprocessQuery(
  query: string
): Promise<PreprocessedQuery> {
  // Krátke dotazy nepotrebujú preprocessing
  if (query.trim().split(/\s+/).length <= SHORT_QUERY_WORDS) {
    return { rewritten: query, subQueries: [], keywords: [] }
  }

  try {
    return await preprocessByOllama(query)
  } catch {
    try {
      return await preprocessByClaude(query)
    } catch {
      // Ak oboje zlyhá, vrátime pôvodný dotaz
      return { rewritten: query, subQueries: [], keywords: [] }
    }
  }
}
