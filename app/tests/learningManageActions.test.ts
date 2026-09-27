/**
 * learningManageActions.test.ts — premenovanie smart:tagu na existujúci je
 * zlúčenie (MANAGE Q1): prvý krát sa vráti s upozornením, až potvrdenie
 * (`confirm=1`) zapíše. Zlúčenie vezme cieľ z vybraných alebo nový zápis.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const s = vi.hoisted(() => ({ rename: vi.fn(async () => ({ courses: 1, questions: 0, tests: 0 })), merge: vi.fn(async () => ({ courses: 1, questions: 0, tests: 0 })) }))

vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/learning", () => ({
  learningAdminContext: async () => ({ state: "ready", person: { companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" }, tenant: { learningTopics: [] } }),
}))
vi.mock("@/lib/coursesDb", () => ({ createCourse: async () => ({}) }))
vi.mock("@/lib/smartTagsDb", async () => {
  const { parseSmartTag } = await import("../src/lib/smartTags")
  return {
    smartTagUsage: async () => [{ ...parseSmartTag("Bezpečnosť: Výťah")!, courses: 2, questions: 0, tests: 0 }, { ...parseSmartTag("Bezpečnosť: Lift")!, courses: 1, questions: 0, tests: 0 }],
    renameSmartTag: s.rename, renameSmartTagKey: vi.fn(), mergeSmartTags: s.merge,
  }
})

import { renameTagAction, mergeTagsAction } from "../src/app/learning/manage/actions"

const form = (o: Record<string, string | string[]>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) fd.append(k, x)
  return fd
}

beforeEach(() => { s.rename.mockClear(); s.merge.mockClear() })

describe("renameTagAction", () => {
  it("na existujúci tag sa najprv vráti s upozornením", async () => {
    await expect(renameTagAction(form({ from: "bezpecnost:lift", to: "Bezpečnosť: Výťah" }))).rejects.toThrow(/exists=1/)
    expect(s.rename).not.toHaveBeenCalled()
  })
  it("s potvrdením zapíše", async () => {
    await expect(renameTagAction(form({ from: "bezpecnost:lift", to: "Bezpečnosť: Výťah", confirm: "1" }))).rejects.toThrow(/tab=tags&msg=/)
    expect(s.rename).toHaveBeenCalledWith("SFZ", { key: "bezpecnost", value: "lift" }, "Bezpečnosť: Výťah", "jan@sfz.sk")
  })
  it("na nový zápis rovno", async () => {
    await expect(renameTagAction(form({ from: "bezpecnost:lift", to: "Bezpečnosť: Eskalátor" }))).rejects.toThrow(/msg=/)
    expect(s.rename).toHaveBeenCalled()
  })
})

describe("mergeTagsAction", () => {
  it("cieľ z vybraných aj nový zápis", async () => {
    await expect(mergeTagsAction(form({ tag: ["bezpecnost:lift", "bezpecnost:vytah"], target: "bezpecnost:vytah" }))).rejects.toThrow(/redirect/)
    expect(s.merge).toHaveBeenLastCalledWith("SFZ", [{ key: "bezpecnost", value: "lift" }, { key: "bezpecnost", value: "vytah" }], "Bezpečnosť: Výťah", "jan@sfz.sk")
    await expect(mergeTagsAction(form({ tag: ["bezpecnost:lift", "bezpecnost:vytah"], target: "__new", newLabel: "Budova: Výťah" }))).rejects.toThrow(/redirect/)
    expect(s.merge).toHaveBeenLastCalledWith("SFZ", expect.any(Array), "Budova: Výťah", "jan@sfz.sk")
  })
})
