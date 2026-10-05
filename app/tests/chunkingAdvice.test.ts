/**
 * chunkingAdvice.test.ts — návrh členenia od AI (ADR-027, krok C).
 * Testuje sa to, čo odchádza von (len štruktúra), a že sa odpovedi modelu
 * neverí naslepo (orezanie, predvolené hodnoty).
 */
import { describe, it, expect } from "vitest"
import { structureOutline, parseAdvice, OUTLINE_MAX_LINES, ADVICE_SCHEMA, ADVICE_SYSTEM } from "../src/lib/chunkingAdvice"

const DOC = `# Finančná smernica SFZ
| **Názov** | Smernica |
| --- | --- |
# Časť I – Základné ustanovenia
# **Článok 1 – Predmet úpravy**

(1) Táto smernica upravuje obeh účtovných dokladov v Slovenskom futbalovom zväze a jeho úsekoch.
pokračovanie odseku, ktoré sa nemá poslať

(2) Vzťahuje sa na všetkých zamestnancov.
a) písmeno jedna
`

describe("štruktúra pre model", () => {
  const o = structureOutline(DOC)

  it("nadpisy a články celé, tučné písmo preč, tabuľka raz", () => {
    expect(o.lines).toContain("# Článok 1 – Predmet úpravy")
    expect(o.lines).toContain("# Časť I – Základné ustanovenia")
    expect(o.lines.filter(l => l === "[tabuľka]")).toHaveLength(1)
  })

  it("z odsekov len začiatok, pokračovanie odseku vôbec", () => {
    expect(o.lines.some(l => l.startsWith("  (1) Táto smernica upravuje") && l.endsWith("…"))).toBe(true)
    expect(o.lines.join("\n")).not.toContain("pokračovanie odseku")
    expect(o.lines.join("\n")).not.toContain("Slovenskom futbalovom zväze a jeho úsekoch")
  })

  it("strop riadkov", () => {
    const long = Array.from({ length: 900 }, (_, i) => `## Článok ${i + 1} – Názov`).join("\n")
    const r = structureOutline(long)
    expect(r.lines).toHaveLength(OUTLINE_MAX_LINES)
    expect(r.truncated).toBe(true)
  })
})

describe("odpoveď modelu", () => {
  const meta = { at: new Date("2026-10-05T12:00:00Z"), by: "Ján Letko", model: "claude-sonnet-5" }

  it("platná odpoveď prejde, hodnoty sa orežú", () => {
    const a = parseAdvice({
      strategy: "articles", articleWord: "§", annexWord: "Príloha", minTokens: 10, maxTokens: 99999,
      confidence: "high", reasoning: " Paragrafy. ", issues: ["tabuľky", ""],
    }, meta)
    expect(a.values).toMatchObject({ articleWord: "§", annexWord: "Príloha", minTokens: 50, maxTokens: 4000 })
    expect(a).toMatchObject({ strategy: "articles", confidence: "high", reasoning: "Paragrafy.", issues: ["tabuľky"] })
  })

  it("nezmysel padne na bezpečné predvolené hodnoty", () => {
    const a = parseAdvice({ strategy: "vesmír", confidence: "absolútna", issues: "nie pole" }, meta)
    expect(a.strategy).toBe("articles")
    expect(a.confidence).toBe("medium")
    expect(a.issues).toEqual([])
    expect(a.values.articleWord).toBe("Článok")
  })

  it("schéma vyžaduje všetky polia a nič navyše", () => {
    expect(ADVICE_SCHEMA.additionalProperties).toBe(false)
    expect([...ADVICE_SCHEMA.required].sort()).toEqual(Object.keys(ADVICE_SCHEMA.properties).sort())
  })
})

describe("zadanie pre model", () => {
  // Rovná úvodzovka za „ v zadaní naučila model písať ju aj v odpovedi —
  // a v štruktúrovanom výstupe ukončila reťazec (5. 10. 2026).
  it("nemá rovnú uzatváraciu úvodzovku za slovenskou otváracou", () => {
    expect(ADVICE_SYSTEM).not.toMatch(/„[^“\n]*"/)
    expect(ADVICE_SYSTEM).toContain("„Článok 5 – Názov“")
  })
})
