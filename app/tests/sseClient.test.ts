/**
 * sseKlient.test.ts — čítanie SSE z /api/chat.
 *
 * Tieto testy existujú kvôli jednej konkrétnej chybe, ktorú sme už raz
 * spravili pri binárnom streame z Bedrocku: udalosť rozdelená medzi dve
 * čítania sa stratí. Na localhoste sa to neprejaví, lebo odpoveď príde
 * v jednom kuse. Preto sa to musí testovať umelo.
 */
import { splitEvents, readEvents } from "../src/lib/sseClient"
import type { SseEvent } from "../src/lib/sseClient"

import { t } from "./helper"

const frame = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`
const token = (s: string) => frame({ type: "token", token: s })

async function running() {

// ── delenie blokov ───────────────────────────────────────────────────────────

const one = splitEvents(token("Ahoj"))
t("jedna udalosť sa prečíta", one.events.length === 1)
t("po úplnej udalosti nezostáva zvyšok", one.rest === "", JSON.stringify(one.rest))
t("token sa rozbalí",
  one.events[0].type === "token" && (one.events[0] as any).token === "Ahoj")

const three = splitEvents(token("a") + token("b") + token("c"))
t("tri udalosti za sebou", three.events.length === 3, String(three.events.length))

// Jadro veci: neúplná udalosť sa musí odložiť, nie zahodiť.
const whole = token("Rozdelené")
const partial = splitEvents(whole.slice(0, 12))
t("neúplná udalosť sa odloží", partial.events.length === 0 && partial.rest.length === 12,
  `${partial.events.length} udalostí, zvyšok ${partial.rest.length}`)
const completed = splitEvents(partial.rest + whole.slice(12))
t("po doplnení sa udalosť prečíta celá",
  completed.events.length === 1 && (completed.events[0] as any).token === "Rozdelené")

// Prvá udalosť úplná, druhá useknutá — nesmie sa stratiť ani jedna.
const mixed = splitEvents(token("prvy") + token("druhy").slice(0, 10))
t("úplná prejde, neúplná počká",
  mixed.events.length === 1 && mixed.rest.length === 10,
  `${mixed.events.length}, zvyšok ${mixed.rest.length}`)

t("poškodený JSON sa preskočí, ostatné prejde",
  splitEvents("data: {nie json}\n\n" + token("ok")).events.length === 1)

t("keep-alive komentár sa ignoruje",
  splitEvents(": ping\n\n" + token("ok")).events.length === 1)

t("viacriadkový data blok sa spojí",
  (() => {
    const u = splitEvents('data: {"type":"token",\ndata: "token":"X"}\n\n').events
    return u.length === 1 && (u[0] as any).token === "X"
  })())

// ── čítanie celého streamu ───────────────────────────────────────────────────

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(c) { i < chunks.length ? c.enqueue(enc.encode(chunks[i++])) : c.close() },
  })
}

const citation = {
  type: "citation",
  citation: { chunkIndex: 0, citedText: "úryvok z normy", articleRef: "čl. 3" },
}
const end = {
  type: "done",
  sources: [{ index: 1, title: "Rokovací poriadok" }],
  citations: [citation.citation],
  model: "claude-sonnet-5",
  provider: "anthropic",
  verifiedCitations: true,
}

// Rozdelenie je zámerne škaredé: uprostred JSONu aj uprostred `\n\n`.
const raw = token("Podľa ") + token("čl. 3") + frame(citation) + frame(end)
const chunks = [raw.slice(0, 9), raw.slice(9, 40), raw.slice(40, 41), raw.slice(41)]

const all: SseEvent[] = []
for await (const u of readEvents(streamOf(chunks))) all.push(u)

t("prečíta všetky udalosti aj pri škaredom delení", all.length === 4,
  JSON.stringify(all.map(u => u.type)))
t("text sa poskladá v správnom poradí",
  all.filter(u => u.type === "token").map(u => (u as any).token).join("") === "Podľa čl. 3")
t("citácia dorazí", all.some(u => u.type === "citation"))
t("done nesie zdroje aj model",
  all.some(u => u.type === "done" && (u as any).model === "claude-sonnet-5"))

// Viacbajtový znak rozdelený medzi pakety — bez `stream: true` by z „š"
// vyšiel otáznik. Testujeme na úrovni bajtov, nie znakov.
const enc = new TextEncoder()
const bytes = enc.encode(token("príliš žltý kôň"))
const half = Math.floor(bytes.length / 2)
const byteWise = new ReadableStream<Uint8Array>({
  start(c) {
    c.enqueue(bytes.slice(0, half))
    c.enqueue(bytes.slice(half))
    c.close()
  },
})
const accents: SseEvent[] = []
for await (const u of readEvents(byteWise)) accents.push(u)
t("diakritika prežije rozdelenie na úrovni bajtov",
  accents.length === 1 && (accents[0] as any).token === "príliš žltý kôň",
  JSON.stringify(accents))

// Stream, ktorý skončí bez ukončujúceho prázdneho riadku.
const withoutEnd: SseEvent[] = []
for await (const u of readEvents(streamOf([`data: ${JSON.stringify({ type: "token", token: "X" })}`]))) {
  withoutEnd.push(u)
}
t("neukončený posledný blok sa nestratí", withoutEnd.length === 1, JSON.stringify(withoutEnd))

}

await running()
