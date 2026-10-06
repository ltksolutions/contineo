/**
 * publicPageTitle.test.ts — verejné stránky (ochrana údajov, prihlásenie,
 * overenie) majú v karte názov stránky, nie len organizáciu (6. 10. 2026).
 */
import { describe, it, expect, vi } from "vitest"

const s = vi.hoisted(() => ({ tenant: null as unknown }))
vi.mock("@/lib/session", () => ({ currentTenant: async () => s.tenant }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({ displayName: "Intranet SFZ" }) }))

import { publicPageTitle } from "../src/lib/publicPageTitle"

describe("publicPageTitle", () => {
  it("s organizáciou: „stránka · organizácia\"", async () => {
    s.tenant = { companyCode: "SFZ" }
    expect(await publicPageTitle("/privacy")).toEqual({ title: "Ochrana osobných údajov · Intranet SFZ" })
    expect(await publicPageTitle("/sign-in")).toEqual({ title: "Prihlásenie · Intranet SFZ" })
  })
  it("bez organizácie nič neprepisuje", async () => {
    s.tenant = null
    expect(await publicPageTitle("/privacy")).toEqual({})
  })
})
