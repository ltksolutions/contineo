/**
 * providers/rerank/http.ts
 *
 * Rerank cez HTTP službu — TEI alebo Infinity (ADR-001, krok 4).
 *
 * Na rozdiel od cloudu, kde `$rerank` beží ako stage priamo v agregačnej
 * pipeline, tu sa reranking robí AŽ NAD výsledkom $rankFusion, v aplikačnej
 * vrstve. Kandidátov drž rovnako veľa ako v cloude (limit z SearchOptions),
 * aby boli oba režimy porovnateľné na eval sade D9.
 *
 * Tvary API sa líšia:
 *   TEI       POST {url}/rerank  { query, texts: [...], raw_scores: false }
 *             -> [{ index, score }]
 *   Infinity  POST {url}/rerank  { model, query, documents: [...], top_n, return_documents: false }
 *             -> { results: [{ index, relevance_score }] }
 */

import { ChunkResult } from "../../mongoSearch"
import { RerankConfig, RerankProvider, ProviderConfigError } from "../types"

export interface RerankScore { index: number; score: number }

export class HttpRerankProvider implements RerankProvider {
  readonly kind: "tei" | "infinity"
  readonly model?: string
  readonly isPipelineStage = false
  private url: string
  private apiKey?: string

  constructor(cfg: RerankConfig) {
    if (cfg.kind !== "tei" && cfg.kind !== "infinity") {
      throw new ProviderConfigError(`HttpRerankProvider nepodporuje kind="${cfg.kind}"`)
    }
    if (!cfg.url) throw new ProviderConfigError(`rerank.kind="${cfg.kind}" vyžaduje url`)
    this.kind = cfg.kind
    this.url = cfg.url.replace(/\/+$/, "")
    this.model = cfg.model
    this.apiKey = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : undefined
  }

  async rerank(query: string, candidates: ChunkResult[], topK: number): Promise<ChunkResult[]> {
    if (candidates.length === 0) return []
    // Jeden kandidát netreba prehadzovať — ušetríme volanie siete.
    if (candidates.length === 1) return candidates.slice(0, topK)

    const texts = candidates.map(c => c.text)
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`

    const body = this.kind === "tei"
      ? { query, texts, raw_scores: false }
      : { model: this.model, query, documents: texts, top_n: topK, return_documents: false }

    const res = await fetch(`${this.url}/rerank`, {
      method: "POST", headers, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`${this.kind} rerank ${res.status}: ${detail.slice(0, 300)}`)
    }

    const scores = this.kind === "tei"
      ? parseTeiRerank(await res.json())
      : parseInfinityRerank(await res.json())

    return applyScores(candidates, scores, topK)
  }
}

/** TEI vracia pole { index, score }. */
export function parseTeiRerank(raw: unknown): RerankScore[] {
  if (!Array.isArray(raw)) throw new Error("TEI rerank: očakávalo sa pole výsledkov")
  return raw.map((r: any) => ({ index: Number(r.index), score: Number(r.score) }))
}

/** Infinity vracia { results: [{ index, relevance_score }] }. */
export function parseInfinityRerank(raw: any): RerankScore[] {
  const results = raw?.results
  if (!Array.isArray(results)) throw new Error("Infinity rerank: v odpovedi chýba pole results")
  return results.map((r: any) => ({ index: Number(r.index), score: Number(r.relevance_score) }))
}

/**
 * Preusporiada kandidátov podľa skóre a oreže na topK.
 *
 * Skóre sa zapisuje do chunku, aby ho videl aj eval runner — hodnotí sa
 * podľa neho eskalácia pri slabej zhode.
 *
 * Index mimo rozsahu sa ignoruje: radšej vrátiť menej výsledkov než spadnúť
 * alebo, čo je horšie, tíško posunúť poradie o jedna.
 */
export function applyScores(
  candidates: ChunkResult[],
  scores: RerankScore[],
  topK: number
): ChunkResult[] {
  const valid = scores.filter(
    s => Number.isInteger(s.index) && s.index >= 0 && s.index < candidates.length
      && Number.isFinite(s.score)
  )
  if (valid.length === 0) return candidates.slice(0, topK)

  return valid
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => ({ ...candidates[s.index], score: s.score }))
}
