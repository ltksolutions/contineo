import { describe, expect, it } from "vitest"
import { cancelInfo, roundEvents, sortTimeline, timelineWorthShowing } from "@/lib/documentTimeline"

const base = {
  round: 1,
  submittedBy: "jan@x.sk",
  submittedAt: new Date("2026-10-08T08:00:00Z"),
  note: undefined as string | undefined,
  closedAt: null as Date | null,
  outcome: null as "approved" | "rejected" | "cancelled" | null,
}
const approver = (decision: "approved" | "rejected" | null, at?: string, reason?: string) => ({
  email: "a@x.sk", fullName: "Agáta Galková", decision, decidedAt: at ? new Date(at) : null, reason, notifiedAt: null,
})

describe("cancelInfo", () => {
  it("vytiahne autora a dôvod z poznámky kola", () => {
    expect(cancelInfo("Mení sa príloha\n\nKolo zrušil predkladateľ (jan@x.sk): Chýbala príloha"))
      .toEqual({ by: "jan@x.sk", reason: "Chýbala príloha" })
  })
  it("bez značky nič", () => {
    expect(cancelInfo("Mení sa príloha")).toEqual({})
    expect(cancelInfo(undefined)).toEqual({})
  })
})

describe("roundEvents", () => {
  it("bežiace kolo bez rozhodnutí je len predloženie", () => {
    const ev = roundEvents({ ...base, approvers: [approver(null)] } as never)
    expect(ev.map(e => e.kind)).toEqual(["submitted"])
    expect(timelineWorthShowing(ev)).toBe(false)
  })
  it("zamietnutie nesie dôvod", () => {
    const ev = roundEvents({ ...base, outcome: "rejected", closedAt: new Date("2026-10-10T08:00:00Z"),
      approvers: [approver("rejected", "2026-10-10T08:00:00Z", "Staré sadzby")] } as never)
    expect(ev.map(e => e.kind)).toEqual(["submitted", "rejected"])
    expect(ev[1].reason).toBe("Staré sadzby")
    expect(timelineWorthShowing(ev)).toBe(true)
  })
  it("stiahnuté kolo — aj staršie „rejected“ bez zamietnutia", () => {
    const ev = roundEvents({ ...base, outcome: "rejected", closedAt: new Date("2026-10-09T08:00:00Z"),
      note: "Kolo zrušil predkladateľ (jan@x.sk): Oprava", approvers: [approver(null)] } as never)
    expect(ev.map(e => e.kind)).toEqual(["submitted", "cancelled"])
    expect(ev[1]).toMatchObject({ who: "jan@x.sk", reason: "Oprava" })
  })
})

describe("sortTimeline", () => {
  it("najnovšie hore, pri rovnakom čase rozhodnutie nad predložením", () => {
    const at = new Date("2026-10-10T08:00:00Z")
    const sorted = sortTimeline([
      { kind: "submitted", at, who: "a" },
      { kind: "approved", at, who: "b" },
      { kind: "published", at: new Date("2026-10-11T08:00:00Z"), who: "c" },
    ])
    expect(sorted.map(e => e.kind)).toEqual(["published", "approved", "submitted"])
  })
})
