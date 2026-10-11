/**
 * /library/compliance/[runId] — detail kontroly súladu (ADR-032, D196).
 *
 * Údaje o behu (model, čas, cena) a nálezy pri každom kontrolovanom
 * dokumente. Rozhodnutie (Ján 11. 10. 2026) sú dve voľby — **ponechať
 * existujúce znenie**, alebo **prijať odporúčanie a upraviť**; pri prijatí
 * sa ukáže navrhnuté znenie na úpravu. Dôvod je povinný pri oboch.
 * Prepínanie volieb robí CSS (`:has`), stránka funguje bez JavaScriptu.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import { complianceContext } from "@/lib/complianceAccess"
import { documentRun, runUsage, runModel, MAX_FAILURES, FINDING_KINDS, type DocumentFinding, type DocumentResult, type ComplianceRun } from "@/lib/complianceCheck"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { decideFindingAction } from "../../complianceActions"

export const dynamic = "force-dynamic"

type T = ReturnType<typeof dictionary>["library"]["compliance"]

function statusLabel(t: T, f: DocumentFinding): string {
  return f.status === "accepted" || f.status === "fixed" ? (f.status === "fixed" ? t.statusFixed : t.statusAccepted) : f.status === "kept" ? t.statusKept : t.statusOpen
}

function DecisionForm({ t, run, res, f, canEditDrafts }: { t: T; run: ComplianceRun; res: DocumentResult; f: DocumentFinding; canEditDrafts: boolean }) {
  const hint = !canEditDrafts ? t.proposedHintNoRights : res.state === "valid" ? t.proposedHintValid : t.proposedHintDraft
  const prior = f.status === "kept" ? "kept" : f.status ? "accepted" : null
  return (
    <form action={decideFindingAction} className="decision">
      <input type="hidden" name="runId" value={run.runId} />
      <input type="hidden" name="documentId" value={res.documentId} />
      <input type="hidden" name="findingId" value={f.id} />
      <fieldset className="decision-fieldset">
        <legend className="field-label">{t.status}</legend>
        <div className="decision-switch">
          <label className="decision-option">
            <input type="radio" name="decision" value="kept" required defaultChecked={prior === "kept"} />
            <span>{t.decisionKeep}</span>
          </label>
          <label className="decision-option">
            <input type="radio" name="decision" value="accepted" required defaultChecked={prior === "accepted"} />
            <span>{t.decisionAccept}</span>
          </label>
        </div>
      </fieldset>
      <label className="field decision-text" style={{ margin: 0 }}>
        <span className="field-label">{t.proposed}</span>
        <textarea className="field-input" name="text" rows={6} defaultValue={f.acceptedText ?? f.proposed ?? f.quote} />
        <span className="quiet field-hint">{f.proposed || f.acceptedText ? hint : `${t.proposedMissing} ${hint}`}</span>
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span className="field-label">{t.reason}</span>
        <textarea className="field-input" name="reason" rows={3} required maxLength={1000} defaultValue={f.reason ?? ""} placeholder={t.reasonPlaceholder} />
        <span className="quiet field-hint">{t.reasonHint}</span>
      </label>
      <div><SubmitButton className="button button--quiet">{t.save}</SubmitButton></div>
    </form>
  )
}

export default async function ComplianceRunPage({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await complianceContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { runId } = await params
  const run = await documentRun(ctx.tenant.companyCode, decodeURIComponent(runId))
  if (!run) notFound()
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const language: UiLanguage = ctx.person.language
  const dict = dictionary(language)
  const t = dict.library.compliance
  const branding = brandingView(ctx.tenant)
  const [usage, model] = await Promise.all([runUsage(run), runModel(run)])
  const minutes = run.finishedAt ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 60_000) : null
  const state = run.pending.length === 0 ? t.done : run.failures >= MAX_FAILURES ? t.stopped : t.progress(run.total - run.pending.length, run.total)
  const meta: [string, string][] = [
    [t.metaStarted, `${formatDate(run.startedAt, language)}, ${run.startedBy}`],
    [t.metaFinished, run.finishedAt ? formatDate(run.finishedAt, language) : `${t.running} — ${state}`],
    [t.metaDuration, minutes === null ? t.metaUnknown : t.duration(minutes)],
    [t.metaModel, model ?? t.metaUnknown],
    [t.metaCalls, usage ? t.calls(usage.calls, usage.failed) : t.metaUnknown],
    [t.metaTokens, usage ? t.tokens(usage.input + usage.cacheWrite, usage.output, usage.cacheRead) : t.metaUnknown],
    [t.metaCost, usage ? `${usage.usd.toFixed(2)} USD` : t.metaUnknown],
    [t.references, `${run.documents.map(d => `${d.title}${d.state === "draft" ? ` (${t.draftMark})` : d.label ? ` (${d.label})` : ""}`).join(", ")} · ${t.steps(run.steps)}`],
  ]
  const back = `/library/compliance/${encodeURIComponent(run.runId)}`

  return (
    <AppShell language={language} title={t.heading} trail={{ "/library": dict.library.list.heading, "/library/compliance": t.heading }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.runMeta(formatDate(run.startedAt, language), run.startedBy)}</h1>
      </div>
      <Notice message={q.msg} error={q.error === "1"} back={back} language={language} />

      <section className="card detail-block" style={{ marginBottom: 16 }}>
        <h2 className="detail-block-title">{t.metaHeading}</h2>
        <dl className="detail-meta">
          {meta.map(([k, v]) => (
            <div className="detail-meta-row" key={k}>
              <dt className="quiet detail-meta-key">{k}</dt>
              <dd className="detail-meta-value">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        {(run.results ?? []).map(res => (
          <details key={res.documentId} className="pr-original card" open={res.findings.some(f => !f.status)}>
            <summary>
              {res.title}
              {res.state === "draft" && <span className="quiet">&nbsp;({t.draftMark})</span>}
              &nbsp;<span className={`tag${res.findings.some(f => !f.status) ? " tag--warn" : ""}`}>{t.findingsCount(res.findings.length, res.findings.filter(f => !f.status).length)}</span>
            </summary>
            <div className="pr-original-body">
              <p style={{ margin: 0 }}><Link href={`/library/${encodeURIComponent(res.documentId)}`}>{res.title}</Link></p>
              {res.summary && <p style={{ margin: 0 }}>{res.summary}</p>}
              {res.findings.length === 0 && <p className="quiet" style={{ margin: 0 }}>{t.noFindings}</p>}
              {FINDING_KINDS.flatMap(kind => res.findings.filter(f => f.kind === kind)).map(f => (
                <div key={f.id} id={`${res.documentId}-${f.id}`} className="pr-review">
                  <div className="mg-pills">
                    <span className="tag tag--warn">{t.kinds[f.kind]}</span>
                    <span className="tag">{f.decidedAt ? t.decided(statusLabel(t, f), f.decidedBy ?? "", formatDate(f.decidedAt, language)) : t.statusOpen}</span>
                    {f.applied && <span className="tag">{f.applied === "draft" ? t.appliedDraft : t.appliedManual}</span>}
                  </div>
                  <p style={{ margin: 0 }}><b>{t.location}:</b> {f.location}</p>
                  {f.quote && <p style={{ margin: 0 }}><b>{t.quote}:</b> <q>{f.quote}</q></p>}
                  <p style={{ margin: 0 }}>
                    <b>{t.norm}:</b> <Link href={`/library/${encodeURIComponent(f.citation.documentId)}`}>{f.citation.title}{f.citation.articleRef ? `, ${f.citation.articleRef}` : ""}</Link>
                    {f.citation.quote && <> — <q>{f.citation.quote}</q></>}
                  </p>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.recommendation}:</b> {f.recommendation}</p>
                  {f.status ? (
                    <>
                      {f.acceptedText && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.acceptedText}:</b> {f.acceptedText}</p>}
                      {f.reason && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.reason}:</b> {f.reason}</p>}
                      {f.applied && <p style={{ margin: 0 }}><Link href={`/library/${encodeURIComponent(res.documentId)}/text`}>{t.openDraft}</Link></p>}
                      <details>
                        <summary className="quiet" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>{t.changeDecision}</summary>
                        <DecisionForm t={t} run={run} res={res} f={f} canEditDrafts={ctx.canEditDrafts} />
                      </details>
                    </>
                  ) : (
                    <DecisionForm t={t} run={run} res={res} f={f} canEditDrafts={ctx.canEditDrafts} />
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
    </AppShell>
  )
}
