/**
 * dpo.test.ts — výkaz právnych základov a štvrťročný rytmus (ADR-012, D104).
 */
import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/session", () => ({ currentTenant: vi.fn(), currentPerson: vi.fn() }))

import { legalBasisReport, quarterKey, isQuarterStart, summarize, isDpo, DPO_ROLE } from "../src/lib/dpo"
import { dpoReportEmail } from "../src/lib/ecomail"

const NOW = new Date("2026-10-01T06:00:00Z")
const Y = (s: string) => new Date(`${s}T00:00:00Z`)

function doc(documentId: string, title: string, v: Record<string, unknown>) {
  return {
    documentId, title,
    versions: [{ versionId: `${documentId}-v1`, label: "1", isActive: true, effectiveFrom: Y("2026-01-01"), effectiveTo: null, ...v }],
  } as never
}

describe("legalBasisReport", () => {
  const active = new Set(["g1"])
  const rows = legalBasisReport([
    doc("a", "Bozp", { legalBasis: "legal_obligation", legalBasisKey: "bozp", legalBasisReference: "§ 7 z. 124/2006", responsiblePerson: { personId: "g1", fullName: "G", email: "g@x" } }),
    doc("b", "Etický kódex", { legalBasis: "legitimate_interest", legalBasisKey: null, responsiblePerson: { personId: "g2", fullName: "H", email: "h@x" } }),
    doc("c", "Archív", { isActive: false }),
    doc("d", "Bez základu", {}),
    doc("e", "Zákon bez odkazu", { legalBasis: "legal_obligation", legalBasisKey: "x", responsiblePerson: { personId: "g1", fullName: "G", email: "g@x" } }),
  ], active, NOW)

  it("len platné znenia — archív DPO nekontroluje", () => {
    expect(rows.map(r => r.documentId)).not.toContain("c")
    expect(rows).toHaveLength(4)
  })
  it("pomenuje, čo chýba", () => {
    const by = Object.fromEntries(rows.map(r => [r.documentId, r.problems]))
    expect(by.a).toEqual([])
    expect(by.b).toEqual(["outsideCodelist", "inactiveResponsible"])
    expect(by.d).toEqual(["noBasis", "noResponsible"])
    expect(by.e).toEqual(["noReference"])
  })
  it("znenia s nedostatkom sú hore", () => {
    expect(rows[rows.length - 1].documentId).toBe("a")
  })
  it("súhrn do e-mailu", () => {
    expect(summarize(rows)).toEqual({ total: 4, legalObligation: 2, legitimateInterest: 1, withProblems: 3 })
  })
})

describe("štvrťrok", () => {
  it("kľúč kvartálu", () => {
    expect(quarterKey(Y("2026-10-01"))).toBe("2026-Q4")
    expect(quarterKey(Y("2027-03-31"))).toBe("2027-Q1")
  })
  it("posiela sa len v prvý deň kvartálu", () => {
    expect(isQuarterStart(Y("2026-10-01"))).toBe(true)
    expect(isQuarterStart(Y("2026-11-01"))).toBe(false)
    expect(isQuarterStart(Y("2026-10-02"))).toBe(false)
  })
})

describe("rola a e-mail", () => {
  it("rola dpo", () => {
    expect(isDpo({ roles: [DPO_ROLE] })).toBe(true)
    expect(isDpo({ roles: ["hr"] })).toBe(false)
  })
  it("e-mail nesie len počty, nie názvy predpisov", () => {
    const m = dpoReportEmail("https://x/dpo", "x", "2026-Q4", { total: 4, legalObligation: 2, legitimateInterest: 1, withProblems: 3 }, "sk")
    expect(m.subject).toContain("2026-Q4")
    expect(m.text).toContain("s nedostatkom: 3")
    expect(m.text).toContain("https://x/dpo")
  })
})
