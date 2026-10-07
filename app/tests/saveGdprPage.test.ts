/**
 * saveGdprPage.test.ts — časť GDPR jedným uložením (ZAKLAD-lista-ulozenia):
 * kontakt, lehoty a doplnok v jednom `saveTenant`; lehoty len pri zmene (Q2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const s = vi.hoisted(() => ({ saveTenant: vi.fn<(...a: unknown[]) => Promise<void>>(async () => {}) }))
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/dpo", () => ({
  dpoContext: async () => ({
    state: "ready", person: { companyCode: "SFZ", language: "sk", email: "dpo@sfz.sk" },
    tenant: { languages: ["sk"], privacy: { retention: { evidenceYears: 5, capYears: 10, learningDetailMonths: 24, answersMonths: 6 } } },
  }),
}))
vi.mock("@/lib/objectionsDb", () => ({}))
vi.mock("@/lib/tenantAdmin", () => ({ saveTenant: s.saveTenant }))

import { saveGdprPageAction } from "../src/app/dpo/actions"

const form = (o: Record<string, string>) => { const fd = new FormData(); for (const [k, v] of Object.entries(o)) fd.append(k, v); return fd }
const base = { privacyContactName: "Lucia", privacyContactEmail: "dpo@sfz.sk", "extra-sk": "Doplnok", evidenceYears: "5", capYears: "10", learningDetailMonths: "24", answersMonths: "6" }
const patch = () => (s.saveTenant.mock.calls.at(-1) as unknown[])[1] as Record<string, unknown>

beforeEach(() => { s.saveTenant.mockClear() })

describe("saveGdprPageAction", () => {
  it("bez zmeny lehôt sa lehoty nezapisujú, kontakt a doplnok áno", async () => {
    await expect(saveGdprPageAction(form(base))).rejects.toThrow("redirect /organisation/gdpr?msg=")
    expect(s.saveTenant).toHaveBeenCalledTimes(1)
    expect(patch()).toMatchObject({ privacyContactName: "Lucia", privacyExtra: { sk: "Doplnok" } })
    expect(patch()).not.toHaveProperty("privacyRetention")
  })
  it("zmenená lehota ide do toho istého zápisu", async () => {
    await expect(saveGdprPageAction(form({ ...base, answersMonths: "3" }))).rejects.toThrow("redirect")
    expect(patch()).toMatchObject({ privacyRetention: { answersMonths: 3 } })
  })
})
