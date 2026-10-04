import { describe, expect, it } from "vitest"
import { byNewest, evidenceDate } from "@/lib/evidenceDb"

type Row = Parameters<typeof byNewest>[0]
const d = (s: string) => new Date(s)
function row(name: string, o: { since?: string; opened?: string; ack?: string; revoked?: string }): Row & { name: string } {
  return {
    name,
    duty: { since: o.since ? d(o.since) : null, acknowledgedAt: o.ack ? d(o.ack) : null } as Row["duty"],
    firstOpenedAt: o.opened ? d(o.opened) : null,
    revocation: o.revoked ? ({ revokedAt: d(o.revoked) } as Row["revocation"]) : null,
  }
}

describe("Reťaz dôkazov — najnovšie navrchu", () => {
  it("dátum riadku: odvolanie, potom potvrdenie, potom otvorenie", () => {
    expect(evidenceDate(row("a", { opened: "2026-10-01", ack: "2026-10-02", revoked: "2026-10-03" }))).toEqual(d("2026-10-03"))
    expect(evidenceDate(row("a", { opened: "2026-10-01", ack: "2026-10-02" }))).toEqual(d("2026-10-02"))
    expect(evidenceDate(row("a", { opened: "2026-10-01" }))).toEqual(d("2026-10-01"))
    expect(evidenceDate(row("a", {}))).toBeNull()
  })

  it("zoradí podľa dátumu zostupne, neotvorené na koniec podľa pridelenia", () => {
    const rows = [
      row("neotvorené staršie", { since: "2026-09-01" }),
      row("potvrdené 30. 9.", { ack: "2026-09-30" }),
      row("neotvorené novšie", { since: "2026-09-20" }),
      row("potvrdené 2. 10.", { ack: "2026-10-02" }),
      row("otvorené 1. 10.", { opened: "2026-10-01" }),
    ]
    expect(rows.sort(byNewest).map(r => r.name)).toEqual([
      "potvrdené 2. 10.", "otvorené 1. 10.", "potvrdené 30. 9.", "neotvorené novšie", "neotvorené staršie",
    ])
  })
})
