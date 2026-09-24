/**
 * versionFlow.test.ts — postup znenia v štyroch krokoch (ADR-014): krok sa
 * odvodzuje z konceptu, kôl a pridelení, nikde sa neukladá.
 */
import { describe, it, expect } from "vitest"
import { versionFlow, lastPreparationRound, previousApproverIds, rejectedBy } from "../src/lib/versionFlow"
import type { ApprovalRound } from "../src/lib/approvals"

const round = (over: Partial<ApprovalRound>): ApprovalRound => ({
  companyCode: "sfz",
  documentId: "sfz:x",
  versionId: "v1",
  round: 1,
  submittedBy: "jan@sfz.sk",
  submittedAt: new Date("2026-09-23T10:00:00Z"),
  approvers: [
    { email: "marek@sfz.sk", fullName: "Marek", decidedAt: null, decision: null },
    { email: "peter@sfz.sk", fullName: "Peter", decidedAt: null, decision: null },
  ],
  closedAt: null,
  outcome: null,
  ...over,
})

describe("versionFlow", () => {
  it("bez prípravy a bez prenosu nie je žiadna karta", () => {
    expect(versionFlow({ preparing: false, draftState: "draft", lastRound: null, carryOverCount: 0 })).toBeNull()
  })

  it("po zverejnení s publikami z predošlého znenia je krok 4", () => {
    const f = versionFlow({ preparing: false, draftState: "draft", lastRound: null, carryOverCount: 2 })
    expect(f?.step).toBe(4)
    expect(f?.states).toEqual(["done", "done", "done", "current"])
  })

  it("koncept bez kola je krok 1", () => {
    const f = versionFlow({ preparing: true, draftState: "draft", lastRound: null, carryOverCount: 0 })
    expect(f?.step).toBe(1)
    expect(f?.states).toEqual(["current", "todo", "todo", "todo"])
    expect(f?.rejected).toBeNull()
  })

  it("po zamietnutí je krok 1 a krok 2 je zamietnutý", () => {
    const r = round({ outcome: "rejected", closedAt: new Date() })
    const f = versionFlow({ preparing: true, draftState: "draft", lastRound: r, carryOverCount: 0 })
    expect(f?.step).toBe(1)
    expect(f?.states[1]).toBe("rejected")
    expect(f?.rejected).toBe(r)
  })

  it("bežiace kolo je krok 2, schválené krok 3", () => {
    expect(versionFlow({ preparing: true, draftState: "in-review", lastRound: null, carryOverCount: 0 })?.step).toBe(2)
    const f = versionFlow({ preparing: true, draftState: "approved", lastRound: null, carryOverCount: 5 })
    expect(f?.step).toBe(3)
    expect(f?.states).toEqual(["done", "done", "current", "todo"])
  })
})

describe("lastPreparationRound", () => {
  it("berie najnovšie kolo po poslednom zverejnení, aj na inej identite", () => {
    const old = round({ versionId: "v0", submittedAt: new Date("2026-09-01T00:00:00Z") })
    const a = round({ versionId: "v1", submittedAt: new Date("2026-09-20T00:00:00Z") })
    const b = round({ versionId: "v2", submittedAt: new Date("2026-09-22T00:00:00Z") })
    const all = new Map([["v0", [old]], ["v1", [a]], ["v2", [b]]]).values()
    expect(lastPreparationRound(all, new Date("2026-09-07T00:00:00Z"))).toBe(b)
  })

  it("kolá pred zverejnením sa nerátajú", () => {
    const old = round({ submittedAt: new Date("2026-09-01T00:00:00Z") })
    expect(lastPreparationRound([[old]], new Date("2026-09-07T00:00:00Z"))).toBeNull()
  })
})

describe("previousApproverIds", () => {
  it("vracia osoby z posledného kola, ktoré sa dajú ponúknuť", () => {
    const r1 = round({ submittedAt: new Date("2026-01-01T00:00:00Z"), approvers: [
      { email: "old@sfz.sk", fullName: "Old", decidedAt: null, decision: null },
    ] })
    const r2 = round({ round: 2 })
    const people = [{ id: "p-marek", email: "Marek@sfz.sk" }, { id: "p-old", email: "old@sfz.sk" }]
    // Peter medzi ponúkanými nie je (vyradený) — vypadne.
    expect(previousApproverIds([[r1, r2]], people)).toEqual(["p-marek"])
  })

  it("bez kôl nič", () => {
    expect(previousApproverIds([], [{ id: "a", email: "a@sfz.sk" }])).toEqual([])
  })
})

describe("rejectedBy", () => {
  it("rozlíši zamietnutie od stiahnutia", () => {
    const rejected = round({ outcome: "rejected", approvers: [
      { email: "peter@sfz.sk", fullName: "Peter", decidedAt: new Date(), decision: "rejected", reason: "Článok 4" },
    ] })
    expect(rejectedBy(rejected)?.fullName).toBe("Peter")
    expect(rejectedBy(round({ outcome: "rejected" }))).toBeNull()
  })
})
