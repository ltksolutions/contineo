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
    tenant: { companyCode: "SFZ", name: "SFZ", languages: ["sk", "cs"], privacy: { retention: { evidenceYears: 2 }, extra: { sk: "Kamerový systém v sídle." } } },
    person: { id: "p-jan", email: "jan@sfz.sk", companyCode: "SFZ", language: "sk" },
  }),
}))
vi.mock("@/lib/dpoDb", () => ({ legalBasisRows: async () => state.rows }))
vi.mock("@/lib/objectionsDb", () => ({ listObjections: async () => state.objections }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/session", () => ({}))
vi.mock("../src/app/dpo/actions", () => ({ recordObjectionAction: async () => {}, decideObjectionAction: async () => {}, saveRetentionAction: async () => {}, saveExtraAction: async () => {} }))

const row = (over: Record<string, unknown>) => ({
  documentId: "sfz:a", title: "Predpis A", versionId: "v1", versionLabel: "1.0",
  effectiveFrom: new Date("2026-09-07T00:00:00Z"), legalBasis: null, categories: [], basisLabel: null, reference: null,
  responsible: { fullName: "Ján Letko", email: "jan@sfz.sk" }, problems: ["noBasis"], ...over,
})

async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/dpo/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  state.rows = [
    row({}),
    row({ documentId: "sfz:b", title: "Predpis B", legalBasis: "legal_obligation", categories: ["legal_obligation", "legitimate_interest"], reference: "§ 47 ZP", problems: [] }),
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
    // Predpis s oboma druhmi sa ráta v oboch dlaždiciach (ADR-017).
    expect(html.match(/dpo-tile-v">1</g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("čakajúca námietka: počet pri nadpise, voľby ako dlaždice, zaevidovanie zbalené", async () => {
    const html = await render()
    expect(html).toContain("1 čaká na rozhodnutie")
    // Piata dlaždica (D153): čakajúce námietky, varovná farba, odkaz na zoznam.
    expect(html).toContain('<a href="#objections" class="card dpo-tile dpo-tile--link"><span class="dpo-tile-l">Námietky na rozhodnutie</span><span class="dpo-tile-v is-warn">1</span>')
    expect(html).toContain("dpo-choice--danger")
    expect(html).toMatch(/<details class="dpo-record">/)
  })

  it("po chybe je zaevidovanie otvorené", async () => {
    expect(await render({ error: "1", msg: "chyba" })).toMatch(/<details class="dpo-record" open="">/)
  })

  it("lehoty uchovávania organizácie s predvolenými a uloženými hodnotami (ADR-022, D136)", async () => {
    const html = await render()
    expect(html).toContain('id="retention"')
    expect(html).toMatch(/name="evidenceYears"[^>]*value="2"/)
    expect(html).toMatch(/name="capYears"[^>]*value="5"/)
    expect(html).toMatch(/name="learningDetailMonths"[^>]*value="12"/)
    expect(html).toContain("Certifikáty sa nemažú.")
  })

  it("doplnok na /privacy v jazykoch organizácie (D137)", async () => {
    const html = await render()
    expect(html).toContain('id="privacy-extra"')
    expect(html).toContain('name="extra-sk"')
    expect(html).toContain('name="extra-cs"')
    expect(html).toContain("Kamerový systém v sídle.")
  })
})
