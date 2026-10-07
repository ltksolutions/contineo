/**
 * learningTestActions.test.ts — akcie obrazovky Testy: sekcie cez `op`
 * (pridať, posunúť, odstrániť) v jednom formulári, zodpovedné osoby len
 * z organizácie, otázka podľa typu.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const s = vi.hoisted(() => ({ save: vi.fn(async () => ({ problems: [] })), saveQ: vi.fn(async () => ({ key: "q1" })) }))
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/learning", () => ({ learningAdminContext: async () => ({ state: "ready", person: { companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" } }) }))
vi.mock("@/lib/testsDb", () => ({ getTest: async () => ({ key: "t", title: "T" }), saveTest: s.save, createTest: vi.fn(), setTestRetired: vi.fn() }))
vi.mock("@/lib/questionsDb", () => ({ getQuestion: async () => null, saveQuestion: s.saveQ, setQuestionStatus: vi.fn(), importQuestions: vi.fn() }))
vi.mock("@/lib/people", () => ({ listPeople: async () => [{ id: "p1", fullName: "Marek", email: "m@sfz.sk" }] }))
vi.mock("@/lib/fileStore", () => ({ fileInfo: async () => null }))
vi.mock("@/lib/questionImports", () => ({ storeImport: vi.fn(), loadImport: vi.fn(), dropImport: vi.fn(), MAX_IMPORT_BYTES: 1 }))

import { saveQuestionAction, saveTestAction } from "../src/app/learning/tests/actions"

const form = (o: Record<string, string | string[]>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) fd.append(k, x); return fd }
const base = { testKey: "t", title: "T", sections: "2", section_0_key: "a", section_0_tags: "Bezpečnosť: Požiar", section_0_count: "3", section_1_key: "b", section_1_tags: "Úroveň: 1", section_1_count: "2", passingPercent: "70", showAnswers: "never", responsiblePersonId: ["p1", "cudzi"] }

beforeEach(() => { s.save.mockClear(); s.saveQ.mockClear() })

describe("saveTestAction", () => {
  const change = () => (s.save.mock.calls.at(-1) as unknown[])[2] as { sections: { key: string; count: number }[]; responsible: { personId: string }[]; rules: { passingPercent: number; showAnswers: string } }
  it("uloží sekcie, pravidlá a len osoby z organizácie", async () => {
    await expect(saveTestAction(form(base))).rejects.toThrow(/msg=/)
    expect(change().sections.map(x => [x.key, x.count])).toEqual([["a", 3], ["b", 2]])
    expect(change().responsible.map(r => r.personId)).toEqual(["p1"])
    expect(change().rules).toMatchObject({ passingPercent: 70, showAnswers: "never" })
  })
  it("op: pridať, posunúť, odstrániť — bez oznamu, späť na sekcie", async () => {
    await expect(saveTestAction(form({ ...base, op: "add" }))).rejects.toThrow(/#sections/)
    expect(change().sections).toHaveLength(3)
    await expect(saveTestAction(form({ ...base, op: "down:0" }))).rejects.toThrow(/redirect/)
    expect(change().sections.map(x => x.key)).toEqual(["b", "a"])
    await expect(saveTestAction(form({ ...base, op: "remove:1" }))).rejects.toThrow(/redirect/)
    expect(change().sections.map(x => x.key)).toEqual(["a"])
  })
})

describe("saveQuestionAction", () => {
  it("viac správnych: vyplnené odpovede a správne podľa indexov", async () => {
    await expect(saveQuestionAction(form({ type: "multiple", text: "Čo platí?", answer_0: "A", answer_1: "B", answer_2: "C", answer_3: "", correct: ["0", "2"], smartTags: "K: V", weight: "2" }))).rejects.toThrow(/\/learning\/tests\/questions\/q1\?msg=/)
    const input = (s.saveQ.mock.calls[0] as unknown[])[2] as { answers: { text: string; correct: boolean }[]; weight: number }
    expect(input.answers.map(a => [a.text, a.correct])).toEqual([["A", true], ["B", false], ["C", true]])
    expect(input.weight).toBe(2)
  })
  it("krátky text: očakávaná + alternatívy po riadkoch", async () => {
    await expect(saveQuestionAction(form({ type: "short_text", text: "Číslo?", expected: "150", alternatives: "112\n\n 158 ", smartTags: "K: V" }))).rejects.toThrow(/redirect/)
    expect(((s.saveQ.mock.calls[0] as unknown[])[2] as { expected: string[] }).expected).toEqual(["150", "112", "158"])
  })
})
