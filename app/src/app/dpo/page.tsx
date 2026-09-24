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
import { listObjections } from "@/lib/objectionsDb"
import { OBJECTION_CHANNELS } from "@/lib/objections"
import Notice from "@/components/Notice"
import { recordObjectionAction, decideObjectionAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function DpoPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ layout?: string; msg?: string; error?: string }>(await searchParams)
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
  const objections = await listObjections(ctx.person.companyCode)
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div style={{ maxWidth: 900, ...tenantStyle(branding) }}>
        <h1 className="page-title">{t.heading}</h1>
        <p className="quiet page-lead" style={{ margin: "0 0 20px", maxWidth: 640 }}>{t.intro}</p>
        <Notice message={q.msg} error={q.error === "1"} back="/dpo" />

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

        {/*
          Námietky (ADR-012, D105). Zápis a rozhodnutie sú dva formuláre:
          námietka prichádza a vybavuje sa v inom čase a do rozhodnutia sa
          nesmie nič zmazať.
        */}
        <section id="objections" style={{ display: "grid", gap: 12, marginTop: 32 }}>
          <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.objectionsHeading}</h2>
          <p className="quiet" style={{ margin: 0, maxWidth: 640, fontSize: "var(--fs-body)" }}>{t.objectionsIntro}</p>

          {objections.length === 0 && (
            <div className="empty"><div className="empty-text">{t.noObjections}</div></div>
          )}
          <ul className="widget-list">
            {objections.map(o => (
              <li key={o.id} className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                  <strong>{o.personName}</strong>
                  <span className={o.status === "pending" ? "tag tag--draft" : "tag"}>{t.status[o.status]}</span>
                </div>
                <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                  {t.receivedLine(formatDate(o.receivedAt, language), t.channels[o.channel])}
                  {" · "}{t.recordedLine(o.recordedBy, formatDate(o.recordedAt, language))}
                </div>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{o.text}</p>

                {o.status === "pending" ? (
                  <form action={decideObjectionAction} style={{ display: "grid", gap: 10, marginTop: 4 }}>
                    <input type="hidden" name="id" value={o.id} />
                    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
                      <legend className="field-label">{t.decideHeading}</legend>
                      <label style={{ display: "flex", gap: 8 }}>
                        <input type="radio" name="decision" value="rejected" required /> {t.rejected}
                      </label>
                      <label style={{ display: "flex", gap: 8 }}>
                        <input type="radio" name="decision" value="upheld" /> {t.upheld}
                      </label>
                      <span className="quiet field-hint">{t.upheldWarning}</span>
                    </fieldset>
                    <label className="field">
                      <span className="field-label">{t.decisionNote}</span>
                      <textarea className="field-input" name="note" rows={3} required />
                    </label>
                    <div><button className="button" type="submit">{t.decideSubmit}</button></div>
                  </form>
                ) : (
                  <div style={{ fontSize: "var(--fs-small)", display: "grid", gap: 4 }}>
                    {o.decisionNote && <div style={{ whiteSpace: "pre-wrap" }}>{o.decisionNote}</div>}
                    <div className="quiet">
                      {o.decidedBy && o.decidedAt && t.decidedLine(o.decidedBy, formatDate(o.decidedAt, language))}
                    </div>
                    {o.deleted && (
                      <div className="quiet">{t.deletedLine(o.deleted.acknowledgements ?? 0, o.deleted.unknownBasis ?? 0)}</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <form action={recordObjectionAction} className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
            <h3 style={{ fontSize: "var(--fs-body)", margin: 0 }}>{t.recordHeading}</h3>
            <label className="field">
              <span className="field-label">{t.personEmail}</span>
              <input className="field-input" type="email" name="email" required autoCapitalize="none" autoCorrect="off" />
              <span className="quiet field-hint">{t.personEmailNote}</span>
            </label>
            <div className="upload-grid">
              <label className="field">
                <span className="field-label">{t.receivedAt}</span>
                <input className="field-input" type="date" name="receivedAt" required max={todayIso} defaultValue={todayIso} />
              </label>
              <label className="field">
                <span className="field-label">{t.channel}</span>
                <select className="field-input" name="channel" defaultValue="email">
                  {OBJECTION_CHANNELS.map(c => <option key={c} value={c}>{t.channels[c]}</option>)}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="field-label">{t.objectionText}</span>
              <textarea className="field-input" name="text" rows={4} required />
              <span className="quiet field-hint">{t.objectionTextNote}</span>
            </label>
            <div><button className="button button--quiet" type="submit">{t.recordSubmit}</button></div>
          </form>
        </section>
      </div>
    </AppShell>
  )
}
