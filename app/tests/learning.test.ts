/**
 * learning.test.ts — brány modulu Vzdelávanie (ADR-018, D122, D123): vypnutý
 * modul neexistuje, správa len pre `learning-admin`, cudzia organizácia nie.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const s = vi.hoisted(() => ({ tenant: null as unknown, person: null as unknown }))
vi.mock("../src/lib/session", () => ({
  currentTenant: async () => s.tenant,
  currentPerson: async () => s.person,
}))

import { learningContext, learningAdminContext, learningEnabled, isLearningAdmin, LEARNING_ROLE } from "../src/lib/learning"

const tenant = (learning?: boolean) => ({ companyCode: "SFZ", ...(learning === undefined ? {} : { modules: { learning } }) })
const person = (roles: string[] = [], companyCode = "SFZ") => ({ id: "p", email: "a@sfz.sk", companyCode, roles, language: "sk" })

beforeEach(() => {
  s.tenant = tenant(true)
  s.person = person()
})

describe("learningEnabled", () => {
  it("chýbajúci záznam je vypnuté", () => {
    expect(learningEnabled(tenant() as never)).toBe(false)
    expect(learningEnabled(tenant(false) as never)).toBe(false)
    expect(learningEnabled(tenant(true) as never)).toBe(true)
    expect(learningEnabled(null)).toBe(false)
  })
  it("rola", () => {
    expect(LEARNING_ROLE).toBe("learning-admin")
    expect(isLearningAdmin({ roles: ["learning-admin"] })).toBe(true)
    expect(isLearningAdmin({ roles: ["content-admin"] })).toBe(false)
  })
})

describe("learningContext", () => {
  it("vypnutý modul je disabled aj pre lektora", async () => {
    s.tenant = tenant()
    s.person = person([LEARNING_ROLE])
    expect((await learningContext()).state).toBe("disabled")
    expect((await learningAdminContext()).state).toBe("disabled")
  })

  it("bežná osoba vidí kurzy, správu nie", async () => {
    const ctx = await learningContext()
    expect(ctx.state).toBe("ready")
    expect(ctx.state === "ready" && ctx.isAdmin).toBe(false)
    expect((await learningAdminContext()).state).toBe("forbidden")
  })

  it("lektor vidí aj správu", async () => {
    s.person = person([LEARNING_ROLE])
    const ctx = await learningAdminContext()
    expect(ctx.state).toBe("ready")
    expect(ctx.state === "ready" && ctx.isAdmin).toBe(true)
  })

  it("osoba inej organizácie nie", async () => {
    s.person = person([LEARNING_ROLE], "LTK")
    expect((await learningContext()).state).toBe("forbidden")
  })

  it("neprihlásený a neznámy hostiteľ", async () => {
    s.person = null
    expect((await learningContext()).state).toBe("not-signed-in")
    s.tenant = null
    expect((await learningContext()).state).toBe("unknown-host")
  })
})
