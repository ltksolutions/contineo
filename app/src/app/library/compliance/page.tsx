/**
 * /library/compliance — kontroly súladu dokumentov proti normám (ADR-032, D196).
 * Rola `compliance` (`complianceContext`); behy sú spoločné pre všetkých
 * s rolou (Ján 11. 10. 2026). Nálezy a rozhodnutia sú na detaile behu
 * (`/library/compliance/[runId]`) — časť, ktorú má cesta pomenovať, má
 * vlastnú adresu.
 *
 * Ján 10. 10. 2026: „spravme kontrolu manuálov voči platným dokumentom… nech
 * vieme, že návody sú OK voči nadradeným normám".
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import MultiSelect from "@/components/MultiSelect"
import SubmitButton from "@/components/SubmitButton"
import { complianceContext } from "@/lib/complianceAccess"
import { documentRuns, MAX_FAILURES } from "@/lib/complianceCheck"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { startDocumentReviewAction } from "../complianceActions"

export const dynamic = "force-dynamic"

export default async function ComplianceRunsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await complianceContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const language: UiLanguage = ctx.person.language
  const t = dictionary(language).library.compliance
  const branding = brandingView(ctx.tenant)
  const [runs, docs] = await Promise.all([
    documentRuns(ctx.tenant.companyCode),
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, category: { $ne: "faq" } }, { projection: { documentId: 1, title: 1, category: 1, accessLevel: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string; category?: string; accessLevel?: string }[]>,
  ])
  const options = docs.map(d => ({ value: d.documentId, label: `${String(d.title ?? d.documentId)}${d.accessLevel === "internal" ? " · interný" : ""}` }))
  const last = runs[0]

  return (
    <AppShell language={language} title={t.heading} trail={{ "/library": dictionary(language).library.list.heading }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.intro}</p>
      <Notice message={q.msg} error={q.error === "1"} back="/library/compliance" language={language} />

      <section className="card detail-block" style={{ marginBottom: 16 }}>
        <form action={startDocumentReviewAction} style={{ display: "grid", gap: 12 }}>
          <div className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.subjects}</span>
            <MultiSelect name="subjectIds" options={options} selected={last?.scope.kind === "documents" ? last.scope.subjectIds : []} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
            <span className="quiet field-hint">{t.subjectsHint}</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.references}</span>
            <MultiSelect name="documentIds" options={options} selected={last?.documentIds ?? []} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
            <span className="quiet field-hint">{t.referencesHint}</span>
          </div>
          <div><SubmitButton className="button">{t.start}</SubmitButton></div>
        </form>
      </section>

      <h2 className="detail-block-title" style={{ margin: "8px 0 10px" }}>{t.runsHeading}</h2>
      {runs.length === 0 && <p className="quiet">{t.none}</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {runs.map(run => {
          const findings = (run.results ?? []).flatMap(r => r.findings)
          const open = findings.filter(f => !f.status).length
          return (
            <section key={run.runId} className="card detail-block compliance-run">
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <p style={{ margin: 0 }}>
                  <b>{t.runMeta(formatDate(run.startedAt, language), run.startedBy)}</b>{" · "}
                  {run.pending.length === 0 ? t.findingsCount(findings.length, open)
                    : run.failures >= MAX_FAILURES ? <span className="bad-fg">{t.stopped}</span>
                    : t.progress(run.total - run.pending.length, run.total)}
                </p>
                <p className="quiet" style={{ margin: 0 }}>
                  {run.scope.kind === "documents" ? run.scope.subjectIds.length : run.total} → {t.against(run.documents.map(d => d.title).join(", "))}
                </p>
              </div>
              <Link className="button button--quiet" href={`/library/compliance/${encodeURIComponent(run.runId)}`}>{t.openRun}</Link>
            </section>
          )
        })}
      </div>
    </div>
    </AppShell>
  )
}
