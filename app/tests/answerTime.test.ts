/**
 * answerTime.test.ts — štítok nad odpoveďou hovorí, ku ktorému dňu sa
 * odpovedá (plán „znenia v indexe", krok 6), v troch jazykoch.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Answer from "../src/components/Answer"
import type { AnswerState } from "../src/components/Answer"
import type { QueryTime } from "../src/lib/queryTime"

const today: QueryTime = { kind: "today", asOf: "2026-09-29", source: "default" }
const past: QueryTime = { kind: "asOf", asOf: "2020-01-01", source: "rules" }
const compare: QueryTime = { kind: "compare", asOf: "2026-09-29", source: "rules" }

const answered = (time: QueryTime): AnswerState => ({
  question: "q", text: "Výkonný výbor.", citations: [], running: false, time,
  done: {
    text: "Výkonný výbor.", citations: [], model: "m", provider: "anthropic", verifiedCitations: true,
    ttftMs: null, totalMs: 0, time, sources: [{ index: 1, title: "Stanovy SFZ" }],
  },
})

const html = (s: AnswerState, language: "sk" | "cs" | "en" = "sk") =>
  renderToStaticMarkup(createElement(Answer, { state: s, language }))

describe("štítok dňa odpovede", () => {
  it.each([
    ["sk", today, "podľa znení platných dnes, 29. 9. 2026"],
    ["sk", past, "podľa znení platných k 1. 1. 2020"],
    ["sk", compare, "porovnanie znení zatiaľ nevieme"],
    ["cs", past, "podle znění platných k 1. 1. 2020"],
    ["en", past, "per versions in force on 1 January 2020"],
    ["en", today, "per versions in force today, 29 September 2026"],
  ] as const)("%s %j", (language, time, expected) => {
    expect(html(answered(time), language)).toContain(expected)
  })

  it("iný deň než dnes je výrazný, dnešok nie", () => {
    expect(html(answered(past))).toContain("answer-time answer-time--other")
    expect(html(answered(compare))).toContain("answer-time answer-time--other")
    expect(html(answered(today))).not.toContain("answer-time--other")
  })

  it("štítok je už počas písania — z meta, pred done", () => {
    const running: AnswerState = { question: "q", text: "Výk", citations: [], running: true, done: null, time: past }
    expect(html(running)).toContain("podľa znení platných k 1. 1. 2020")
  })

  it("bez údaja o čase nič", () => {
    expect(html({ ...answered(today), time: undefined, done: { ...answered(today).done!, time: undefined } })).not.toContain("answer-time")
  })
})

describe("k dňu nie je platné znenie", () => {
  const none = (time: QueryTime, noVersions: boolean): AnswerState => ({
    question: "q", text: "", citations: [], running: false, time,
    done: { text: "", citations: [], model: "none", provider: "", verifiedCitations: false, ttftMs: null, totalMs: 0, sources: [], time, noVersions },
  })

  it("iná veta než „nič sa nenašlo“", () => {
    const out = html({ ...none({ kind: "asOf", asOf: "1990-12-31", source: "rules" }, true) })
    expect(out).toContain("K 31. 12. 1990 nemá organizácia žiadne platné znenie")
    expect(out).not.toContain("Skúste otázku inak")
  })

  it("keď znenia sú, ale nič sa nenašlo, zostáva pôvodná veta", () => {
    expect(html(none(past, false))).toContain("Skúste otázku inak")
  })
})
