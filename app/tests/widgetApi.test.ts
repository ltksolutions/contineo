/**
 * widgetApi.test.ts — brana widgetu (ADR-028, D166).
 *
 * Povod musi byt medzi povolenymi (s lomkou aj bez), CORS hlavicky su len
 * pre ten povod, a transformacia streamu zapise odpoved az po `done`
 * so zdrojmi a prida udalost `recorded`; bez zdrojov nic nezapise.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))
vi.mock("../src/lib/session", () => ({ currentTenant: vi.fn(), requestHostname: vi.fn() }))
const recordAnswer = vi.fn(async () => "rec1")
vi.mock("../src/lib/ratings", () => ({ recordAnswer: (...a: unknown[]) => recordAnswer(...a as []), RATINGS_COLLECTION: "evaluations", saveReaderFeedback: vi.fn() }))

import { originAllowed, corsHeaders, recordingTransform, requestOrigin } from "../src/lib/widgetApi"

const channel = { widget: { origins: ["https://issf.futbalsfz.sk/"], rateLimitPerHour: 60 } }

describe("povod", () => {
  it("povoleny povod s lomkou aj bez; cudzi a chybajuci nie", () => {
    expect(originAllowed(channel, "https://issf.futbalsfz.sk")).toBe(true)
    expect(originAllowed(channel, "https://issf.futbalsfz.sk/")).toBe(false) // requestOrigin lomku odstrihne
    expect(requestOrigin(new Headers({ origin: "https://issf.futbalsfz.sk/" }))).toBe("https://issf.futbalsfz.sk")
    expect(originAllowed(channel, "https://zly.sk")).toBe(false)
    expect(originAllowed(channel, null)).toBe(false)
  })
  it("CORS hlavicky su pre konkretny povod", () => {
    const h = corsHeaders("https://issf.futbalsfz.sk")
    expect(h["Access-Control-Allow-Origin"]).toBe("https://issf.futbalsfz.sk")
    expect(h.Vary).toBe("Origin")
  })
})

async function run(events: unknown[]): Promise<string> {
  const enc = new TextEncoder()
  const src = new ReadableStream<Uint8Array>({
    start(c) { for (const e of events) c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); c.close() },
  })
  const out = src.pipeThrough(recordingTransform({ question: "Q?", personId: "p1", companyCode: "SFZ", startedAt: Date.now() }))
  const reader = out.getReader(); const dec = new TextDecoder(); let s = ""
  for (;;) { const r = await reader.read(); if (r.done) break; s += dec.decode(r.value) }
  return s
}

describe("recordingTransform", () => {
  it("prepusti udalosti, po done so zdrojmi zapise odpoved a prida recorded", async () => {
    recordAnswer.mockClear()
    const s = await run([{ type: "token", token: "Odp" }, { type: "token", token: "oveď." }, { type: "done", sources: [{ title: "RP" }], model: "m", provider: "anthropic" }])
    expect(s).toContain('"type":"token"')
    expect(s).toContain('{"type":"recorded","id":"rec1"}')
    expect(recordAnswer).toHaveBeenCalledTimes(1)
    const [rec, personId, companyCode, level] = recordAnswer.mock.calls[0] as unknown as [{ answer: string; question: string }, string, string, string]
    expect(rec.answer).toBe("Odpoveď.")
    expect(rec.question).toBe("Q?")
    expect([personId, companyCode, level]).toEqual(["p1", "SFZ", "public"])
  })
  it("bez zdrojov sa nic nezapise", async () => {
    recordAnswer.mockClear()
    const s = await run([{ type: "done", sources: [], model: "none" }])
    expect(s).not.toContain("recorded")
    expect(recordAnswer).not.toHaveBeenCalled()
  })
})
