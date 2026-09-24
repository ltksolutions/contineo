/**
 * personDates.test.ts — dátumy pri osobe, od ktorých plynie lehota dokladov
 * (ADR-012, D100): vyradenie, skončenie vzťahu, vrátenie.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const col = vi.hoisted(() => ({
  findOne: vi.fn(),
  updateOne: vi.fn(async () => ({ matchedCount: 1 })),
}))
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => {}) }))
vi.mock("../src/lib/session", () => ({ currentTenant: vi.fn(), currentPerson: vi.fn() }))
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => col) }))
vi.mock("../src/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: audit.writeAudit,
}))

import { setPersonStatus, setPersonEndedAt } from "../src/lib/people"

const NOW = new Date("2026-09-24T10:00:00Z")
const update = () => (col.updateOne.mock.calls[0] as unknown as [unknown, Record<string, Record<string, unknown>>])[1]

beforeEach(() => {
  vi.clearAllMocks()
  col.findOne.mockResolvedValue({ id: "p1", companyCode: "SFZ", fullName: "Ján Test", status: "active" })
})

describe("setPersonStatus — dátumy pre lehotu (D100)", () => {
  it("vyradenie zapíše dátum vyradenia a skončenie vzťahu", async () => {
    const ended = new Date("2026-08-31T00:00:00Z")
    await setPersonStatus("SFZ", "p1", "inactive", "hr@sfz.sk", ended, NOW)
    expect(update().$set).toMatchObject({ status: "inactive", deactivatedAt: NOW, endedAt: ended })
    expect((col.updateOne.mock.calls[0] as unknown[])[0]).toEqual({ companyCode: "SFZ", id: "p1" })
  })

  it("vyradenie bez dátumu skončenia — endedAt zostane prázdny, lehota pôjde od vyradenia", async () => {
    await setPersonStatus("SFZ", "p1", "inactive", "hr@sfz.sk", null, NOW)
    expect(update().$set).toMatchObject({ deactivatedAt: NOW, endedAt: null })
  })

  it("opakované vyradenie dátum vyradenia neposúva", async () => {
    const earlier = new Date("2025-01-10T00:00:00Z")
    col.findOne.mockResolvedValue({ id: "p1", fullName: "X", status: "inactive", deactivatedAt: earlier })
    await setPersonStatus("SFZ", "p1", "inactive", "hr@sfz.sk", null, NOW)
    expect(update().$set.deactivatedAt).toBe(earlier)
  })

  it("vrátenie oba dátumy zmaže — osoba je znova vo zväze", async () => {
    col.findOne.mockResolvedValue({ id: "p1", fullName: "X", status: "inactive", deactivatedAt: NOW, endedAt: NOW })
    await setPersonStatus("SFZ", "p1", "invited", "hr@sfz.sk", null, NOW)
    expect(update().$unset).toEqual({ deactivatedAt: "", endedAt: "" })
  })

  it("skončenie v budúcnosti sa odmietne", async () => {
    await expect(setPersonStatus("SFZ", "p1", "inactive", "hr@sfz.sk", new Date("2027-01-01T00:00:00Z"), NOW))
      .rejects.toMatchObject({ code: "person.endedInFuture" })
    expect(col.updateOne).not.toHaveBeenCalled()
  })

  it("nečitateľný dátum sa odmietne, nezahodí", async () => {
    await expect(setPersonStatus("SFZ", "p1", "inactive", "hr@sfz.sk", new Date(NaN), NOW))
      .rejects.toMatchObject({ code: "person.badEndedAt" })
  })
})

describe("setPersonEndedAt — doplnenie pri vyradenej osobe", () => {
  it("vyradenej osobe sa dátum zapíše a zaaudituje", async () => {
    col.findOne.mockResolvedValue({ id: "p1", fullName: "X", status: "inactive", endedAt: null })
    const ended = new Date("2026-06-30T00:00:00Z")
    await setPersonEndedAt("SFZ", "p1", ended, "hr@sfz.sk", NOW)
    expect(update().$set.endedAt).toBe(ended)
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      changes: { endedAt: { from: null, to: "2026-06-30" } },
    }))
  })

  it("aktívnej osobe nie — skončenie bez vyradenia nedáva zmysel", async () => {
    await expect(setPersonEndedAt("SFZ", "p1", NOW, "hr@sfz.sk", NOW))
      .rejects.toMatchObject({ code: "person.endedNotInactive" })
  })
})
