import { parseAnthropicStream } from "../src/lib/providers/generation/anthropic"
import { parseOpenAIStream } from "../src/lib/providers/generation/openai"

/** Vyrobí ReadableStream, ktorý dáta vydá po zadaných kúskoch. */
function streamOf(parts: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(c) {
      if (i < parts.length) c.enqueue(enc.encode(parts[i++]))
      else c.close()
    },
  })
}

const chunks: any[] = [
  { _id: "1", text: "...", documentId: "d1", articleRef: "§ 84 ods. 2",
    document: { title: "Súťažný poriadok SFZ", slug: "sp", category: "norma" } },
  { _id: "2", text: "...", documentId: "d2", articleRef: "§ 12",
    document: { title: "Rozpis súťaže", slug: "rs", category: "rozpis" } },
]

import { t } from "./helper"

async function collect(gen: AsyncGenerator<any>) {
  const out: any[] = []
  for await (const e of gen) out.push(e)
  return out
}

async function main() {
  // ── 1. Anthropic: text + citácia ─────────────────────────────────────
  const ant = [
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Námietku"}}\n\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" treba podať."}}\n\n',
    'data: {"type":"content_block_delta","delta":{"type":"citations_delta","citation":' +
      '{"type":"char_location","cited_text":"do 48 hodín","document_index":0,' +
      '"document_title":"Súťažný poriadok SFZ"}}}\n\n',
    'data: {"type":"message_stop"}\n\n',
  ]
  let ev = await collect(parseAnthropicStream(streamOf(ant), chunks))
  const text = ev.filter(e => e.type === "text").map(e => e.text).join("")
  const cits = ev.filter(e => e.type === "citation")
  t("anthropic: text poskladany", text === "Námietku treba podať.", `dostal "${text}"`)
  t("anthropic: citacia zachytena", cits.length === 1)
  t("anthropic: citacia ma spravny chunkIndex", cits[0]?.citation.chunkIndex === 0)
  t("anthropic: citacia ma cited_text", cits[0]?.citation.citedText === "do 48 hodín")
  t("anthropic: articleRef doplneny z chunku", cits[0]?.citation.articleRef === "§ 84 ods. 2")

  // ── 2. Anthropic: JSON rozdeleny medzi pakety ────────────────────────
  const split = [
    'data: {"type":"content_block_delta","delta":{"type":"text_',
    'delta","text":"rozdelene"}}\n\ndata: {"type":"content_block_delta",',
    '"delta":{"type":"text_delta","text":" spravne"}}\n\n',
  ]
  ev = await collect(parseAnthropicStream(streamOf(split), chunks))
  const t2 = ev.map(e => e.text).join("")
  t("anthropic: JSON delený medzi paketmi sa nestratí", t2 === "rozdelene spravne", `dostal "${t2}"`)

  // ── 3. Anthropic: neznáme typy sa ignorujú ───────────────────────────
  ev = await collect(parseAnthropicStream(streamOf([
    'data: {"type":"message_start","message":{}}\n\n',
    'data: {"type":"ping"}\n\n',
    'data: nevalidny json\n\n',
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
  ]), chunks))
  t("anthropic: sum a nevalidny JSON sa preskocia", ev.length === 1 && ev[0].text === "ok")

  // ── 4. OpenAI-compat ─────────────────────────────────────────────────
  ev = await collect(parseOpenAIStream(streamOf([
    'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"Odpoveď"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" je tu."}}]}\n\n',
    'data: [DONE]\n\n',
  ])))
  const t4 = ev.map(e => e.text).join("")
  t("openai: text poskladany", t4 === "Odpoveď je tu.", `dostal "${t4}"`)
  t("openai: prazdna delta sa preskoci", ev.length === 2)

  // ── 5. OpenAI: [DONE] ukonci aj ked prídu dalsie data ────────────────
  ev = await collect(parseOpenAIStream(streamOf([
    'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
    'data: [DONE]\n\n',
    'data: {"choices":[{"delta":{"content":"B"}}]}\n\n',
  ])))
  t("openai: po [DONE] sa uz necita", ev.map(e => e.text).join("") === "A")

  // ── 6. OpenAI: delene pakety ─────────────────────────────────────────
  ev = await collect(parseOpenAIStream(streamOf([
    'data: {"choices":[{"delta":{"con',
    'tent":"deleny"}}]}\n\ndata: [DONE]\n\n',
  ])))
  t("openai: JSON delený medzi paketmi sa nestratí", ev.map(e => e.text).join("") === "deleny")

}
await main()
