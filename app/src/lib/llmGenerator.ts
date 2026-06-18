/**
 * llmGenerator.ts
 * Generovanie finálnej odpovede z chunkov kontextu.
 * Primárny: Ollama (lokálny). Fallback: Claude API (streaming).
 * Výstup: ReadableStream pre SSE v Next.js Route Handler.
 */

import { ChunkResult } from "./mongoSearch"

export interface GenerateOptions {
  query: string
  chunks: ChunkResult[]
  userRole: "public" | "internal"
}

// ── Zostavenie systémového promptu ──────────────────────────────────────────

function buildSystemPrompt(role: string): string {
  return `Si inteligentný asistent portálu Contineo pre slovenský futbal.
Odpovedáš VÝLUČNE na základe poskytnutého kontextu.
Ak odpoveď nie je v kontexte, povedz to úprimne.
Jazyk: slovenčina. Tón: profesionálny, stručný.
${role === "internal" ? "Máš prístup aj k interným normám a dokumentom." : ""}`
}

function buildUserPrompt(query: string, chunks: ChunkResult[]): string {
  const context = chunks
    .map((c, i) => {
      const source = c.document?.title ?? c.document_id
      return `[${i + 1}] Zdroj: ${source}\n${c.text}`
    })
    .join("\n\n---\n\n")

  return `Kontext:\n${context}\n\nOtázka: ${query}\n\nOdpoveď (uveď čísla zdrojov [1], [2]... pri citáciách):`
}

// ── Ollama streaming ─────────────────────────────────────────────────────────

async function* streamOllama(
  system: string,
  userPrompt: string
): AsyncGenerator<string> {
  const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "llama3.2",
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: userPrompt },
      ],
      options: { temperature: 0.3 },
    }),
  })

  if (!response.ok || !response.body) throw new Error("Ollama nedostupný")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split("\n").filter(Boolean)
    for (const line of lines) {
      try {
        const json = JSON.parse(line)
        if (json.message?.content) yield json.message.content
      } catch { /* nekompletný chunk, pokračuj */ }
    }
  }
}

// ── Claude API streaming ─────────────────────────────────────────────────────

async function* streamClaude(
  system: string,
  userPrompt: string
): AsyncGenerator<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      stream: true,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })

  if (!response.ok || !response.body) throw new Error("Claude API nedostupný")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data:"))
    for (const line of lines) {
      try {
        const json = JSON.parse(line.slice(5))
        if (json.type === "content_block_delta") {
          yield json.delta.text ?? ""
        }
      } catch { /* skip */ }
    }
  }
}

// ── Zostavenie citácií ───────────────────────────────────────────────────────

export function buildSources(chunks: ChunkResult[]) {
  return chunks.map((c, i) => ({
    index: i + 1,
    title: c.document?.title ?? "Neznámy zdroj",
    slug:  c.document?.slug,
    url:   c.document?.source_url,
  }))
}

// ── Hlavný export – ReadableStream pre SSE ───────────────────────────────────

export function generateAnswer(opts: GenerateOptions): ReadableStream {
  const { query, chunks, userRole } = opts
  const system     = buildSystemPrompt(userRole)
  const userPrompt = buildUserPrompt(query, chunks)

  return new ReadableStream({
    async start(controller) {
      const encode = (data: object) =>
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
        )

      try {
        // Pokus Ollama (lokálny, preferovaný)
        let usedOllama = true
        const gen = (async function* () {
          try {
            yield* streamOllama(system, userPrompt)
          } catch {
            usedOllama = false
            yield* streamClaude(system, userPrompt)
          }
        })()

        for await (const token of gen) {
          encode({ type: "token", token })
        }

        // Na záver odošleme zdroje
        encode({
          type: "done",
          sources: buildSources(chunks),
          model: usedOllama
            ? (process.env.OLLAMA_MODEL ?? "llama3.2")
            : "claude-sonnet-4-6",
        })
      } catch (err) {
        encode({ type: "error", message: String(err) })
      } finally {
        controller.close()
      }
    },
  })
}
