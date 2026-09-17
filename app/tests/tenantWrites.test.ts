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
  find: vi.fn((filter: unknown) => {
    calls.push({ op: "find", filter })
    const empty = { toArray: async () => [] }
    return { ...empty, sort: () => empty }
  }),
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => fakeCollection) }))

import { recordAnswer, saveReaderFeedback, saveVerdict } from "../src/lib/ratings"
import { publishCuration, saveCurationDraft } from "../src/lib/curation"
import { MissingTenantError, requireCompanyCode } from "../src/lib/tenantScope"
import { personAcknowledgements, validAcknowledgements } from "../src/lib/acknowledgements"
import { readingFor, readingTimes } from "../src/lib/readingTime"
import { loadDocument, loadDocumentFor } from "../src/lib/documents"

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

describe("obrana do hĺbky — čítania majú organizáciu vždy (C1–C5)", () => {
  it("validAcknowledgements bez organizácie nečíta", async () => {
    await expect(validAcknowledgements({ versionId: "v1" } as never)).rejects.toThrow(MissingTenantError)
    expect(calls).toHaveLength(0)
  })

  it("validAcknowledgements má organizáciu v podmienke", async () => {
    await validAcknowledgements({ companyCode: "SFZ", personId: "p1", versionId: "v1" })
    expect(calls[0].filter).toMatchObject({ companyCode: "SFZ", personId: "p1", versionId: "v1" })
  })

  it("personAcknowledgements má organizáciu v podmienke", async () => {
    await personAcknowledgements("SFZ", "p1")
    expect(calls[0].filter).toEqual({ companyCode: "SFZ", personId: "p1" })
    await expect(personAcknowledgements("", "p1")).rejects.toThrow(MissingTenantError)
  })

  it("časy čítania majú organizáciu v podmienke", async () => {
    await readingFor("SFZ", "p1", "v1")
    await readingTimes("SFZ", "p1", ["v1"])
    expect(calls.map(c => c.filter)).toEqual([
      { companyCode: "SFZ", personId: "p1", versionId: "v1" },
      { companyCode: "SFZ", personId: "p1", versionId: { $in: ["v1"] } },
    ])
  })

  it("dokument sa načíta len v organizácii", async () => {
    await loadDocument("SFZ", "sfz:stanovy")
    expect(calls[0].filter).toEqual({ companyCode: "SFZ", documentId: "sfz:stanovy" })
    await expect(loadDocument("", "sfz:stanovy")).rejects.toThrow(MissingTenantError)
  })

  it("loadDocumentFor osobe bez organizácie nevráti nič a do databázy nejde", async () => {
    expect(await loadDocumentFor({ companyCode: "" }, "sfz:stanovy")).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
