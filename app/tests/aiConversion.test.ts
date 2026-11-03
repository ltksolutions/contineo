/**
 * Prevod PDF modelom (ADR-046): plán častí z analýzy a skladanie výsledku.
 *
 * Plán od modelu sa prijme len vtedy, keď pokryje strany súvisle — inak by
 * časť dokumentu ticho vypadla alebo sa preložila dvakrát. Náhradné delenie
 * je bezpečné, lebo mení len to, kde model nadväzuje, nie text.
 */
import { describe, it, expect } from "vitest"
import { parsePlan, fallbackParts, joinParts, tailOf, layerText, headingOutline, MAX_PART_PAGES } from "../src/lib/aiConversion"
import { analysisWindows, conversionPhase, type AiConversion } from "../src/lib/aiConversionJob"

const plan = (parts: unknown) => "## Analýza\n\nČlenenie: body „7.“\n\n```json\n" + JSON.stringify({ parts }) + "\n```"

describe("plán častí z analýzy", () => {
  it("súvislý plán sa prijme a analýza je bez bloku JSON", () => {
    const r = parsePlan(plan([{ from: 1, to: 4 }, { from: 5, to: 9 }]), 1, 9)
    expect(r.fromModel).toBe(true)
    expect(r.parts).toEqual([{ from: 1, to: 4 }, { from: 5, to: 9 }])
    expect(r.analysis).toBe("## Analýza\n\nČlenenie: body „7.“")
  })

  it("priveľká časť sa rozdelí", () => {
    const r = parsePlan(plan([{ from: 1, to: 12 }]), 1, 12)
    expect(r.fromModel).toBe(true)
    expect(r.parts.every(p => p.to - p.from + 1 <= MAX_PART_PAGES)).toBe(true)
    expect(r.parts[0].from).toBe(1)
    expect(r.parts[r.parts.length - 1].to).toBe(12)
  })

  it("diera, prekryv alebo chýbajúci koniec → rovnomerné delenie", () => {
    for (const parts of [
      [{ from: 1, to: 3 }, { from: 5, to: 9 }],
      [{ from: 1, to: 5 }, { from: 4, to: 9 }],
      [{ from: 1, to: 5 }],
      [{ from: 1, to: 12 }],
    ]) {
      const r = parsePlan(plan(parts), 1, 9)
      expect(r.fromModel).toBe(false)
      expect(r.parts).toEqual(fallbackParts(9))
    }
  })

  it("bez bloku JSON alebo s chybným JSON → rovnomerné delenie, analýza ostane", () => {
    expect(parsePlan("len text", 1, 3)).toMatchObject({ fromModel: false, analysis: "len text", parts: fallbackParts(3) })
    expect(parsePlan("a\n```json\n{parts:\n```", 1, 3).fromModel).toBe(false)
  })

  it("okno od strany 101 počíta strany podľa celého dokumentu", () => {
    const r = parsePlan(plan([{ from: 101, to: 104 }, { from: 105, to: 110 }]), 101, 110)
    expect(r.fromModel).toBe(true)
    expect(parsePlan("nič", 101, 110).parts[0]).toEqual({ from: 101, to: 104 })
  })
})

describe("skladanie", () => {
  it("časti za sebou bez prázdnych, koniec pre nadviazanie", () => {
    expect(joinParts(["# A\n", "  ", "text"])).toBe("# A\n\ntext\n")
    expect(tailOf("1\n2\n3\n4", 2)).toBe("3\n4")
  })

  it("nadpisy hotových častí pre ďalšiu časť — len nadpisy, posledné", () => {
    const parts = ["## B. USTANOVENIA\n\n### 1. ÚČASTNÍCI\ntext", "### 2. VYŽREBOVANIE\n#hashtag nie je nadpis"]
    expect(headingOutline(parts)).toBe("## B. USTANOVENIA\n### 1. ÚČASTNÍCI\n### 2. VYŽREBOVANIE")
    expect(headingOutline(parts, 1)).toBe("### 2. VYŽREBOVANIE")
    expect(headingOutline([])).toBe("")
  })

  it("textová vrstva strán s označením obrázkov", () => {
    const layer = [{ lines: ["a"], images: 0 }, { lines: ["b", "c"], images: 2 }]
    expect(layerText(layer, 2, 2)).toBe("--- strana 2 (obrázky: 2) ---\nb\nc")
  })

  it("okná analýzy po 100 stranách", () => {
    expect(analysisWindows(64)).toEqual([{ from: 1, to: 64 }])
    expect(analysisWindows(230)).toEqual([{ from: 1, to: 100 }, { from: 101, to: 200 }, { from: 201, to: 230 }])
  })

  it("priebeh: počet krokov je známy až po analýze", () => {
    const base = { windows: [{ from: 1, to: 53 }], pageCount: 53, partsFromModel: true } as const
    const job = (over: object) => ({ ...base, windowsDone: 0, parts: [], done: [], ...over }) as unknown as AiConversion
    expect(conversionPhase(job({}))).toEqual({ kind: "analysis", step: 1, steps: null, from: 1, to: 53, pageCount: 53 })
    const parts = fallbackParts(53)
    expect(conversionPhase(job({ windowsDone: 1, parts, done: ["a", "b"] })))
      .toEqual({ kind: "part", step: 4, steps: parts.length + 2, no: 3, of: parts.length, from: 9, to: 12, fromModel: true })
    expect(conversionPhase(job({ windowsDone: 1, parts, done: parts.map(() => "x") })))
      .toEqual({ kind: "finishing", step: parts.length + 2, steps: parts.length + 2 })
  })
})
