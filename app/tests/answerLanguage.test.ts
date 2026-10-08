/**
 * answerLanguage.test.ts — odpoveď je celá po slovensky (Ján 8. 10. 2026).
 *
 * Dokumentácia Sportnetu je po anglicky a model do odpovede vkladal anglické
 * vety z článku. Pokyn je v systémovom prompte pre každý zdroj, nielen pre
 * živý — anglický alebo český dokument môže byť aj v knižnici.
 */

import { describe, it, expect } from "vitest"
import { buildSystemPrompt } from "../src/lib/llmGenerator"

describe("jazyk odpovede", () => {
  it("prompt žiada celú odpoveď po slovensky a preklad cudzojazyčného zdroja", () => {
    for (const live of [false, true]) {
      const p = buildSystemPrompt("internal", true, new Date("2026-10-08T12:00:00Z"), undefined, live)
      expect(p).toContain("Celú odpoveď píš po slovensky")
      expect(p).toContain("nevkladaj do textu cudzojazyčné vety")
    }
  })
})
