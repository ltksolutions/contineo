/**
 * complianceView.test.ts — detail kontroly súladu (návrh
 * KNIZ-kontrola-suladu-detail, 11. 10. 2026; ADR-032, D199).
 *
 * Stav nálezu, postup a „Uložiť a ďalší" sa odvodzujú z behu; keby sa
 * pomýlili, človek by skočil na rozhodnutý nález alebo by „čaká na správcu"
 * vyzeralo ako „treba vložiť ručne".
 */

import { describe, it, expect } from "vitest"
import { defaultDocument, filterFindings, findingState, nextOpen, orderedFindings, runProgress } from "../src/lib/complianceView"
import { docReviewPrompt, FINAL_STEP_NOTE, type DocumentFinding, type DocumentResult } from "../src/lib/complianceCheck"

const cite = { documentId: "rapp", title: "RaPP", articleRef: "čl. 8", quote: "q" }
function f(id: string, kind: DocumentFinding["kind"], status: DocumentFinding["status"] = null, applied: DocumentFinding["applied"] = null): DocumentFinding {
  return { id, kind, location: id, quote: "a", citation: cite, recommendation: "r", status, applied }
}
function doc(documentId: string, findings: DocumentFinding[]): DocumentResult {
  return { documentId, title: documentId, state: "draft", label: null, at: new Date(), summary: "", findings }
}

describe("stav nálezu", () => {
  it("rozlišuje čaká na správcu a treba vložiť ručne", () => {
    expect(findingState(f("1", "conflict"))).toBe("open")
    expect(findingState(f("1", "conflict", "kept"))).toBe("kept")
    expect(findingState(f("1", "conflict", "accepted", "draft"))).toBe("draft")
    expect(findingState(f("1", "conflict", "accepted", "pending"))).toBe("pending")
    expect(findingState(f("1", "conflict", "accepted", "manual"))).toBe("manual")
    expect(findingState(f("1", "conflict", "fixed"))).toBe("draft")
    expect(findingState(f("1", "conflict", "accepted", null))).toBe("draft")
  })
})

describe("poradie, postup, filter", () => {
  const a = doc("a", [f("a1", "missing", "kept"), f("a2", "conflict"), f("a3", "unclear")])
  const b = doc("b", [f("b1", "conflict", "accepted", "draft")])
  const c = doc("c", [f("c1", "missing")])

  it("nálezy podľa druhu: rozpor pred chýba pred nejasným", () => {
    expect(orderedFindings(a).map(x => x.id)).toEqual(["a2", "a1", "a3"])
  })

  it("postup za celú kontrolu a počty podľa druhu bez nulových", () => {
    expect(runProgress({ results: [a, b, c] })).toEqual({
      total: 5, decided: 2,
      byKind: [{ kind: "conflict", count: 2 }, { kind: "missing", count: 2 }, { kind: "unclear", count: 1 }],
    })
  })

  it("predvolený dokument je prvý s nerozhodnutým", () => {
    expect(defaultDocument([b, c])?.documentId).toBe("c")
    expect(defaultDocument([b])?.documentId).toBe("b")
    expect(defaultDocument([])).toBeNull()
  })

  it("filter Nerozhodnuté / Rozhodnuté / Všetky", () => {
    expect(filterFindings(a.findings, "open").map(x => x.id)).toEqual(["a2", "a3"])
    expect(filterFindings(a.findings, "decided").map(x => x.id)).toEqual(["a1"])
    expect(filterFindings(a.findings, "all")).toHaveLength(3)
  })

  it("ďalší nerozhodnutý: v dokumente, potom v ďalšom, potom od začiatku", () => {
    expect(nextOpen([a, b, c], "a", "a2")).toEqual({ documentId: "a", findingId: "a3" })
    expect(nextOpen([a, b, c], "a", "a3")).toEqual({ documentId: "c", findingId: "c1" })
    expect(nextOpen([a, b, c], "c", "c1")).toEqual({ documentId: "a", findingId: "a2" })
    expect(nextOpen([doc("x", [f("x1", "conflict")])], "x", "x1")).toBeNull()
  })
})

describe("zhrnutie za dokument (Q3)", () => {
  it("posledný krok dostane pokyn napísať zhrnutie za celý dokument", () => {
    expect(docReviewPrompt({ title: "M", text: "t" }, [], true)).toContain(FINAL_STEP_NOTE)
    expect(docReviewPrompt({ title: "M", text: "t" }, [])).not.toContain(FINAL_STEP_NOTE)
  })
})
