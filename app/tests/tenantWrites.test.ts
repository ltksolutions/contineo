/**
 * tenantWrites.test.ts — zápisy podľa `_id` majú organizáciu v podmienke (D90).
 *
 * Audit `docs/D90_audit_dotazov.md` (A1–A4): posudok, spätná väzba čitateľa
 * a kurácia sa zapisovali len podľa `_id`. Kto poznal ObjectId záznamu inej
 * organizácie, zapísal doň — a pri kurácii zverejnil pár do jej znalostí.
 * Testy strážia tvar podmienky, nie databázu: práve tvar podmienky bol chybou.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const calls: { op: string; filter: unknown }[] = []
const fakeCollection = {
  updateOne: vi.fn(async (filter: unknown) => { calls.push({ op: "updateOne", filter }); return { matchedCount: 0 } }),
  findOne: vi.fn(async (filter: unknown) => { calls.push({ op: "findOne", filter }); return null }),
  insertOne: vi.fn(async (doc: unknown) => { calls.push({ op: "insertOne", filter: doc }); return { insertedId: "x" } }),
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => fakeCollection) }))

import { recordAnswer, saveReaderFeedback, saveVerdict } from "../src/lib/ratings"
import { publishCuration, saveCurationDraft } from "../src/lib/curation"
import { MissingTenantError, requireCompanyCode } from "../src/lib/tenantScope"

const ID = "64b7f0f0f0f0f0f0f0f0f0f0"

beforeEach(() => { calls.length = 0 })

describe("requireCompanyCode", () => {
  it("vráti orezanú organizáciu", () => {
    expect(requireCompanyCode(" SFZ ", "test")).toBe("SFZ")
  })
  it.each([[undefined], [""], ["  "], [["SFZ"]], [null]])("vyhodí výnimku pre %j", v => {
    expect(() => requireCompanyCode(v, "test")).toThrow(MissingTenantError)
  })
})

describe("ratings — organizácia v podmienke", () => {
  it("saveVerdict hľadá záznam podľa _id A organizácie", async () => {
    await saveVerdict(ID, { correct: 1 }, "p1", "SFZ")
    expect(calls[0].filter).toMatchObject({ companyCode: "SFZ" })
  })

  it("saveReaderFeedback hľadá záznam podľa _id A organizácie", async () => {
    await saveReaderFeedback(ID, { verdict: 0, note: "nesedí" }, "p1", "SFZ")
    expect(calls[0].filter).toMatchObject({ companyCode: "SFZ" })
  })

  it("bez organizácie sa nezapíše nič", async () => {
    await expect(saveVerdict(ID, { correct: 1 }, "p1", "")).rejects.toThrow(MissingTenantError)
    await expect(saveReaderFeedback(ID, { verdict: 1 }, "p1", undefined as never)).rejects.toThrow(MissingTenantError)
    await expect(recordAnswer({ question: "q", answer: "a" } as never, "p1", "")).rejects.toThrow(MissingTenantError)
    expect(calls).toHaveLength(0)
  })

  it("recordAnswer zapíše organizáciu vždy", async () => {
    await recordAnswer({ question: "q", answer: "a" } as never, "p1", "SFZ")
    expect(calls[0].filter).toMatchObject({ companyCode: "SFZ" })
  })
})

describe("kurácia — organizácia konajúceho, nie záznamu", () => {
  it("saveCurationDraft hľadá záznam podľa _id A organizácie", async () => {
    await expect(saveCurationDraft(ID, { question: "q", answer: "a", chunkIds: [ID] }, "p1", "SFZ"))
      .rejects.toThrow()
    expect(calls.find(c => c.op === "findOne")?.filter).toMatchObject({ companyCode: "SFZ" })
  })

  it("publishCuration hľadá záznam podľa _id A organizácie", async () => {
    await expect(publishCuration(ID, "p1", "LTK")).rejects.toThrow()
    expect(calls.find(c => c.op === "findOne")?.filter).toMatchObject({ companyCode: "LTK" })
  })

  it("bez organizácie sa kurácia nespustí", async () => {
    await expect(publishCuration(ID, "p1", "")).rejects.toThrow(MissingTenantError)
    await expect(saveCurationDraft(ID, { question: "q", answer: "a", chunkIds: [ID] }, "p1", "")).rejects.toThrow(MissingTenantError)
    expect(calls).toHaveLength(0)
  })
})
