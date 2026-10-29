/**
 * ticketView.test.ts — pohľady zoznamu ticketov (Ján 29. 10. 2026):
 * Otvorené · Vybavené · Všetky; staré `?view=sent` a `?view=closed` vedú
 * do Vybavených, neznáme do Otvorených.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("@/app/channels/tickets/actions", () => ({ bulkTicketsAction: async () => {} }))

const { ticketView, TICKET_VIEWS } = await import("../src/components/TicketList")

describe("pohľad zoznamu ticketov", () => {
  it("tri pohľady", () => {
    expect(TICKET_VIEWS).toEqual(["open", "done", "all"])
  })
  it("staré adresy sa prekladajú", () => {
    expect(ticketView("sent")).toBe("done")
    expect(ticketView("closed")).toBe("done")
  })
  it("platné ostanú, neznáme sú Otvorené", () => {
    expect(ticketView("done")).toBe("done")
    expect(ticketView("all")).toBe("all")
    expect(ticketView(undefined)).toBe("open")
    expect(ticketView("xyz")).toBe("open")
  })
})
