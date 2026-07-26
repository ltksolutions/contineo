/**
 * providers/generation/openai.ts
 *
 * OpenAI-kompatibilný adaptér. Pokrýva vLLM, SGLang aj Ollama — všetky tri
 * hovoria /v1/chat/completions natívne, takže tu je kompatibilita zadarmo
 * a výmena modelu je zmena konfigurácie (ADR-001).
 *
 * Čo tu NIE JE a ani byť nemôže:
 *   - overiteľné citácie (Citations API) — model ich žiada promptom,
 *     takže si môže odkaz vymyslieť. Preto supportsCitations = false.
 *   - prompt caching v sémantike Anthropic — vLLM má prefix caching,
 *     ale riadi si ho sám a cez API sa neovláda.
 */

import { ChunkResult } from "../../mongoSearch"
import {
  GenerationConfig, GenerationProvider, GenerationRequest, GenerationEvent,
  CompleteOptions, ProviderConfigError,
} from "../types"

/** Kontext ako číslovaný text — model má citovať [1], [2]… */
function buildContext(chunks: ChunkResult[]): string {
  return chunks
    .map((c, i) => {
      const src = c.document?.title ?? c.documentId
      const ref = c.articleRef ? ` (${c.articleRef})` : ""
      return `[${i + 1}] Zdroj: ${src}${ref}\n${c.text}`
    })
    .join("\n\n---\n\n")
}

export class OpenAICompatGenerationProvider implements GenerationProvider {
  readonly kind = "openai" as const
  readonly model: string
  readonly supportsCitations = false
  private url: string
  private apiKey?: string
  private cfg: GenerationConfig

  constructor(cfg: GenerationConfig) {
    if (!cfg.url) throw new ProviderConfigError('generation.kind="openai" vyžaduje url')
    this.url = cfg.url.replace(/\/+$/, "")
    this.model = cfg.model
    this.cfg = cfg
    // Lokálne servery často bežia bez kľúča — preto voliteľné.
    this.apiKey = cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : undefined
  }

  async *stream(req: GenerationRequest): AsyncGenerator<GenerationEvent> {
    const userPrompt =
      `Kontext:\n${buildContext(req.chunks)}\n\n` +
      `Otázka: ${req.query}\n\n` +
      `Odpoveď (uveď čísla zdrojov [1], [2]... pri citáciách):`

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`

    const res = await fetch(`${this.url}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens ?? this.cfg.maxTokens ?? 1024,
        temperature: this.cfg.temperature ?? 0.3,
        stream: true,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: userPrompt },
        ],
      }),
    })

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "")
      throw new Error(`OpenAI-compat ${this.url} ${res.status}: ${detail.slice(0, 300)}`)
    }

    yield* parseOpenAIStream(res.body)
  }

  /** Nestreamované doplnenie pre pomocné úlohy (klasifikácia, prepis dotazu). */
  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`

    const res = await fetch(`${this.url}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 256,
        temperature: opts.temperature ?? 0,
        stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`OpenAI-compat complete ${res.status}: ${detail.slice(0, 200)}`)
    }

    const data: any = await res.json()
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== "string") throw new Error("OpenAI-compat: odpoveď bez textu")
    return text.trim()
  }
}

/** Parsovanie SSE. Zvlášť, aby sa dalo testovať bez siete. */
export async function* parseOpenAIStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<GenerationEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const payload = trimmed.slice(5).trim()
      if (!payload) continue
      if (payload === "[DONE]") return

      let ev: any
      try { ev = JSON.parse(payload) } catch { continue }

      const delta = ev.choices?.[0]?.delta
      if (delta?.content) yield { type: "text", text: delta.content }
    }
  }
}
