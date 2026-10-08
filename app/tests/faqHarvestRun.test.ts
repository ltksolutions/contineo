/**
 * faqHarvestRun.test.ts — beh tazby FAQ: zamok kuska a identita behu
 * (ADR-030, 9. 10. 2026 — restart pocas behu prepisal temy noveho behu).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const harvests = { findOneAndUpdate: vi.fn(), updateOne: vi.fn(), findOne: vi.fn() }
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async (name: string) => (name === "faq_harvests" ? harvests : { updateOne: vi.fn(), deleteMany: vi.fn() })) }))
vi.mock("../src/lib/channels", () => ({ channelByKey: vi.fn(async () => ({ key: "k", name: "K", mailbox: { kind: "graph" } })), mailboxFor: vi.fn() }))
vi.mock("../src/lib/aiSettings", () => ({ aiForCompany: vi.fn(async () => ({ apiKey: "x", keySource: "tenant", models: { utility: "u", answer: "a" } })) }))

import { continueHarvest } from "../src/lib/faqHarvest"

beforeEach(() => {
  harvests.findOneAndUpdate.mockReset()
  harvests.updateOne.mockReset().mockResolvedValue({ matchedCount: 1 })
})

describe("continueHarvest", () => {
  it("bez zamku (iny kusok prave bezi) nerobi nic", async () => {
    harvests.findOneAndUpdate.mockResolvedValue(null)
    expect(await continueHarvest("SFZ", "k", { budgetMs: 1, hardMs: 1000 })).toBe(0)
    const [filter, update] = harvests.findOneAndUpdate.mock.calls[0]
    expect(filter.$or).toBeDefined()
    expect(update.$set.leaseUntil).toBeInstanceOf(Date)
    expect(harvests.updateOne).not.toHaveBeenCalled()
  })

  it("nahradeny beh (iny runId) skonci bez prace a zamok uvolni len pre svoj runId", async () => {
    harvests.findOneAndUpdate.mockResolvedValue({ runId: "old", stage: "collect", pending: ["2026-09"], draftPending: [], topics: [], startedBy: "x" })
    harvests.updateOne.mockResolvedValue({ matchedCount: 0 })
    expect(await continueHarvest("SFZ", "k", { budgetMs: 1, hardMs: 1000 })).toBe(0)
    for (const [filter] of harvests.updateOne.mock.calls) expect(filter).toMatchObject({ companyCode: "SFZ", channelKey: "k", runId: "old" })
    expect(harvests.updateOne.mock.calls.at(-1)![1]).toEqual({ $set: { leaseUntil: null } })
  })
})
