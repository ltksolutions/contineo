/**
 * faqProposals.test.ts — fronta kuratora (ADR-030, D185).
 *
 * Kazde rozhodnutie zmaze povod (odpoved DPO 5) a zapise sa len nad
 * otvorenym navrhom; schvaleny zaznam ide do FAQ bez povodu.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const col = { findOne: vi.fn(), updateOne: vi.fn(), insertMany: vi.fn(), deleteMany: vi.fn() }
const saveFaqEntry = vi.fn()
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => col) }))
vi.mock("../src/lib/audit", () => ({ writeAudit: vi.fn() }))
vi.mock("../src/lib/faq", () => ({
  checkEntry: (x: Record<string, unknown>) => ({ question: x.question, variants: x.variants, answer: x.answer, audience: x.audience, sources: x.sources }),
  saveFaqEntry: (...a: unknown[]) => saveFaqEntry(...a),
}))

import { approveProposal, rejectProposal, mergeProposal, updateProposal, type FaqProposal } from "../src/lib/faqProposals"

const proposal = (over: Partial<FaqProposal> = {}): FaqProposal => ({
  id: "p1", companyCode: "SFZ", channelKey: "k", topicKey: "t1", topicLabel: "Heslo", question: "Ako obnovím heslo?",
  variants: ["zabudol som heslo"], answer: "Zabudnuté heslo.", audience: ["hráč"],
  sources: [{ documentId: "d1", title: "Príručka ISSF", articleRef: "čl. 3" }], threads: 40, firstMonth: "2023-10", lastMonth: "2026-09",
  flags: { changedOverTime: false, normConflict: false }, note: "", origin: { threadRefs: ["c1", "c2"] }, model: "m",
  createdAt: new Date(), status: "open", decidedAt: null, decidedBy: null, faqDocumentId: null, faqEntryId: null, mergedInto: null, ...over,
})

beforeEach(() => {
  col.findOne.mockReset()
  col.updateOne.mockReset().mockResolvedValue({ modifiedCount: 1 })
  saveFaqEntry.mockReset().mockResolvedValue({ id: "e1" })
})

describe("rozhodnutie kuratora", () => {
  it("schvalenie: zaznam s upravou kuratora ide do FAQ bez povodu, navrh strati povod", async () => {
    col.findOne.mockResolvedValue(proposal())
    expect(await approveProposal("SFZ", "k", "p1", { documentId: "faq1", answer: "Opravená odpoveď." }, "kurator@x.sk")).toBe("e1")
    const [code, doc, input] = saveFaqEntry.mock.calls[0]
    expect([code, doc]).toEqual(["SFZ", "faq1"])
    expect(input).toMatchObject({ answer: "Opravená odpoveď.", question: "Ako obnovím heslo?", id: null, sources: [{ documentId: "d1", articleRef: "čl. 3" }] })
    expect(input.origin).toBeUndefined()
    const [filter, update] = col.updateOne.mock.calls[0]
    expect(filter).toMatchObject({ id: "p1", status: "open" })
    expect(update.$set).toMatchObject({ status: "approved", origin: null, faqDocumentId: "faq1", faqEntryId: "e1" })
  })

  it("zamietnutie zmaze povod; o rozhodnutom navrhu sa druhy raz nerozhodne", async () => {
    col.findOne.mockResolvedValue(proposal())
    await rejectProposal("SFZ", "k", "p1", "kurator@x.sk")
    expect(col.updateOne.mock.calls[0][1].$set).toMatchObject({ status: "rejected", origin: null })
    col.findOne.mockResolvedValue(proposal({ status: "rejected" }))
    await expect(rejectProposal("SFZ", "k", "p1", "kurator@x.sk")).rejects.toMatchObject({ code: "proposal.decided" })
  })

  it("zlucenie prenesie otazku medzi varianty ciela a zluceny navrh strati povod", async () => {
    col.findOne.mockImplementation(async (f: { id: string }) => (f.id === "p1" ? proposal() : proposal({ id: "p2", question: "Zabudol som heslo do ISSF", variants: [] })))
    await mergeProposal("SFZ", "k", "p1", "p2", "kurator@x.sk")
    const target = col.updateOne.mock.calls.find(c => c[0].id === "p2")![1]
    expect(target.$set.variants).toEqual(["Ako obnovím heslo?", "zabudol som heslo"])
    // Odpoveď zlúčeného návrhu nevypadne — ide do poznámky cieľa; zdroje sa spoja.
    expect(target.$set.note).toContain("Zo zlúčeného návrhu „Ako obnovím heslo?“: Zabudnuté heslo.")
    expect(target.$set.sources).toEqual([{ documentId: "d1", title: "Príručka ISSF", articleRef: "čl. 3" }])
    const merged = col.updateOne.mock.calls.find(c => c[0].id === "p1")![1]
    expect(merged.$set).toMatchObject({ status: "merged", mergedInto: "p2", origin: null })
    await expect(mergeProposal("SFZ", "k", "p1", "p1", "x")).rejects.toMatchObject({ code: "proposal.mergeSelf" })
  })

  it("uprava bez schvalenia ulozi prve znenie do revision len raz", async () => {
    col.findOne.mockResolvedValue(proposal())
    await updateProposal("SFZ", "k", "p1", { answer: "Nová odpoveď." }, "kurator@x.sk")
    const set = col.updateOne.mock.calls[0][1].$set
    expect(set).toMatchObject({ answer: "Nová odpoveď.", editedBy: "kurator@x.sk" })
    expect(set.status).toBeUndefined()
    expect(set.revision.previous.answer).toBe("Zabudnuté heslo.")
    col.updateOne.mockClear()
    col.findOne.mockResolvedValue(proposal({ revision: { at: new Date(), by: "x", previous: { question: "q0", variants: [], answer: "a0", audience: [], sources: [], note: "" } } }))
    await updateProposal("SFZ", "k", "p1", { answer: "Ešte novšia." }, "kurator@x.sk")
    expect(col.updateOne.mock.calls[0][1].$set.revision).toBeUndefined()
  })
})
