/**
 * channelsAccess.test.ts — kto co vidi v sekcii Kanaly (ADR-028, D170).
 *
 * Spravca organizacie: vsetky kanaly a nastavenie, obsah ticketov nie.
 * Riesitel: svoje kanaly a ich tickety. Nikto iny: nic. Stare /helpdesk
 * presmeruje legacyRoutes (test v legacyRoutes.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
  person: null as null | { id: string; companyCode: string; roles: string[]; language: string },
}))
const channels = [
  { key: "issf", name: "ISSF Helpdesk", kind: "widget", tickets: true, assigneeIds: ["agent"] },
  { key: "projekt", name: "Iný projekt", kind: "widget", tickets: true, assigneeIds: ["iny"] },
]

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("404") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/lib/session", () => ({
  currentTenant: async () => ({ companyCode: "SFZ" }),
  currentPerson: async () => state.person,
}))
vi.mock("@/lib/channels", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/channels")>()),
  listChannels: async () => channels,
  channelsForAgent: async (_c: string, personId: string) => channels.filter(c => c.assigneeIds.includes(personId)),
}))
vi.mock("@/lib/tickets", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/tickets")>()),
  listTickets: async () => [],
}))

const { channelsContext } = await import("../src/lib/helpdeskAgents")

const admin = { id: "admin", companyCode: "SFZ", roles: ["people-admin"], language: "sk" }
const agent = { id: "agent", companyCode: "SFZ", roles: ["helpdesk"], language: "sk" }
const both = { id: "agent", companyCode: "SFZ", roles: ["people-admin", "helpdesk"], language: "sk" }
const nobody = { id: "x", companyCode: "SFZ", roles: [], language: "sk" }

async function dispatch(key: string) {
  const { default: Page } = await import("../src/app/channels/[key]/page")
  return Page({ params: Promise.resolve({ key }) })
}
async function channelTickets(key: string) {
  const { default: Page } = await import("../src/app/channels/[key]/tickets/page")
  return Page({ params: Promise.resolve({ key }), searchParams: Promise.resolve({}) })
}

beforeEach(() => { state.person = null })

describe("channelsContext", () => {
  it("spravca vidi vsetky kanaly, ale nie je riesitel ziadneho", async () => {
    state.person = admin
    const ctx = await channelsContext()
    expect(ctx.state).toBe("ready")
    if (ctx.state !== "ready") return
    expect(ctx.isAdmin).toBe(true)
    expect(ctx.visible.map(c => c.key)).toEqual(["issf", "projekt"])
    expect(ctx.agentChannels).toEqual([])
  })
  it("riesitel vidi len svoje kanaly", async () => {
    state.person = agent
    const ctx = await channelsContext()
    if (ctx.state !== "ready") throw new Error(ctx.state)
    expect(ctx.isAdmin).toBe(false)
    expect(ctx.visible.map(c => c.key)).toEqual(["issf"])
  })
  it("bez roly spravcu aj riesitela sekcia nie je", async () => {
    state.person = nobody
    expect((await channelsContext()).state).toBe("forbidden")
    state.person = { ...agent, id: "bez-kanala" }
    expect((await channelsContext()).state).toBe("forbidden")
  })
})

describe("stranky kanala", () => {
  it("spravca bez riesitelstva tickety kanala nevidi — 404, nie prazdny zoznam", async () => {
    state.person = admin
    await expect(channelTickets("issf")).rejects.toThrow("404")
  })
  it("riesitel cudzieho kanala tiez nie", async () => {
    state.person = agent
    await expect(channelTickets("projekt")).rejects.toThrow("404")
  })
  it("rozcestnik: riesitela na tickety, spravcu na nastavenie, ostatnych 404", async () => {
    state.person = both
    await expect(dispatch("issf")).rejects.toThrow("redirect /channels/issf/tickets")
    await expect(dispatch("projekt")).rejects.toThrow("redirect /channels/projekt/settings")
    state.person = admin
    await expect(dispatch("issf")).rejects.toThrow("redirect /channels/issf/settings")
    state.person = agent
    await expect(dispatch("projekt")).rejects.toThrow("404")
  })
})
