/**
 * versionContext.test.ts — model aj čitateľ vidia, z ktorého znenia úsek je
 * a ku ktorému dňu sa odpovedá (plán „znenia v indexe", krok 5).
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { asOfInstruction, calendarDate, versionContext } from "../src/lib/versionContext"
import { attachVersions, effectiveVersionsOf } from "../src/lib/searchVersions"
import { documentBlock } from "../src/lib/providers/generation/anthropic"
import { buildContext } from "../src/lib/providers/generation/openai"
import { buildSources, buildSystemPrompt } from "../src/lib/llmGenerator"
import Answer from "../src/components/Answer"
import type { AnswerState } from "../src/components/Answer"
import type { ChunkResult, ChunkVersion } from "../src/lib/mongoSearch"
import type { DocumentRecord } from "../src/lib/documents"

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const v10: ChunkVersion = { label: "1.0", effectiveFrom: d("2016-06-04"), effectiveTo: null }
const vEnding: ChunkVersion = { label: "1.0", effectiveFrom: d("2016-06-04"), effectiveTo: d("2026-12-01") }

const chunk = (over: Partial<ChunkResult> = {}): ChunkResult => ({
  _id: "c1", text: "(1) Konferenciu zvoláva výkonný výbor.", documentId: "sfz:stanovy", versionId: "v1",
  articleRef: "čl. 40", heading: "Konferencia", document: { title: "Stanovy SFZ", slug: "stanovy", category: "norma" },
  ...over,
})

describe("versionContext", () => {
  it("znenie a začiatok účinnosti", () => {
    expect(versionContext(v10)).toBe("znenie 1.0 · účinné od 4. 6. 2016")
  })
  it("známy koniec účinnosti sa uvedie", () => {
    expect(versionContext(vEnding)).toBe("znenie 1.0 · účinné od 4. 6. 2016 do 1. 12. 2026")
  })
  it("bez znenia nič", () => {
    expect(versionContext(undefined)).toBeUndefined()
  })
})

describe("deň odpovede v Bratislave", () => {
  it("0:30 v Bratislave je už nový deň, hoci v UTC ešte nie", () => {
    expect(calendarDate(new Date("2026-09-28T22:30:00Z")).toISOString()).toBe("2026-09-29T00:00:00.000Z")
  })
  it("pokyn nesie deň a čo robiť s koncom účinnosti", () => {
    const p = asOfInstruction(new Date("2026-09-29T10:00:00Z"))
    expect(p).toContain("platných ku dňu 29. 9. 2026")
    expect(p).toContain("koniec účinnosti")
  })
  it("systémový prompt ho obsahuje", () => {
    expect(buildSystemPrompt("internal", true, new Date("2026-09-29T10:00:00Z"))).toContain("ku dňu 29. 9. 2026")
  })
})

describe("attachVersions", () => {
  it("pripojí znenie podľa versionId, overenej odpovedi nič", () => {
    const [norm, qa] = attachVersions(
      [chunk(), chunk({ _id: "q1", versionId: undefined, sourceType: "qa" })],
      { v1: v10 },
    )
    expect(norm.version).toEqual(v10)
    expect(qa.version).toBeUndefined()
  })

  it("znenia z documents nesú označenie a účinnosť", () => {
    const doc = { documentId: "x", title: "x", versions: [
      { versionId: "old", label: "1.0", effectiveFrom: d("2020-01-01"), effectiveTo: d("2026-12-01"), isActive: false },
      { versionId: "new", label: "2.0", effectiveFrom: d("2026-12-01"), effectiveTo: null, isActive: true },
    ] } as unknown as DocumentRecord
    expect(effectiveVersionsOf([doc], d("2026-09-29"))).toEqual({
      old: { label: "1.0", effectiveFrom: d("2020-01-01"), effectiveTo: d("2026-12-01") },
    })
  })
})

describe("kontext pre model", () => {
  it("Anthropic: znenie v context, text úseku nezmenený (citácie)", () => {
    const b = documentBlock(chunk({ version: vEnding }), true)
    expect(b.context).toBe("Konferencia · čl. 40 · znenie 1.0 · účinné od 4. 6. 2016 do 1. 12. 2026")
    expect(b.source.data).toBe("(1) Konferenciu zvoláva výkonný výbor.")
  })
  it("OpenAI: znenie v hlavičke zdroja", () => {
    expect(buildContext([chunk({ version: v10 })])).toContain("[1] Zdroj: Stanovy SFZ (čl. 40) — znenie 1.0 · účinné od 4. 6. 2016\n")
  })
})

describe("zdroje pod odpoveďou", () => {
  it("buildSources nesie kópiu znenia s ISO dátumami", () => {
    const [s] = buildSources([chunk({ version: vEnding })])
    expect(s.version).toEqual({ label: "1.0", effectiveFrom: "2016-06-04T00:00:00.000Z", effectiveTo: "2026-12-01T00:00:00.000Z" })
  })

  const state = (): AnswerState => ({
    question: "Kto zvoláva konferenciu?", text: "Výkonný výbor.", citations: [], running: false,
    done: {
      text: "Výkonný výbor.", citations: [], model: "m", provider: "anthropic", verifiedCitations: true,
      ttftMs: null, totalMs: 0,
      sources: [
        { index: 1, title: "Stanovy SFZ", articleRef: "čl. 40",
          version: { label: "1.0", effectiveFrom: "2016-06-04T00:00:00.000Z", effectiveTo: "2026-12-01T00:00:00.000Z" } },
        { index: 2, title: "Overená odpoveď", sourceType: "qa" },
      ],
    },
  })

  it.each([
    ["sk", "znenie 1.0 · účinné od 4. 6. 2016 do 1. 12. 2026"],
    ["cs", "znění 1.0 · účinné od 4. 6. 2016 do 1. 12. 2026"],
    ["en", "version 1.0 · in force from 4 June 2016 until 1 December 2026"],
  ] as const)("zobrazí znenie zdroja (%s)", (language, expected) => {
    const html = renderToStaticMarkup(createElement(Answer, { state: state(), language }))
    expect(html).toContain(expected)
  })

  it("overená odpoveď znenie nemá", () => {
    const html = renderToStaticMarkup(createElement(Answer, { state: state(), language: "sk" }))
    expect(html.match(/znenie 1\.0/g)).toHaveLength(1)
  })
})
