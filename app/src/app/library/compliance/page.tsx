/**
 * /library/compliance — kontrola súladu dokumentov proti normám (ADR-032, D196).
 * Len správca obsahu (`libraryContext`).
 *
 * Ján 10. 10. 2026: „spravme kontrolu manuálov voči platným dokumentom… nech
 * vieme, že návody sú OK voči nadradeným normám". Výsledok je zoznam nálezov
 * pri každom kontrolovanom dokumente; dokument sa nemení. Pri každom náleze
 * sa zapíše *opravené* alebo *vedome ponechané* s dôvodom.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import MultiSelect from "@/components/MultiSelect"
import SubmitButton from "@/components/SubmitButton"
import { libraryContext } from "@/lib/library"
import { documentRuns, MAX_FAILURES, FINDING_KINDS, type DocumentFinding } from "@/lib/complianceCheck"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { startDocumentReviewAction, decideFindingAction } from "../complianceActions"

export const dynamic = "force-dynamic"

export default async function ComplianceRunsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
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
  const statusLabel = (f: DocumentFinding) => (f.status === "fixed" ? t.statusFixed : f.status === "kept" ? t.statusKept : t.statusOpen)

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
            <MultiSelect name="subjectIds" options={options} selected={runs[0]?.scope.kind === "documents" ? runs[0].scope.subjectIds : []} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
            <span className="quiet field-hint">{t.subjectsHint}</span>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.references}</span>
            <MultiSelect name="documentIds" options={options} selected={runs[0]?.documentIds ?? []} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
            <span className="quiet field-hint">{t.referencesHint}</span>
          </div>
          <div><SubmitButton className="button">{t.start}</SubmitButton></div>
        </form>
      </section>

      {runs.length === 0 && <p className="quiet">{t.none}</p>}

      <div style={{ display: "grid", gap: 16 }}>
        {runs.map(run => (
          <section key={run.runId} className="card detail-block">
            <p style={{ margin: 0 }}>
              <b>{t.runMeta(formatDate(run.startedAt, language), run.startedBy)}</b>{" · "}
              {run.pending.length === 0 ? t.done
                : run.failures >= MAX_FAILURES ? <span className="bad-fg">{t.stopped}</span>
                : t.progress(run.total - run.pending.length, run.total)}
            </p>
            <p className="quiet" style={{ margin: 0 }}>
              {t.against(run.documents.map(d => `${d.title}${d.state === "draft" ? ` (${t.draftMark})` : d.label ? ` (${d.label})` : ""}`).join(", "))} · {t.steps(run.steps)}
            </p>
            {(run.results ?? []).map(res => (
              <details key={res.documentId} className="pr-original" open={res.findings.some(f => !f.status)}>
                <summary>
                  <Link href={`/library/${encodeURIComponent(res.documentId)}`}>{res.title}</Link>
                  {res.state === "draft" && <span className="quiet">&nbsp;({t.draftMark})</span>}
                  &nbsp;<span className={`tag${res.findings.length ? " tag--warn" : ""}`}>{res.findings.length}</span>
                </summary>
                <div className="pr-original-body">
                  {res.summary && <p style={{ margin: 0 }}>{res.summary}</p>}
                  {res.findings.length === 0 && <p className="quiet" style={{ margin: 0 }}>{t.noFindings}</p>}
                  {FINDING_KINDS.flatMap(kind => res.findings.filter(f => f.kind === kind)).map(f => (
                    <div key={f.id} id={`${res.documentId}-${f.id}`} className="pr-review">
                      <div className="mg-pills">
                        <span className="tag tag--warn">{t.kinds[f.kind]}</span>
                        <span className="tag">{f.decidedAt ? t.decided(statusLabel(f), f.decidedBy ?? "", formatDate(f.decidedAt, language)) : t.statusOpen}</span>
                      </div>
                      <p style={{ margin: 0 }}><b>{t.location}:</b> {f.location}</p>
                      {f.quote && <p style={{ margin: 0 }}><b>{t.quote}:</b> <q>{f.quote}</q></p>}
                      <p style={{ margin: 0 }}>
                        <b>{t.norm}:</b> <Link href={`/library/${encodeURIComponent(f.citation.documentId)}`}>{f.citation.title}{f.citation.articleRef ? `, ${f.citation.articleRef}` : ""}</Link>
                        {f.citation.quote && <> — <q>{f.citation.quote}</q></>}
                      </p>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.recommendation}:</b> {f.recommendation}</p>
                      {f.reason && <p className="quiet" style={{ margin: 0 }}><b>{t.reason}:</b> {f.reason}</p>}
                      <form action={decideFindingAction} className="mg-inline" style={{ alignItems: "flex-end" }}>
                        <input type="hidden" name="runId" value={run.runId} />
                        <input type="hidden" name="documentId" value={res.documentId} />
                        <input type="hidden" name="findingId" value={f.id} />
                        <label className="field" style={{ margin: 0 }}>
                          <span className="field-label">{t.status}</span>
                          <select className="field-input" name="status" defaultValue={f.status ?? "fixed"}>
                            <option value="fixed">{t.statusFixed}</option>
                            <option value="kept">{t.statusKept}</option>
                          </select>
                        </label>
                        <label className="field" style={{ margin: 0 }}>
                          <span className="field-label">{t.reason}</span>
                          <input className="field-input" name="reason" defaultValue={f.reason ?? ""} maxLength={500} />
                          <span className="quiet field-hint">{t.reasonHint}</span>
                        </label>
                        <div><SubmitButton className="button button--quiet">{t.save}</SubmitButton></div>
                      </form>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </section>
        ))}
      </div>
    </div>
    </AppShell>
  )
}
