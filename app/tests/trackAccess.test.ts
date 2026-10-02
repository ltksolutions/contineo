/**
 * trackAccess.test.ts — kto smie spravovať trasy (Ján 2. 10. 2026).
 *
 * Trasy prešli z knižnice do Pridelených dokumentov (`/hr/tracks`). Smie ich
 * personalista **aj** správca obsahu — kto ich dovtedy skladal, o ne neprišiel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({ roles: [] as string[], companyCode: "SFZ" }))

vi.mock("../src/lib/session", () => ({
  currentTenant: async () => ({ companyCode: "SFZ" }),
  currentPerson: async () => ({ id: "p1", email: "a@sfz.sk", companyCode: state.companyCode, roles: state.roles }),
}))

import { trackManagerContext, hrContext } from "../src/lib/hr"

beforeEach(() => { state.roles = []; state.companyCode = "SFZ" })

describe("správa trás", () => {
  it("personalista smie", async () => {
    state.roles = ["hr"]
    expect((await trackManagerContext()).state).toBe("ready")
  })

  it("správca obsahu smie aj bez roly personalistu — do Pridelených dokumentov však nie", async () => {
    state.roles = ["content-admin"]
    expect((await trackManagerContext()).state).toBe("ready")
    expect((await hrContext()).state).toBe("forbidden")
  })

  it("bez roly nie", async () => {
    state.roles = ["evaluator"]
    expect((await trackManagerContext()).state).toBe("forbidden")
  })

  it("rola v cudzej organizácii nestačí (D32)", async () => {
    state.roles = ["hr", "content-admin"]
    state.companyCode = "INA"
    expect((await trackManagerContext()).state).toBe("forbidden")
  })
})
