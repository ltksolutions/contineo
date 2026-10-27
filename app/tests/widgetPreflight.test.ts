/**
 * widgetPreflight.test.ts — preflight `OPTIONS` widgetu (skúška v ISSF 26. 10. 2026).
 *
 * Kanál bez tajného kľúča musí na preflight odpovedať 204 s CORS hlavičkami,
 * inak prehliadač ohlási „Failed to fetch" namiesto `widget.noSecret`.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))
vi.mock("../src/lib/session", () => ({ currentTenant: vi.fn(async () => ({ companyCode: "SFZ" })), requestHostname: vi.fn() }))
const channelByKey = vi.fn()
vi.mock("../src/lib/channels", () => ({ channelByKey: (...a: unknown[]) => channelByKey(...a), widgetSecret: () => null }))

import { widgetPreflight } from "../src/lib/widgetApi"

const req = (origin?: string) => new Request("https://intranet.futbalsfz.sk/api/widget/k/chat", { method: "OPTIONS", headers: origin ? { origin } : {} })

describe("widgetPreflight", () => {
  it("povolený pôvod bez tajného kľúča: 204 s CORS pre ten pôvod", async () => {
    channelByKey.mockResolvedValueOnce({ kind: "widget", widget: { origins: ["https://issf.futbalsfz.sk"] } })
    const r = await widgetPreflight(req("https://issf.futbalsfz.sk"), "k")
    expect(r.status).toBe(204)
    expect(r.headers.get("access-control-allow-origin")).toBe("https://issf.futbalsfz.sk")
    expect(r.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS")
  })
  it("cudzí alebo chýbajúci pôvod: 403 bez CORS", async () => {
    channelByKey.mockResolvedValue({ kind: "widget", widget: { origins: ["https://issf.futbalsfz.sk"] } })
    for (const o of ["https://zly.sk", undefined]) {
      const r = await widgetPreflight(req(o), "k")
      expect(r.status).toBe(403)
      expect(r.headers.get("access-control-allow-origin")).toBeNull()
    }
  })
  it("vlastný pôvod aplikácie (náhľad widgetu, D284) prejde, aj keď nie je medzi povolenými", async () => {
    channelByKey.mockResolvedValueOnce({ kind: "widget", widget: { origins: ["https://issf.futbalsfz.sk"] } })
    const own = new Request("https://intranet.futbalsfz.sk/api/widget/k/chat", { method: "OPTIONS", headers: { origin: "https://intranet.futbalsfz.sk", "x-forwarded-host": "intranet.futbalsfz.sk" } })
    const r = await widgetPreflight(own, "k")
    expect(r.status).toBe(204)
    expect(r.headers.get("access-control-allow-origin")).toBe("https://intranet.futbalsfz.sk")
  })
  it("neznámy kanál alebo portál: 404", async () => {
    channelByKey.mockResolvedValueOnce(null)
    expect((await widgetPreflight(req("https://issf.futbalsfz.sk"), "k")).status).toBe(404)
    channelByKey.mockResolvedValueOnce({ kind: "portal", widget: { origins: ["https://issf.futbalsfz.sk"] } })
    expect((await widgetPreflight(req("https://issf.futbalsfz.sk"), "k")).status).toBe(404)
  })
})
