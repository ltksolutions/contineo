/**
 * answerReports.test.ts — čo z hlásenia zostane a čo sa odmietne.
 *
 * Testuje sa `tidyReport()`, lebo je to **jediné miesto**, kde sa rozhoduje
 * o obsahu hlásenia — a robí to nad vstupom z prehliadača, teda nad niečím,
 * čomu sa neverí.
 */

import { describe, it, expect } from "vitest"
import {
  tidyReport, clip, retentionCutoff, RETENTION_MONTHS,
  MAX_NOTE, MAX_SOURCES, AnswerReportError,
} from "../src/lib/answerReports"

describe("ocistenie hlasenia", () => {
  it("bez popisu to neprejde", () => {
    // Palec dole nie je hlasenie: bez vety „co je zle" sa neda nic opravit.
    expect(() => tidyReport({ question: "a", answer: "b", note: "   " }))
      .toThrow(AnswerReportError)
  })

  it("otazka aj odpoved sa ulozia, aj ked su prazdne", () => {
    // Prazdna otazka je mozna (clovek klikol na navrh), prazdna odpoved nie —
    // ale ani jedno nie je dovod hlasenie zahodit.
    const r = tidyReport({ note: "cituje zruseny clanok" })
    expect(r.question).toBe("")
    expect(r.answer).toBe("")
    expect(r.note).toBe("cituje zruseny clanok")
  })

  it("dlhy text sa oreze s vypustkou, nezamietne", () => {
    const long = "x".repeat(MAX_NOTE + 500)
    const r = tidyReport({ note: long })
    expect(r.note).toHaveLength(MAX_NOTE)
    expect(r.note.endsWith("…")).toBe(true)
  })

  it("zdroje sa oreze na pocet a zahodia sa tie bez nazvu", () => {
    const many = Array.from({ length: MAX_SOURCES + 10 }, (_, i) => ({ title: `zdroj ${i}` }))
    const r = tidyReport({ note: "x", sources: [...many, { title: "   " }, { url: "len-url" }] })
    expect(r.sources).toHaveLength(MAX_SOURCES)
  })

  it("nezmysel namiesto zdrojov nespadne", () => {
    // Telo poziadavky pride z prehliadaca. Zle pole nema zhodit zapis.
    expect(tidyReport({ note: "x", sources: "nie pole" }).sources).toEqual([])
    expect(tidyReport({ note: "x", sources: [null, 5, "a"] }).sources).toEqual([])
  })

  it("nepovinne polia zdroja zostanu nevyplnene, nie prazdne", () => {
    const r = tidyReport({ note: "x", sources: [{ title: "Stanovy", articleRef: "" }] })
    expect(r.sources[0].articleRef).toBeUndefined()
    expect(r.sources[0].url).toBeUndefined()
  })
})

describe("orezanie a retencia", () => {
  it("kratky text sa nemeni", () => {
    expect(clip("  ahoj  ", 10)).toBe("ahoj")
  })

  it("hranica retencie je dvadsatstyri mesiacov dozadu", () => {
    expect(RETENTION_MONTHS).toBe(24)
    const cutoff = retentionCutoff(new Date(2026, 8, 15))
    expect(cutoff.getFullYear()).toBe(2024)
    expect(cutoff.getMonth()).toBe(8)
  })
})
