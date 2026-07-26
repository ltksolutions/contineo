/**
 * providers/generation/anthropic.ts
 *
 * Natívny adaptér na Anthropic Messages API. Zámerne NEIDE cez
 * OpenAI-kompatibilnú vrstvu — stratili by sme dve veci, ktoré sú pre
 * Contineo podstatné (ADR-001, sekcia 2):
 *
 *   1. Citations API — model vracia overiteľné odkazy na vety v zdrojoch.
 *      Garantuje platný ukazovateľ; nedá sa vymyslieť [7], keď sme poslali
 *      päť chunkov. Pri prahu D9 „presnosť citácie ≥ 85 %" to nie je detail.
 *      `cited_text` sa neráta do output tokenov.
 *
 *   2. Prompt caching — cache_control na systémovom prompte. Pri konverzácii
 *      s históriou je to rozdiel rádovo 2–3× v cene za dotaz.
 */

import { ChunkResult } from "../../mongoSearch"
import {
  GenerationConfig, GenerationProvider, GenerationRequest, GenerationEvent,
  CompleteOptions, ProviderConfigError,
} from "../types"

const API_URL = "https://api.anthropic.com/v1/messages"
const API_VERSION = "2023-06-01"

/** Z chunku spraví dokumentový blok, na ktorý vie model citovať. */
function documentBlock(c: ChunkResult, citations: boolean) {
  const title = c.document?.title ?? c.documentId
  const ref = c.articleRef ? ` (${c.articleRef})` : ""
  return {
    type: "document",
    source: { type: "text", media_type: "text/plain", data: c.text },
    title: `${title}${ref}`,
    context: [c.heading, c.articleRef].filter(Boolean).join(" · ") || undefined,
    citations: { enabled: citations },
  }
}

export class AnthropicGenerationProvider implements GenerationProvider {
  readonly kind = "anthropic" as const
  readonly model: string
  readonly supportsCitations: boolean
  private apiKey: string
  private cfg: GenerationConfig

  constructor(cfg: GenerationConfig) {
    const envName = cfg.apiKeyEnv ?? "ANTHROPIC_API_KEY"
    const key = process.env[envName]
    if (!key) throw new ProviderConfigError(`Chýba env premenná ${envName}`)
    this.apiKey = key
    this.model = cfg.model
    this.supportsCitations = cfg.citations !== false
    this.cfg = cfg
  }

  async *stream(req: GenerationRequest): AsyncGenerator<GenerationEvent> {
    const docs = req.chunks.map((c) => documentBlock(c, this.supportsCitations))

    // cache_control na poslednom systémovom bloku — všetko pred ním sa cachuje
    const system = this.cfg.promptCaching !== false
      ? [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }]
      : req.system

    const body = {
      model: this.model,
      max_tokens: req.maxTokens ?? this.cfg.maxTokens ?? 1024,
      // `temperature` posielame LEN ak ju profil výslovne nastaví.
      // Novšie modely (claude-sonnet-5 a ďalšie) ju odmietajú s chybou
      // 400 „temperature is deprecated for this model" — a keďže sme ju
      // predtým dopĺňali predvolenou hodnotou, padalo každé volanie.
      ...(this.cfg.temperature !== undefined && { temperature: this.cfg.temperature }),
      stream: true,
      system,
      messages: [{
        role: "user",
        content: [
          ...docs,
          { type: "text", text: `Otázka: ${req.query}` },
        ],
      }],
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`)
    }

    yield* parseAnthropicStream(res.body, req.chunks)
  }

  /** Nestreamované doplnenie pre pomocné úlohy (klasifikácia, prepis dotazu). */
  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 256,
        ...(opts.temperature !== undefined && { temperature: opts.temperature }),
        messages: [{ role: "user", content: prompt }],
      }),
      signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Anthropic complete ${res.status}: ${detail.slice(0, 200)}`)
    }

    const data: any = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== "string") throw new Error("Anthropic: odpoveď bez textu")
    return text.trim()
  }
}

/**
 * Parsovanie SSE. Vytiahnuté zvlášť, aby sa dalo testovať bez siete.
 *
 * Zaujímajú nás dva typy delty:
 *   text_delta       → priebežný text odpovede
 *   citations_delta  → citácia s doslovným úryvkom a indexom dokumentu
 */
export async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
  chunks: ChunkResult[]
): AsyncGenerator<GenerationEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // spracujeme len úplné riadky, zvyšok necháme v buffri
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === "[DONE]") continue

      let ev: any
      try { ev = JSON.parse(payload) } catch { continue }

      if (ev.type !== "content_block_delta") continue
      const d = ev.delta
      if (!d) continue

      if (d.type === "text_delta" && d.text) {
        yield { type: "text", text: d.text }
      } else if (d.type === "citations_delta" && d.citation) {
        const idx = d.citation.document_index ?? -1
        const src = idx >= 0 ? chunks[idx] : undefined
        yield {
          type: "citation",
          citation: {
            chunkIndex: idx,
            citedText: d.citation.cited_text ?? "",
            documentTitle: d.citation.document_title ?? src?.document?.title,
            articleRef: src?.articleRef ?? null,
          },
        }
      }
    }
  }
}
