/**
 * Zodpovedná osoba (DPO) — rola a výkaz právnych základov (ADR-012, D104).
 *
 * DPO právny základ **kontroluje, neurčuje** (O15/A10): určuje ho zodpovedná
 * osoba za predpis (D91). Výkaz preto nič nemení, len ukazuje, čo platí
 * a čo chýba — raz za štvrťrok aj e-mailom.
 */

import { currentTenant, currentPerson } from "./session"
import { effectiveVersion, type DocumentRecord } from "./documents"
import type { LegalBasis } from "./versionResponsibility"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const DPO_ROLE = "dpo"

export function isDpo(person: Pick<Person, "roles"> | null): boolean {
  return Boolean(person?.roles?.includes(DPO_ROLE))
}

export type DpoContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function dpoContext(): Promise<DpoContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    // Výpadok databázy nesmie obrazovku otvoriť (rovnako ako `hrContext()`).
    console.error("[dpo] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isDpo(person)) return { state: "forbidden" }
  return { state: "ready", person, tenant }
}

/** Čo pri platnom znení chýba alebo nesedí. */
export type BasisProblem = "noBasis" | "outsideCodelist" | "noReference" | "noResponsible" | "inactiveResponsible"

export interface LegalBasisRow {
  documentId: string
  title: string
  versionId: string
  versionLabel: string
  effectiveFrom: Date | null
  legalBasis: LegalBasis | null
  /** Názov položky číselníka, ak je; inak `null`. */
  basisLabel: string | null
  reference: string | null
  responsible: { fullName: string; email: string } | null
  problems: BasisProblem[]
}

/**
 * Výkaz právnych základov — **len platné znenia** (k dnešku). Archívne znenia
 * DPO nekontroluje: nikto ich už nepotvrdzuje, a základ, ktorý mali v čase
 * potvrdenia, nesie každé potvrdenie ako odtlačok.
 *
 * Čistá funkcia; poradie: najprv znenia s problémom, potom podľa názvu.
 */
export function legalBasisReport(
  docs: Pick<DocumentRecord, "documentId" | "title" | "versions">[],
  activePersonIds: Set<string>,
  now: Date = new Date(),
): LegalBasisRow[] {
  const rows: LegalBasisRow[] = []
  for (const d of docs) {
    const r = effectiveVersion(d as DocumentRecord, now)
    if (!r.ok) continue
    const v = r.version as typeof r.version & {
      legalBasis?: LegalBasis | null
      legalBasisKey?: string | null
      legalBasisLabel?: string | null
      legalBasisReference?: string | null
      responsiblePerson?: { personId: string; fullName: string; email: string } | null
    }
    const problems: BasisProblem[] = []
    if (!v.legalBasis) problems.push("noBasis")
    else {
      if (!v.legalBasisKey) problems.push("outsideCodelist")
      if (v.legalBasis === "legal_obligation" && !v.legalBasisReference) problems.push("noReference")
    }
    if (!v.responsiblePerson) problems.push("noResponsible")
    else if (!activePersonIds.has(v.responsiblePerson.personId)) problems.push("inactiveResponsible")

    rows.push({
      documentId: d.documentId,
      title: d.title,
      versionId: v.versionId,
      versionLabel: v.label,
      effectiveFrom: v.effectiveFrom ?? null,
      legalBasis: v.legalBasis ?? null,
      basisLabel: v.legalBasisLabel ?? null,
      reference: v.legalBasisReference ?? null,
      responsible: v.responsiblePerson
        ? { fullName: v.responsiblePerson.fullName, email: v.responsiblePerson.email }
        : null,
      problems,
    })
  }
  return rows.sort((a, b) =>
    Number(b.problems.length > 0) - Number(a.problems.length > 0) || a.title.localeCompare(b.title, "sk"),
  )
}

/** `2026-Q4` — identita štvrťročného výkazu; druhý e-mail v tom istom kvartáli neodíde. */
export function quarterKey(d: Date): string {
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`
}

/** Prvý deň kvartálu (1. 1., 1. 4., 1. 7., 1. 10.) — deň, keď cron posiela výkaz. */
export function isQuarterStart(d: Date): boolean {
  return d.getUTCDate() === 1 && d.getUTCMonth() % 3 === 0
}

export interface QuarterSummary {
  total: number
  legalObligation: number
  legitimateInterest: number
  withProblems: number
}

export function summarize(rows: LegalBasisRow[]): QuarterSummary {
  return {
    total: rows.length,
    legalObligation: rows.filter(r => r.legalBasis === "legal_obligation").length,
    legitimateInterest: rows.filter(r => r.legalBasis === "legitimate_interest").length,
    withProblems: rows.filter(r => r.problems.length > 0).length,
  }
}
