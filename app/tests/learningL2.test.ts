/**
 * learningL2.test.ts — banka otázok, testy a pokusy (ADR-018, D120, D121):
 * kontrola otázky, CSV (TESTS Q1), losovanie so seedom bez opakovania,
 * bodovanie všetko-alebo-nič (TESTS Q2), dostupnosť pokusu.
 */
import { describe, it, expect } from "vitest"
import { exportQuestionsCsv, importQuestionsCsv, normalizeShortText, parseCsvRecords, questionProblems, shortTextMatches, type Question } from "../src/lib/questions"
import { recipeChanged, testProblems, DEFAULT_RULES, type Test } from "../src/lib/tests"
import { answersVisible, availability, drawQuestions, isCorrect, rng, scoreAttempt, sectionAvailability, shuffle, snapshotOf } from "../src/lib/testAttempts"
import { parseSmartTag } from "../src/lib/smartTags"

const T = (s: string) => parseSmartTag(s)!
const at = new Date("2026-10-01T10:00:00Z")
const q = (key: string, over: Partial<Question> = {}): Question => ({
  companyCode: "SFZ", key, type: "single", text: `Otázka ${key}`, media: [],
  answers: [{ id: "a1", text: "áno", correct: true }, { id: "a2", text: "nie", correct: false }],
  weight: 1, difficulty: "medium", smartTags: [T("Bezpečnosť: Požiar")], status: "active", version: 1, createdAt: at, createdBy: "jan", ...over,
})

describe("otázka", () => {
  it("platná jedna správna", () => expect(questionProblems(q("x"))).toEqual([]))
  it("pomenuje chyby", () => {
    expect(questionProblems(q("x", { text: "", smartTags: [], answers: [{ id: "a", text: "x", correct: false }, { id: "b", text: "", correct: false }] })))
      .toEqual(["question.contentRequired", "question.answerEmpty", "question.singleOneCorrect", "question.tagRequired"])
    expect(questionProblems(q("x", { type: "multiple" }))).toContain("question.tooFewAnswers")
    expect(questionProblems(q("x", { type: "short_text", answers: [], expected: [] }))).toEqual(["question.expectedRequired"])
  })
  it("otázka len s obrázkom je v poriadku, bez popisu nie", () => {
    expect(questionProblems(q("x", { text: "", media: [{ kind: "image", fileId: "f", alt: "Plán" }] }))).toEqual([])
    expect(questionProblems(q("x", { media: [{ kind: "image", fileId: "f", alt: " " }] }))).toEqual(["question.altRequired"])
  })
  it("krátky text bez diakritiky a veľkosti", () => {
    expect(normalizeShortText("  Hasiaci   PRÍSTROJ ")).toBe("hasiaci pristroj")
    expect(shortTextMatches("hasiaci pristroj", ["Hasiaci prístroj", "hasičák"])).toBe(true)
    expect(shortTextMatches("", ["x"])).toBe(false)
  })
})

describe("CSV", () => {
  const csv = '﻿id;type;text;answer_1;answer_2;answer_3;correct;explanation;weight;difficulty;tags\n' +
    'poziar-1;single;"Kde je\nhasiaci prístroj?";Chodba;Kuchyňa;;1;;2;easy;Bezpečnosť: Požiar | Úroveň: 1\n' +
    ';multiple;Čo platí?;A;B;C;1,3;;;;Bezpečnosť: Výťah\n' +
    ';true_false;Výťah je únikový;;;;false;;;;Bezpečnosť: Výťah\n' +
    ';short_text;Číslo hasičov?;150;112;;;;;;Bezpečnosť: Požiar\n'
  it("nový riadok v bunke, typy, tagy", () => {
    const r = importQuestionsCsv(csv)
    expect(r.errors).toEqual([])
    expect(r.questions.map(x => x.question.type)).toEqual(["single", "multiple", "true_false", "short_text"])
    expect(r.questions[0].question.text).toBe("Kde je\nhasiaci prístroj?")
    expect(r.questions[0].line).toBe(2)
    expect(r.questions[1].line).toBe(4)
    expect(r.questions[0].question.weight).toBe(2)
    expect(r.questions[1].question.answers.filter(a => a.correct).map(a => a.id)).toEqual(["a1", "a3"])
    expect(r.questions[3].question.expected).toEqual(["150", "112"])
    expect(r.tags.length).toBe(3)
  })
  it("pri chybe sa neimportuje nič a chyby majú riadok", () => {
    const bad = 'id;type;text;answer_1;answer_2;correct;tags\nx;single;Q;A;B;1,2;K: V\nx;nieco;Q;;;;K: V\n;single;Q;A;B;1;\n'
    const r = importQuestionsCsv(bad)
    expect(r.questions).toEqual([])
    expect(r.errors.map(e => [e.line, e.code])).toEqual([[2, "csv.singleOne"], [3, "csv.type"], [4, "csv.tagsRequired"]])
  })
  it("export sa dá nahrať späť", () => {
    const back = importQuestionsCsv(exportQuestionsCsv([q("poziar-1", { text: 'Riadok 1\n"úvodzovky"' })]))
    expect(back.errors).toEqual([])
    expect(back.questions[0]).toMatchObject({ id: "poziar-1", question: { text: 'Riadok 1\n"úvodzovky"' } })
  })
  it("parser s čiarkou ako oddeľovačom", () => {
    expect(parseCsvRecords("a,b\n1,2\n").rows[0].cells).toEqual({ a: "1", b: "2" })
  })
})

describe("test", () => {
  const base: Pick<Test, "title" | "responsible" | "sections" | "rules"> = {
    title: "BOZP", responsible: [{ personId: "p", fullName: "P", email: "p@x" }],
    sections: [{ key: "s1", filter: [T("Bezpečnosť: Požiar")], count: 3 }], rules: DEFAULT_RULES,
  }
  it("pripravený len s osobou a dosť otázkami", () => {
    expect(testProblems(base, new Map([["s1", 5]]))).toEqual([])
    expect(testProblems({ ...base, responsible: [] }, new Map([["s1", 2]])).map(p => p.code)).toEqual(["test.noResponsible", "test.sectionShort"])
  })
  it("zmena receptu sa pozná, zmena názvu nie", () => {
    expect(recipeChanged(base, { ...base })).toBe(false)
    expect(recipeChanged(base, { ...base, rules: { ...base.rules, passingPercent: 70 } })).toBe(true)
  })
})

describe("pokus", () => {
  const bank = [q("a"), q("b"), q("c", { smartTags: [T("Bezpečnosť: Výťah")] }), q("d", { smartTags: [T("Bezpečnosť: Výťah"), T("Bezpečnosť: Požiar")] }), q("e", { status: "retired" })]
  const recipe = { sections: [{ key: "s1", filter: [T("Bezpečnosť: Výťah")], count: 2 }, { key: "s2", filter: [T("Bezpečnosť: Požiar")], count: 2 }] }
  it("seed je deterministický, miešanie je permutácia", () => {
    expect(shuffle([1, 2, 3, 4, 5], rng(7))).toEqual(shuffle([1, 2, 3, 4, 5], rng(7)))
    expect(shuffle([1, 2, 3, 4, 5], rng(7)).sort()).toEqual([1, 2, 3, 4, 5])
  })
  it("losovanie bez opakovania, vyradené nie, málo = null", () => {
    const d = drawQuestions(recipe, bank, 42)!
    expect(d).toHaveLength(4)
    expect(new Set(d.map(x => x.questionKey)).size).toBe(4)
    expect(d.map(x => x.questionKey)).not.toContain("e")
    expect(drawQuestions({ sections: [{ key: "s", filter: [T("Bezpečnosť: Výťah")], count: 3 }] }, bank, 1)).toBeNull()
    expect(sectionAvailability(recipe, bank)).toEqual(new Map([["s1", 2], ["s2", 3]]))
  })
  it("viac správnych: všetko alebo nič; váhy", () => {
    const m = snapshotOf(q("m", { type: "multiple", weight: 2, answers: [{ id: "1", text: "a", correct: true }, { id: "2", text: "b", correct: true }, { id: "3", text: "c", correct: false }] }), rng(1))
    expect(isCorrect(m, { kind: "choice", ids: ["1", "2"] })).toBe(true)
    expect(isCorrect(m, { kind: "choice", ids: ["1"] })).toBe(false)
    expect(isCorrect(m, { kind: "choice", ids: ["1", "2", "3"] })).toBe(false)
    const tf = snapshotOf(q("t", { type: "true_false", answers: [], correctTrue: false }), rng(1))
    const s = scoreAttempt([m, tf], { m: { kind: "choice", ids: ["2", "1"] }, t: { kind: "bool", value: true } }, 60)
    expect(s).toMatchObject({ points: 2, maxPoints: 3, percent: 67, passed: true, results: [true, false] })
  })
  it("dostupnosť: otvorený, pauza, vyčerpané, prešiel, reset sa neráta", () => {
    const now = at
    const closed = (min: number, passed = false, reset = false) => ({ id: String(min), startedAt: new Date(now.getTime() - (min + 5) * 60000), deadlineAt: null, submittedAt: new Date(now.getTime() - min * 60000), passed, resetAt: reset ? now : null })
    expect(availability([{ id: "o", startedAt: now, deadlineAt: null, submittedAt: null, passed: undefined, resetAt: null }], {}, now).open?.id).toBe("o")
    expect(availability([closed(10)], { pauseMinutes: 30 }, now)).toMatchObject({ canStart: false, reason: "pause" })
    expect(availability([closed(40)], { pauseMinutes: 30 }, now).canStart).toBe(true)
    expect(availability([closed(60), closed(50), closed(40)], { maxAttempts: 3 }, now)).toMatchObject({ reason: "exhausted", remaining: 0 })
    expect(availability([closed(60, false, true), closed(50), closed(40)], { maxAttempts: 3 }, now)).toMatchObject({ canStart: true, remaining: 1 })
    expect(availability([closed(40, true)], {}, now).reason).toBe("passed")
    const expired = { id: "x", startedAt: new Date(now.getTime() - 3600000), deadlineAt: new Date(now.getTime() - 60000), submittedAt: null, passed: undefined, resetAt: null }
    expect(availability([expired], {}, now).open).toBeNull()
  })
  it("kedy vidno správne odpovede", () => {
    expect(answersVisible("after_submit", false, false)).toBe(true)
    expect(answersVisible("after_pass", false, false)).toBe(false)
    expect(answersVisible("after_last_attempt", false, true)).toBe(true)
    expect(answersVisible("never", true, true)).toBe(false)
  })
})
