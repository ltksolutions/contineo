/**
 * queryClassifier.ts
 * Rozhoduje ktorý search engine použiť pre daný prompt.
 * Primárne: rýchla heuristika bez LLM (bez nákladov, < 1ms).
 * Voliteľne: lokálny LLM pre presnejšiu klasifikáciu.
 */

export type SearchMode = "fulltext" | "vector" | "hybrid"

// ── Heuristická klasifikácia (bez LLM) ─────────────────────────────────────

const FULLTEXT_PATTERNS = [
  /§\s*\d+/,                          // paragrafy: § 15, § 3 ods. 2
  /\b(STN|EN|ISO|IEC)\s*[\d\-]+/i,    // kódy noriem: STN EN ISO 9001
  /\b\d{4}\b/,                        // roky: 2026, 2025
  /\b(ods\.|odst\.|písm\.|čl\.)/i,    // právne skratky
  /www\.|\.sk|\.cz|\.eu/i,            // URL
  /\b[A-Z]{2,6}\d{2,}/,              // kódy: FIFA123, UEFA21
]

const VECTOR_MIN_WORDS = 8   // dlhý prirodzený jazyk → vector
const FULLTEXT_MAX_WORDS = 3 // krátky presný výraz → fulltext

export function classifyByHeuristic(query: string): SearchMode {
  const words = query.trim().split(/\s+/).length

  // Presné vzory → fulltext
  if (FULLTEXT_PATTERNS.some(p => p.test(query))) return "fulltext"

  // Veľmi krátky dotaz → fulltext (kľúčové slová, kódy)
  if (words <= FULLTEXT_MAX_WORDS) return "fulltext"

  // Dlhý prirodzený jazyk → vector (sémantika)
  if (words >= VECTOR_MIN_WORDS) return "vector"

  // Stred → hybrid (najspoľahlivejší pre nejednoznačné dotazy)
  return "hybrid"
}

// ── LLM klasifikácia (presnejšia, voliteľná) ────────────────────────────────

const LLM_CLASSIFY_PROMPT = `Si klasifikátor vyhľadávacích dotazov. Odpovedaj VÝLUČNE jedným slovom.

Pravidlá:
- "fulltext" → presné výrazy, kódy noriem (STN, ISO), paragrafy (§), čísla, skratky, vlastné mená
- "vector"   → dlhé otázky v prirodzenom jazyku, sémantické dotazy, "čo", "ako", "prečo"
- "hybrid"   → kombinácia oboch, nejednoznačné dotazy

Dotaz: "{query}"
Odpoveď:`

export async function classifyByLLM(query: string): Promise<SearchMode> {
  try {
    const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",          // rýchly lokálny model, stačí 1 token
        prompt: LLM_CLASSIFY_PROMPT.replace("{query}", query),
        stream: false,
        options: { temperature: 0, num_predict: 5 },
      }),
      signal: AbortSignal.timeout(2000), // max 2s, inak fallback na heuristiku
    })

    if (!response.ok) throw new Error("Ollama unavailable")

    const data = await response.json()
    const raw = (data.response as string).trim().toLowerCase()

    if (raw.includes("fulltext")) return "fulltext"
    if (raw.includes("vector"))   return "vector"
    if (raw.includes("hybrid"))   return "hybrid"

    return classifyByHeuristic(query) // fallback ak LLM odpovie nezmysel
  } catch {
    // LLM nedostupný → heuristika
    return classifyByHeuristic(query)
  }
}

// ── Hlavný export ────────────────────────────────────────────────────────────

export async function classifyQuery(
  query: string,
  useLLM = false
): Promise<SearchMode> {
  if (useLLM) return classifyByLLM(query)
  return classifyByHeuristic(query)
}
