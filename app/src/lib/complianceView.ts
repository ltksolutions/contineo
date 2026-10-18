/**
 * complianceView.ts — čo detail kontroly súladu odvodzuje z behu
 * (návrh KNIZ-kontrola-suladu-detail, 11. 10. 2026; ADR-032, D199).
 *
 * Stav nálezu, postup, poradie a „ďalší nerozhodnutý" sa neukladajú —
 * počítajú sa z `run.results[].findings` (D27). Funkcie sú čisté, aby sa
 * dali testovať bez databázy.
 */

import { FINDING_KINDS, type ComplianceRun, type DocumentFinding, type DocumentResult, type FindingKind } from "./complianceCheck"

/**
 * Stav karty nálezu: `open` nerozhodnuté, `draft` prijaté a zapísané do
 * konceptu, `kept` vedome ponechané, `pending` prijaté a čaká na správcu
 * obsahu, `manual` úryvok sa nenašiel a treba ho vložiť ručne.
 */
export type FindingState = "open" | "draft" | "kept" | "pending" | "manual"

export function findingState(f: Pick<DocumentFinding, "status" | "applied">): FindingState {
  if (!f.status) return "open"
  if (f.status === "kept") return "kept"
  if (f.applied === "pending") return "pending"
  if (f.applied === "manual") return "manual"
  // `draft`, `null` (znenie sa nezmenilo) aj staré `fixed`.
  return "draft"
}

/** Nálezy v poradí podľa druhu (rozpor, zastarané, chýba, nejasné), ako ich vracia model. */
export function orderedFindings(res: Pick<DocumentResult, "findings">): DocumentFinding[] {
  return FINDING_KINDS.flatMap(kind => res.findings.filter(f => f.kind === kind))
}

export function openCount(res: Pick<DocumentResult, "findings">): number {
  return res.findings.filter(f => !f.status).length
}

export interface RunProgress {
  total: number
  decided: number
  byKind: { kind: FindingKind; count: number }[]
}

export function runProgress(run: Pick<ComplianceRun, "results">): RunProgress {
  const all = (run.results ?? []).flatMap(r => r.findings)
  return {
    total: all.length,
    decided: all.filter(f => f.status).length,
    byKind: FINDING_KINDS.map(kind => ({ kind, count: all.filter(f => f.kind === kind).length })).filter(k => k.count),
  }
}

/** Kotva karty nálezu — rovnaká ako doteraz, odkazy z e-mailov a zvončeka platia. */
export function findingAnchor(documentId: string, findingId: string): string {
  return `${documentId}-${findingId}`
}

/** Dokument bez `?doc=`: prvý s nerozhodnutým nálezom, inak prvý. */
export function defaultDocument(results: DocumentResult[]): DocumentResult | null {
  return results.find(r => openCount(r) > 0) ?? results[0] ?? null
}

export interface FindingRef { documentId: string; findingId: string }

/**
 * Ďalší nerozhodnutý nález po danom: najprv ďalej v tom istom dokumente,
 * potom v ďalších dokumentoch, nakoniec od začiatku zoznamu. Samotný
 * nález sa nevracia — po uložení už rozhodnutý je.
 */
export function nextOpen(results: DocumentResult[], documentId: string, findingId: string): FindingRef | null {
  const flat = results.flatMap(r => orderedFindings(r).map(f => ({ documentId: r.documentId, f })))
  const at = flat.findIndex(x => x.documentId === documentId && x.f.id === findingId)
  const order = at < 0 ? flat : [...flat.slice(at + 1), ...flat.slice(0, at)]
  const hit = order.find(x => !x.f.status)
  return hit ? { documentId: hit.documentId, findingId: hit.f.id } : null
}

export type FindingView = "open" | "decided" | "all"

export function isFindingView(x: unknown): x is FindingView {
  return x === "open" || x === "decided" || x === "all"
}

export function filterFindings(findings: DocumentFinding[], view: FindingView): DocumentFinding[] {
  return view === "all" ? findings : findings.filter(f => (view === "open" ? !f.status : Boolean(f.status)))
}

/**
 * „dokument:nález" z poľa `next` formulára rozhodnutia. Delí sa podľa
 * **poslednej** dvojbodky — identifikátor dokumentu ju má sám
 * („sfz:issf_00_prehlad"). `split(":")` posielal „Uložiť a ďalší" na
 * `?doc=sfz` (zistené 18. 10. 2026 pri rozhodovaní návrhov z helpdesku).
 */
export function parseNextFinding(next: string): { documentId: string; findingId: string } {
  const cut = String(next ?? "").lastIndexOf(":")
  return cut > 0 ? { documentId: next.slice(0, cut), findingId: next.slice(cut + 1) } : { documentId: "", findingId: "" }
}
