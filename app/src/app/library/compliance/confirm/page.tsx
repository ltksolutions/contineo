/**
 * /library/compliance/confirm — rekapitulácia pred spustením kontroly
 * (ADR-036). Ján 20. 10. 2026: „keď kliknem na Navrhnúť doplnenie manuálov,
 * hneď sa spustí kontrola, to nie je ok" — vznikli zbytočné platené behy.
 *
 * Každý formulár spustenia (nová kontrola, Spustiť znova, požiadavka,
 * návrhy z helpdesku) bez `confirmed` končí tu. Plné tlačidlo je na konci
 * stránky — stlačí sa až po prečítaní toho, čo sa spustí (R2).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import SubmitButton from "@/components/SubmitButton"
import { complianceContext } from "@/lib/complianceAccess"
import { previewRun } from "@/lib/complianceCheck"
import { listChannels } from "@/lib/channels"
import { checkById, roundsOf } from "@/lib/complianceChecks"
import { requestById } from "@/lib/complianceRequests"
import { modelLabel } from "@/lib/aiSettings"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatAmount, formatDate, type UiLanguage } from "@/lib/i18n"
import type { RawQuery } from "@/lib/urlParams"
import { startDocumentReviewAction, startHelpdeskReviewAction } from "../../complianceActions"

export const dynamic = "force-dynamic"

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []).map(String).map(s => s.trim()).filter(Boolean)
const one = (v: string | string[] | undefined) => list(v)[0] ?? ""

export default async function ConfirmRunPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await complianceContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const sp = await searchParams
  const language: UiLanguage = ctx.person.language
  const t = dictionary(language).library.compliance
  /*
   * Ďalšie kolo existujúcej kontroly (`?check=`, ADR-036 D239): zadanie je
   * z kontroly; pri požiadavke (Q2) normy z požiadavky, inak uložené.
   */
  const check = one(sp.check) ? await checkById(ctx.tenant.companyCode, one(sp.check)) : null
  if (one(sp.check) && (!check || check.archivedAt)) notFound()
  const requestId = one(sp.requestId)
  const request = requestId ? await requestById(ctx.tenant.companyCode, requestId) : null
  const helpdesk = check ? check.kind === "helpdesk" : one(sp.kind) === "helpdesk"
  const channelKey = check?.channelKey ?? one(sp.channelKey)
  const channel = helpdesk ? (await listChannels(ctx.tenant.companyCode)).find(c => c.key === channelKey) ?? null : null
  if (helpdesk && !channel) notFound()
  const subjectIds = check ? check.subjectIds : list(sp.subjectIds)
  const documentIds = check ? (request?.referenceIds.length ? request.referenceIds : check.referenceIds) : list(sp.documentIds)
  const name = check ? check.name : one(sp.name)
  const nextRound = check ? (await roundsOf(ctx.tenant.companyCode, check.checkId)).length + 1 : 1
  const runHref = (runId: string) => `/library/compliance/${encodeURIComponent(check?.checkId ?? runId)}`
  const p = await previewRun(ctx.tenant.companyCode, { subjectIds, documentIds, channel: channel ? { key: channel.key, name: channel.name } : null, checkId: check?.checkId ?? null })
  const action = helpdesk ? startHelpdeskReviewAction : startDocumentReviewAction
  const canStart = !p.running && p.subjects.length > 0 && p.references.length > 0

  return (
    <AppShell language={language} title={t.confirmHeading} trail={{ "/library": dictionary(language).library.list.heading, "/library/compliance": t.heading }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(brandingView(ctx.tenant)) }}>
      <div className="page-head">
        <h1 className="page-title">{t.confirmHeading}</h1>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.confirmLead}</p>

      {p.running && (
        <div className="lnote lnote--warn" style={{ marginBottom: 12 }}>
          <span className="lnote-mark" aria-hidden="true">!</span>
          <div className="lnote-text">{t.confirmRunning} <Link href={runHref(p.running.runId)}>{t.openRun}</Link></div>
        </div>
      )}
      {!p.running && p.openInLast && (
        <div className="lnote lnote--warn" style={{ marginBottom: 12 }}>
          <span className="lnote-mark" aria-hidden="true">!</span>
          <div className="lnote-text">{t.confirmOpenInLast(p.openInLast.open)} <Link href={runHref(p.openInLast.runId)}>{t.openRun}</Link></div>
        </div>
      )}

      <section className="card detail-block" style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        {check
          ? <p style={{ margin: 0 }}><b>{t.nameLabel}:</b> {t.ck.confirmCheck(check.name || t.runDefaultName(formatDate(check.createdAt, language)), nextRound)}</p>
          : name && <p style={{ margin: 0 }}><b>{t.nameLabel}:</b> {name}</p>}
        <p style={{ margin: 0 }}><b>{t.confirmKind}:</b> {channel ? t.confirmKindHelpdesk(channel.name, p.questions) : t.confirmKindDocuments}</p>
        <div>
          <p style={{ margin: "0 0 4px" }}><b>{t.subjects}</b> · {p.subjects.length}</p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>{p.subjects.map(d => <li key={d.documentId}>{d.title}</li>)}</ul>
        </div>
        <div>
          <p style={{ margin: "0 0 4px" }}><b>{t.references}</b> · {p.references.length}</p>
          {p.fromHierarchy && <p className="quiet" style={{ margin: "0 0 4px" }}>{t.confirmFromHierarchy}</p>}
          <ul style={{ margin: 0, paddingLeft: 20 }}>{p.references.map(d => <li key={d.documentId}>{d.title}</li>)}</ul>
        </div>
        <p style={{ margin: 0 }}><b>{t.confirmModel}:</b> {p.model ? modelLabel(p.model) : "—"}</p>
        <p style={{ margin: 0 }}><b>{t.confirmEstimate}:</b> {p.estimate
          ? t.confirmEstimateValue(formatAmount(p.estimate.usd, language), p.estimate.minutes, formatDate(p.estimate.from, language))
          : t.confirmNoEstimate}</p>
      </section>

      {canStart && (
        <form action={action} style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <input type="hidden" name="confirmed" value="1" />
          {check && <input type="hidden" name="checkId" value={check.checkId} />}
          {!check && name && <input type="hidden" name="name" value={name} />}
          {requestId && <input type="hidden" name="requestId" value={requestId} />}
          {channel && <input type="hidden" name="channelKey" value={channel.key} />}
          {!channel && !check && subjectIds.map(id => <input key={id} type="hidden" name="subjectIds" value={id} />)}
          {!channel && documentIds.map(id => <input key={id} type="hidden" name="documentIds" value={id} />)}
          <p className="quiet" style={{ margin: 0 }}>{t.confirmBackground}</p>
          <SubmitButton className="button">{t.confirmStart}</SubmitButton>
        </form>
      )}
    </div>
    </AppShell>
  )
}
