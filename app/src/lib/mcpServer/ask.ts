/**
 * ask.ts — nástroj `ask`: celá odpoveď Continea v jednom volaní (ADR-038).
 *
 * Ten istý postup ako `/ask` a widget — `chatStream()`: klasifikácia,
 * prepis, hybridné hľadanie, rerank, generovanie s citáciami. Rozdiel je
 * len v tom, že MCP klient nečíta SSE po kúskoch; stream sa tu **pozbiera
 * do jednej odpovede**. Platí to organizácia (kľúč AI, ADR-026) — na
 * rozdiel od `search_library`, kde z úsekov píše model klienta.
 *
 * Odpoveď sa zapíše do `evaluations` (`recordAnswer`) ako otázka z webu:
 * história otázok človeka ju ukáže a hodnotiteľ ju vie posúdiť.
 */

import { chatStream, type ChatStreamInput } from "../chatStream"
import { recordAnswer } from "../ratings"
import type { AnswerSource } from "../sseClient"
import type { SearchedScope } from "../askScope"

export interface AskOutcome {
  answer: string
  sources: AnswerSource[]
  model: string
  provider: string
  /** Ku ktorému dňu sa odpovedalo (ADR-024). */
  asOf?: string
  /** Organizácia nemá k tomu dňu žiadne platné znenie. */
  noVersions: boolean
  /** Konektory, ktoré nestihli — odpoveď je bez nich (D174). */
  liveFailed?: string[]
  error?: string
  /** Identifikátor záznamu v `evaluations`, keď sa zapísal. */
  recordedId?: string
}

/** Najdlhšie, čo sa na odpoveď čaká — kratšie než `maxDuration` route. */
export const ASK_TIMEOUT_MS = 50_000

export async function askOnce(
  input: ChatStreamInput,
  timeoutMs = ASK_TIMEOUT_MS,
  /** V čom sa hľadalo — kópia názvov do záznamu, ako na `/ask` (ADR-040). */
  searchedScope?: SearchedScope,
): Promise<AskOutcome> {
  const startedAt = Date.now()
  const out: AskOutcome = { answer: "", sources: [], model: "", provider: "", noVersions: false }
  const citations: unknown[] = []
  let done: Record<string, unknown> | null = null
  let firstTokenAt: number | null = null

  const reader = chatStream(input).getReader()
  const dec = new TextDecoder()
  let buffer = ""
  const timer = setTimeout(() => { void reader.cancel().catch(() => {}) }, timeoutMs)
  try {
    for (;;) {
      const { value, done: finished } = await reader.read()
      if (finished) break
      buffer += dec.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""
      for (const part of parts) {
        const line = part.split("\n").find(l => l.startsWith("data: "))
        if (!line) continue
        let ev: Record<string, unknown>
        try { ev = JSON.parse(line.slice(6)) } catch { continue }
        if (ev.type === "token") { out.answer += String(ev.token ?? ""); firstTokenAt ??= Date.now() }
        else if (ev.type === "citation") citations.push(ev.citation)
        else if (ev.type === "meta") {
          if (Array.isArray(ev.liveFailed)) out.liveFailed = ev.liveFailed.map(String)
        }
        else if (ev.type === "error") out.error = String(ev.message ?? "")
        else if (ev.type === "done") done = ev
      }
    }
  } finally {
    clearTimeout(timer)
  }
  if (!done && !out.error) out.error = "timeout"
  if (done) {
    out.sources = Array.isArray(done.sources) ? (done.sources as AnswerSource[]) : []
    out.model = String(done.model ?? "")
    out.provider = String(done.provider ?? "")
    out.asOf = typeof done.asOf === "string" ? done.asOf : undefined
    out.noVersions = Boolean(done.noVersions)
    if (out.answer.trim() && out.sources.length) {
      try {
        out.recordedId = await recordAnswer({
          question: input.query, answer: out.answer, sources: out.sources, citations: citations as never,
          model: out.model, provider: out.provider, verifiedCitations: Boolean(done.verifiedCitations),
          ttftMs: firstTokenAt ? firstTokenAt - startedAt : null, totalMs: Date.now() - startedAt,
          timings: done.timings as never, tokens: done.tokens as never, cost: done.cost as never, time: done.time as never,
          searchedScope: searchedScope ?? { library: !input.only || input.only.includes("library"), live: [] },
        }, input.usageActor.personId, input.companyCode, input.accessLevel)
      } catch (e) {
        console.error("[mcp] zápis odpovede zlyhal:", e)
      }
    }
  }
  return out
}
