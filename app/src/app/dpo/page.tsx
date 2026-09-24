/**
 * /dpo — ochrana údajov pre zodpovednú osobu (ADR-012, D104, D105).
 *
 * Výkaz právnych základov platných predpisov: čo platí, kto zaň zodpovedá
 * a čo chýba. DPO základ **kontroluje, neurčuje** (O15/A10) — stránka preto
 * nič nemení a pri nedostatku ukazuje, na koho sa obrátiť.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { dpoContext } from "@/lib/dpo"
import { legalBasisRows } from "@/lib/dpoDb"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function DpoPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ layout?: string }>(await searchParams)
  const ctx = await dpoContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const language = ctx.person.language
  const t = dictionary(language).dpo
  const tr = dictionary(language).responsibility
  const branding = brandingView(ctx.tenant)
  const rows = await legalBasisRows(ctx.person.companyCode)
  const withProblems = rows.filter(r => r.problems.length > 0).length

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div style={{ maxWidth: 900, ...tenantStyle(branding) }}>
        <h1 className="page-title">{t.heading}</h1>
        <p className="quiet page-lead" style={{ margin: "0 0 20px", maxWidth: 640 }}>{t.intro}</p>

        <section style={{ display: "grid", gap: 12 }}>
          <div className="page-head">
            <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.reportHeading}</h2>
            {rows.length > 0 && (
              <span className="quiet library-count">{t.summary(rows.length, withProblems)}</span>
            )}
            {rows.length > 0 && (
              <Link className="button button--quiet" href="/dpo/csv">{t.csv}</Link>
            )}
          </div>

          {rows.length === 0 && (
            <div className="empty"><div className="empty-text">{t.empty}</div></div>
          )}

          {/* Karty, nie tabuľka: na telefóne sa päť stĺpcov nezmestí a DPO
              výkaz otvorí aj z e-mailu v mobile. */}
          <ul className="widget-list">
            {rows.map(r => (
              <li key={`${r.documentId}|${r.versionId}`} className="card" style={{ padding: 16, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  <Link href={`/documents/${encodeURIComponent(r.documentId)}`} style={{ fontWeight: 600 }}>{r.title}</Link>
                  {r.problems.length === 0
                    ? <span className="tag">{t.ok}</span>
                    : r.problems.map(p => <span key={p} className="tag tag--draft">{t.problems[p]}</span>)}
                </div>
                <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                  {t.version}: {r.versionLabel}
                  {r.effectiveFrom && ` · ${formatDate(r.effectiveFrom, language)}`}
                </div>
                <div style={{ fontSize: "var(--fs-small)" }}>
                  <span className="quiet">{t.basis}: </span>
                  {r.legalBasis ? (r.basisLabel ?? tr.basisLabel[r.legalBasis]) : t.none}
                  {r.reference && <> · <span className="quiet">{t.reference}: </span>{r.reference}</>}
                </div>
                <div style={{ fontSize: "var(--fs-small)", overflowWrap: "anywhere" }}>
                  <span className="quiet">{t.responsible}: </span>
                  {r.responsible ? `${r.responsible.fullName} · ${r.responsible.email}` : t.none}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  )
}
