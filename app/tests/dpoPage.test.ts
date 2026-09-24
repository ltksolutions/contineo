/**
 * dpoPage.test.ts — /dpo vykreslené bez databázy (rám DPO-ochrana-udajov):
 * dlaždice zo `summarize()`, skupiny, čakajúca námietka s voľbami ako
 * dlaždicami a zbalené zaevidovanie, ktoré sa po chybe otvorí.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({ rows: [] as unknown[], objections: [] as unknown[] }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/dpo", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/dpo")>()),
  dpoContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", name: "SFZ" },
    person: { id: "p-jan", email: "jan@sfz.sk", companyCode: "SFZ", language: "sk" },
  }),
}))
vi.mock("@/lib/dpoDb", () => ({ legalBasisRows: async () => state.rows }))
vi.mock("@/lib/objectionsDb", () => ({ listObjections: async () => state.objections }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/session", () => ({}))
vi.mock("../src/app/dpo/actions", () => ({ recordObjectionAction: async () => {}, decideObjectionAction: async () => {} }))

const row = (over: Record<string, unknown>) => ({
  documentId: "sfz:a", title: "Predpis A", versionId: "v1", versionLabel: "1.0",
  effectiveFrom: new Date("2026-09-07T00:00:00Z"), legalBasis: null, basisLabel: null, reference: null,
  responsible: { fullName: "Ján Letko", email: "jan@sfz.sk" }, problems: ["noBasis"], ...over,
})

async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/dpo/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  state.rows = [
    row({}),
    row({ documentId: "sfz:b", title: "Predpis B", legalBasis: "legal_obligation", reference: "§ 47 ZP", problems: [] }),
  ]
  state.objections = [{
    id: "o1", companyCode: "SFZ", personId: "p-x", personName: "Martin Novák",
    receivedAt: new Date("2026-09-22T00:00:00Z"), channel: "email", text: "Nesúhlasím.",
    recordedBy: "Ján Letko", recordedAt: new Date("2026-09-22T00:00:00Z"), status: "pending",
  }]
})

describe("/dpo", () => {
  it("dlaždice, skupiny a zodpovedná osoba ako odkaz", async () => {
    const html = await render()
    expect(html).toContain("Platné predpisy")
    expect(html).toContain("S nedostatkom · 1")
    expect(html).toContain("V poriadku · 1")
    expect(html).toContain('href="mailto:jan@sfz.sk"')
    expect(html).toContain("Zodpovedná osoba")
  })

  it("čakajúca námietka: počet pri nadpise, voľby ako dlaždice, zaevidovanie zbalené", async () => {
    const html = await render()
    expect(html).toContain("1 čaká na rozhodnutie")
    expect(html).toContain("dpo-choice--danger")
    expect(html).toMatch(/<details class="dpo-record">/)
  })

  it("po chybe je zaevidovanie otvorené", async () => {
    expect(await render({ error: "1", msg: "chyba" })).toMatch(/<details class="dpo-record" open="">/)
  })
})
