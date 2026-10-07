/**
 * learningPartTestsAction.test.ts — testy časti ako jeden formulár
 * (MANAGE-COURSE-akcie, 7. 10. 2026): „Uložiť testy" zapíše prepínače
 * „Povinný", „Odobrať" a „Priradiť test" (formaction) ich zapíšu tiež.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Part } from "../src/lib/courses"

const s = vi.hoisted(() => ({ draft: vi.fn<(...a: unknown[]) => Promise<void>>(async () => {}) }))
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/learning", () => ({
  learningAdminContext: async () => ({ state: "ready", person: { companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" }, tenant: { companyCode: "SFZ" } }),
}))
const part: Part = { key: "uvod", title: "Úvod", required: true, blocks: [{ id: "t", type: "text", markdown: "x" }], tests: [{ testKey: "a", required: true }, { testKey: "b", required: false }] }
vi.mock("@/lib/coursesDb", () => ({
  getCourse: async () => ({ key: "k", language: "sk", versions: [{ versionId: "v1", version: 1, state: "draft", parts: [part] }] }),
  saveDraft: s.draft, saveCourseSettings: vi.fn(), archiveCourse: vi.fn(), publishCourse: vi.fn(), startNewVersion: vi.fn(),
}))
vi.mock("@/lib/testsDb", () => ({ readyTestVersions: async () => new Map([["c", 1]]) }))
vi.mock("@/lib/courseDocs", () => ({ documentChoices: async () => [] }))

import { addPartTestAction, removePartTestAction, savePartTestsAction } from "../src/app/learning/manage/[courseKey]/actions"

const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd }
const saved = () => ((s.draft.mock.calls.at(-1) as unknown[])[2] as { parts: Part[] }).parts[0].tests

beforeEach(() => { s.draft.mockClear() })

describe("testy časti", () => {
  it("Uložiť testy: vypnutý prepínač = nepovinný, zapnutý = povinný", async () => {
    await expect(savePartTestsAction(form({ courseKey: "k", partKey: "uvod", "required:b": "1" }))).rejects.toThrow("redirect /learning/manage/k/parts/uvod")
    expect(saved()).toEqual([{ testKey: "a", required: false }, { testKey: "b", required: true }])
  })
  it("Odobrať zapíše aj prepínače ostatných", async () => {
    await expect(removePartTestAction(form({ courseKey: "k", partKey: "uvod", "required:a": "1", "required:b": "1", removeTestKey: "a" }))).rejects.toThrow("redirect")
    expect(saved()).toEqual([{ testKey: "b", required: true }])
  })
  it("Priradiť test: nový je povinný", async () => {
    await expect(addPartTestAction(form({ courseKey: "k", partKey: "uvod", "required:a": "1", addTestKey: "c" }))).rejects.toThrow("redirect")
    expect(saved().map(t => [t.testKey, t.required])).toEqual([["a", true], ["b", false], ["c", true]])
  })
})
