/**
 * trackMembers.test.ts — pridanie a odobratie ľudí zo stránky trasy (2. 10. 2026).
 *
 * Trasa sa osobe zapisuje do `persons.tracks`. Oddelenie pridá dnešných
 * členov vrátane podriadených; vyradení sa nepridávajú; organizácia je
 * v podmienke dotazu (D32).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
  track: { companyCode: "SFZ", key: "t1", title: "Nový zamestnanec", steps: [], isActive: true } as Record<string, unknown> | null,
  people: [] as Record<string, unknown>[],
  personQuery: null as Record<string, unknown> | null,
  updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
  updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
  audit: vi.fn(async () => {}),
}))

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (name: string) => name === "onboarding_tracks"
    ? { findOne: async () => state.track }
    : {
        find: (q: Record<string, unknown>) => { state.personQuery = q; return { toArray: async () => state.people } },
        findOne: async () => state.people[0] ?? null,
        updateMany: state.updateMany,
        updateOne: state.updateOne,
      }),
  getDb: vi.fn(), getClient: vi.fn(),
}))
vi.mock("../src/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: state.audit,
}))

import { addTrackMembers, removeTrackMember } from "../src/lib/tracks"

beforeEach(() => {
  state.people = []
  state.personQuery = null
  vi.clearAllMocks()
})

describe("pridať ľudí na trasu", () => {
  it("osoby aj oddelenie v jednom dotaze, v organizácii, bez vyradených", async () => {
    state.people = [
      { id: "p1", fullName: "Eva Nová", tracks: [] },
      { id: "p2", fullName: "Ján Starý", tracks: ["t1"] },
    ]
    const r = await addTrackMembers("SFZ", "t1", { personIds: ["p1"], departmentIds: ["it"] }, "hr@sfz.sk")

    expect(r).toEqual({ added: 1, already: 1, addedIds: ["p1"] })
    expect(state.personQuery).toMatchObject({
      companyCode: "SFZ", status: { $ne: "inactive" },
      $or: [{ id: { $in: ["p1"] } }, { departmentPath: { $in: ["it"] } }],
    })
    expect(state.updateMany).toHaveBeenCalledWith(
      { companyCode: "SFZ", id: { $in: ["p1"] } },
      {
        $addToSet: { tracks: "t1" },
        // Dátum pridania nesie termín trasy (3. 10. 2026).
        $push: { trackHistory: { track: "t1", from: expect.any(Date) } },
      },
    )
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "membersAdded", note: "Eva Nová" }))
  })

  it("keď všetci už na trase sú, nič sa nezapíše", async () => {
    state.people = [{ id: "p2", fullName: "Ján Starý", tracks: ["t1"] }]
    expect(await addTrackMembers("SFZ", "t1", { personIds: ["p2"] }, "hr@sfz.sk")).toEqual({ added: 0, already: 1, addedIds: [] })
    expect(state.updateMany).not.toHaveBeenCalled()
    expect(state.audit).not.toHaveBeenCalled()
  })

  it("bez výberu je to chyba s vlastným kódom", async () => {
    await expect(addTrackMembers("SFZ", "t1", {}, "hr@sfz.sk")).rejects.toMatchObject({ code: "track.noMembersChosen" })
  })

  it("neexistujúca trasa sa nedá doplniť", async () => {
    state.track = null
    await expect(addTrackMembers("SFZ", "x", { personIds: ["p1"] }, "hr@sfz.sk")).rejects.toMatchObject({ code: "track.notFound" })
    state.track = { companyCode: "SFZ", key: "t1", title: "Nový zamestnanec", steps: [], isActive: true }
  })
})

describe("odobrať z trasy", () => {
  it("odoberie trasu osobe a zapíše to do auditu", async () => {
    state.people = [{ id: "p1", fullName: "Eva Nová" }]
    expect(await removeTrackMember("SFZ", "t1", "p1", "hr@sfz.sk")).toBe(true)
    expect(state.updateOne).toHaveBeenCalledWith(
      { companyCode: "SFZ", id: "p1", tracks: "t1" },
      { $pull: { tracks: "t1" }, $set: { "trackHistory.$[open].to": expect.any(Date) } },
      { arrayFilters: [{ "open.track": "t1", "open.to": { $exists: false } }] },
    )
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "memberRemoved", note: "Eva Nová" }))
  })
})
