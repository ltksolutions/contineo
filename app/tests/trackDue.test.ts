/**
 * trackDue.test.ts — termín trasy a prah meškania organizácie (3. 10. 2026).
 *
 * Trasa dovtedy termín niesť nevedela (D62) a 14 dní meškania bolo natvrdo
 * v kóde. Test stráži dátum pridania na trasu, termín od neho a prah
 * z nastavenia organizácie.
 */
import { describe, it, expect } from "vitest"
import { newTrackHistory, inTrackSince, trackStart, planChanges } from "../src/lib/persons"
import { trackDueFor } from "../src/lib/tracks"
import { overdueDaysFor, DEFAULT_DAYS } from "../src/lib/reminders"

const d = (s: string) => new Date(s)

describe("história trás", () => {
  it("pridanie otvorí úsek, odobratie ho uzavrie, nezmenené sa nehýbe", () => {
    const h1 = newTrackHistory(undefined, ["a"], d("2026-10-01"))
    expect(h1).toEqual([{ track: "a", from: d("2026-10-01") }])
    const h2 = newTrackHistory(h1, ["a", "b"], d("2026-10-05"))
    expect(inTrackSince({ trackHistory: h2 }, "a")).toEqual(d("2026-10-01"))
    expect(inTrackSince({ trackHistory: h2 }, "b")).toEqual(d("2026-10-05"))
    const h3 = newTrackHistory(h2, ["b"], d("2026-10-07"))
    expect(inTrackSince({ trackHistory: h3 }, "a")).toBeNull()
    expect(h3.find(z => z.track === "a")?.to).toEqual(d("2026-10-07"))
  })

  it("bez histórie padá začiatok na prvé prihlásenie", () => {
    expect(trackStart({ firstLoginAt: d("2026-09-01") }, "a")).toEqual(d("2026-09-01"))
    expect(trackStart({ trackHistory: [{ track: "a", from: d("2026-10-02") }], firstLoginAt: d("2026-09-01") }, "a"))
      .toEqual(d("2026-10-02"))
  })

  it("import zapíše históriu, ale v náhľade zmien ju neukáže", () => {
    const { set, changes } = planChanges(null, { email: "x@sfz.sk", fullName: "X", companyCode: "SFZ", tracks: ["a"] } as never, "overwrite" as never, d("2026-10-03"))
    expect(set.trackHistory).toEqual([{ track: "a", from: d("2026-10-03") }])
    expect(changes.map(c => c.field)).not.toContain("trackHistory")
  })
})

describe("termín trasy", () => {
  const person = { trackHistory: [{ track: "a", from: d("2026-10-02T00:00:00") }] }

  it("počíta sa od pridania na trasu", () => {
    expect(trackDueFor({ key: "a", due: { kind: "days", days: 14 } }, person)).toEqual(d("2026-10-16T00:00:00"))
  })

  it("trasa bez termínu termín nedáva", () => {
    expect(trackDueFor({ key: "a", due: null }, person)).toBeNull()
    expect(trackDueFor({ key: "a" }, person)).toBeNull()
  })
})

describe("prah meškania organizácie", () => {
  it("z nastavenia, inak 14", () => {
    expect(overdueDaysFor({ acknowledgement: { overdueDays: 30 } })).toBe(30)
    expect(overdueDaysFor({})).toBe(DEFAULT_DAYS)
    expect(overdueDaysFor(null)).toBe(14)
    expect(overdueDaysFor({ acknowledgement: { overdueDays: 0 } })).toBe(14)
  })
})
