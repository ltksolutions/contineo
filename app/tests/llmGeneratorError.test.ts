/**
 * llmGeneratorError.test.ts — chyba generovania nevynáša podrobnosti (N6).
 *
 * `generateAnswer()` posielal do udalosti `error` surové `err.message` —
 * text z SDK poskytovateľa vie niesť interné detaily (názvy modelov,
 * adresy, tvar požiadavky). Človeku patrí všeobecná veta v jeho jazyku,
 * príčina do logu. Test vyvolá chybu najlacnejšou cestou: profil
 * s neznámym druhom generovania zhodí `getProviders()` hneď na začiatku
 * streamu, ešte pred akoukoľvek sieťou.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { generateAnswer } from "../src/lib/llmGenerator"
import { dictionary } from "../src/lib/i18n"
import type { TenantProfile } from "../src/lib/providers/types"

/** Profil, ktorý `getProviders()` odmietne — na vyvolanie vetvy `catch`. */
const brokenProfile = {
  companyCode: "TEST",
  providers: { generation: { kind: "neexistujuci-druh" } },
} as unknown as TenantProfile

async function readAll(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let out = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value)
  }
  return out
}

beforeEach(() => {
  // Príčina patrí do logu — test ju tam čaká, ale nechce ňou špiniť výpis.
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("generateAnswer — zlyhanie (N6)", () => {
  it("do streamu ide všeobecná veta, nie text výnimky", async () => {
    const out = await readAll(
      generateAnswer({ query: "x", chunks: [], userRole: "internal", profile: brokenProfile }),
    )
    expect(out).toContain(dictionary("sk").answer.failed)
    // Text výnimky menuje neznámy druh — na obrazovku nesmie.
    expect(out).not.toContain("neexistujuci-druh")
  })

  it("veta príde v jazyku prostredia", async () => {
    const out = await readAll(
      generateAnswer({
        query: "x", chunks: [], userRole: "internal", profile: brokenProfile, language: "en",
      }),
    )
    expect(out).toContain(dictionary("en").answer.failed)
  })

  it("príčina sa zapíše do logu", async () => {
    await readAll(
      generateAnswer({ query: "x", chunks: [], userRole: "internal", profile: brokenProfile }),
    )
    expect(console.error).toHaveBeenCalled()
  })
})
