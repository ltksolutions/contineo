/**
 * learningSettingsAction.test.ts — uloženie nastavení kurzu: polia verzie
 * do konceptu (null maže), téma, tagy a samozápis na kurz; vydavateľ je
 * organizácia (kópia) len pri certifikáte.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const s = vi.hoisted(() => ({ draft: vi.fn(async () => {}), settings: vi.fn(async () => {}), hasDraft: true }))
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/learning", () => ({
  learningAdminContext: async () => ({
    state: "ready", person: { companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" },
    tenant: { companyCode: "SFZ", branding: { displayName: "Slovenský futbalový zväz", shortName: "SFZ" }, learningTopics: [{ key: "bozp", label: "BOZP" }] },
  }),
}))
vi.mock("@/lib/coursesDb", () => ({
  getCourse: async () => ({ key: "k", language: "sk", versions: [{ versionId: "v1", version: 1, state: s.hasDraft ? "draft" : "published", parts: [] }] }),
  saveDraft: s.draft, saveCourseSettings: s.settings,
  archiveCourse: vi.fn(), publishCourse: vi.fn(), startNewVersion: vi.fn(),
}))
vi.mock("@/lib/courseDocs", () => ({ documentChoices: async () => [] }))

import { saveSettingsAction } from "../src/app/learning/manage/[courseKey]/actions"

const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd }
const base = { courseKey: "k", title: "BOZP", topicKey: "bozp", language: "cs", smartTags: "Úroveň: 1\nBezpečnosť: Výťah", legalBasisKey: "legitimate_interest" }

beforeEach(() => { s.draft.mockClear(); s.settings.mockClear(); s.hasDraft = true })

describe("saveSettingsAction", () => {
  it("koncept: verzia a kurz, vydavateľ len s certifikátom", async () => {
    await expect(saveSettingsAction(form({ ...base, issuesCertificate: "1", sequential: "1" }))).rejects.toThrow(/\/learning\/manage\/k\/settings\?msg=/)
    const patch = (s.draft.mock.calls[0] as unknown[])[2] as Record<string, unknown>
    expect(patch).toMatchObject({ title: "BOZP", sequential: true, issuesCertificate: true, subtitle: null, issuer: { kind: "tenant", name: "Slovenský futbalový zväz" } })
    const settings = (s.settings.mock.calls[0] as unknown[])[2] as { smartTags: { label: string }[]; language: string; openEnrollment: boolean }
    expect(settings.smartTags.map(x => x.label)).toEqual(["Úroveň: 1", "Bezpečnosť: Výťah"])
    expect(settings.language).toBe("cs")
    expect(settings.openEnrollment).toBe(false)
    await expect(saveSettingsAction(form(base))).rejects.toThrow(/redirect/)
    expect(((s.draft.mock.calls[1] as unknown[])[2] as Record<string, unknown>).issuer).toBeNull()
  })

  it("zlý tag a zverejnená verzia sa neuložia", async () => {
    await expect(saveSettingsAction(form({ ...base, smartTags: "bez dvojbodky" }))).rejects.toThrow(/error=1/)
    s.hasDraft = false
    await expect(saveSettingsAction(form(base))).rejects.toThrow(/error=1/)
    expect(s.draft).not.toHaveBeenCalled()
  })
})
