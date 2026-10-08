/**
 * answerKicker.test.ts — hlavička odpovede podľa zdrojov (Ján 8. 10. 2026).
 * Keď sa hľadalo aj (alebo len) v živom zdroji, „Odpoveď z dokumentov SFZ"
 * by klamala; uložená odpoveď si zdroje odvodí z obsahu.
 */

import { describe, it, expect } from "vitest"
import { answerKicker, scopeFromSources } from "../src/lib/answerKicker"
import type { AnswerSource } from "../src/lib/sseClient"

const live = (name: string): AnswerSource => ({ index: 1, title: "x", live: { connectorId: "c", connectorName: name, externalId: "a.md" } })
const lib: AnswerSource = { index: 2, title: "Stanovy" }

describe("hlavička odpovede", () => {
  it("len knižnica — ako doteraz", () => {
    expect(answerKicker({ library: true, live: [] }, "SFZ", "sk")).toBe("Odpoveď z dokumentov SFZ")
  })
  it("knižnica aj živý zdroj", () => {
    expect(answerKicker({ library: true, live: ["Sportnet dokumentácia"] }, "SFZ", "sk"))
      .toBe("Odpoveď z dokumentov SFZ a zo zdroja Sportnet dokumentácia")
  })
  it("len živý zdroj, aj viac zdrojov", () => {
    expect(answerKicker({ library: false, live: ["Sportnet dokumentácia"] }, "SFZ", "sk")).toBe("Odpoveď zo zdroja Sportnet dokumentácia")
    expect(answerKicker({ library: false, live: ["A", "B"] }, "SFZ", "sk")).toBe("Odpoveď zo zdrojov A a B")
  })
  it("čeština a angličtina", () => {
    expect(answerKicker({ library: false, live: ["Sportnet"] }, "SFZ", "cs")).toBe("Odpověď ze zdroje Sportnet")
    expect(answerKicker({ library: true, live: ["Sportnet"] }, "SFZ", "en")).toBe("Answer from SFZ documents and Sportnet")
  })
  it("uložená odpoveď: zdroje z obsahu", () => {
    expect(scopeFromSources([lib])).toEqual({ library: true, live: [] })
    expect(scopeFromSources([live("Sportnet"), lib])).toEqual({ library: true, live: ["Sportnet"] })
    expect(scopeFromSources([live("Sportnet"), live("Sportnet")])).toEqual({ library: false, live: ["Sportnet"] })
    expect(scopeFromSources([])).toEqual({ library: true, live: [] })
  })
})
