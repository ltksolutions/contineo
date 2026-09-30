/**
 * llmGeneratorTimings.test.ts — čas hlavného modelu po prvý token (D9).
 *
 * Z TTFT meraného v prehliadači zostávala asi tretina nevysvetlená: fázy
 * pred generovaním sa merali, samotný model nie. Kľúč
 * `model po prvy token` sa zapíše pri prvej textovej udalosti — nie pri
 * citácii ani pri počte tokenov, tie človek na obrazovke nevidí.
 */
import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/providers/factory", () => ({
  getProviders: () => ({
    generation: {
      model: "fake",
      kind: "fake",
      supportsCitations: false,
      async *stream() {
        yield { type: "tokens", tokens: { input: 10 } }
        await new Promise(r => setTimeout(r, 20))
        yield { type: "text", text: "Prvý" }
        await new Promise(r => setTimeout(r, 300))
        yield { type: "text", text: " druhý" }
      },
    },
  }),
}))

import { generateAnswer } from "../src/lib/llmGenerator"
import type { TenantProfile } from "../src/lib/providers/types"

const profile = {
  companyCode: "TEST",
  providers: { generation: { maxTokens: 100 } },
} as unknown as TenantProfile

async function events(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value)
  }
  return out.split("\n\n").filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, "")))
}

describe("generateAnswer — čas po prvý token", () => {
  it("zapíše čas po prvú textovú udalosť, nie po poslednú", async () => {
    const timings: Record<string, number> = { preprocessing: 5 }
    const out = await events(generateAnswer({ query: "x", chunks: [], userRole: "internal", profile, timings }))
    const done = out.find(e => e.type === "done") as { timings: Record<string, number> }

    const ms = done.timings["model po prvy token"]
    expect(ms).toBeGreaterThanOrEqual(15)
    // Druhý token prišiel o ďalších 300 ms — keby sa čas prepisoval, bol by
    // nad 300. Rezerva je veľká naschvál, aby test nepadal na vyťaženom stroji.
    expect(ms).toBeLessThan(250)
    // Fázy pred generovaním ostanú.
    expect(done.timings.preprocessing).toBe(5)
  })

  it("bez `timings` nič nepadá", async () => {
    const out = await events(generateAnswer({ query: "x", chunks: [], userRole: "internal", profile }))
    expect(out.some(e => e.type === "done")).toBe(true)
  })
})
