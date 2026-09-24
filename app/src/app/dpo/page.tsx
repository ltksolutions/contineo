/**
 * /dpo — ochrana údajov pre zodpovednú osobu (ADR-012, D104, D105).
 *
 * Výkaz právnych základov platných predpisov: čo platí, kto zaň zodpovedá
 * a čo chýba. DPO základ **kontroluje, neurčuje** (O15/A10) — stránka preto
 * nič nemení a pri nedostatku ukazuje, na koho sa obrátiť.
 *
 * Podoba podľa rámu `docs/design/DPO-ochrana-udajov.md` (24. 9. 2026):
 * dlaždice s počtami, tabuľka od 1024 px, skupiny podľa nedostatkov.
 * V karte ostáva „Zodpovedná osoba", nie „Garant" (Ján 24. 9.).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { dpoContext, summarize, type LegalBasisRow } from "@/lib/dpo"
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
  const objections = await listObjections(ctx.person.companyCode)
  const withProblems = rows.filter(r => r.problems.length > 0).length
  // Tie isté čísla ako v štvrťročnom e-maile (`dpoEmail`) — jedna funkcia.
  const totals = summarize(rows)
  const groups: [string, LegalBasisRow[]][] = [
    [t.groupProblems(withProblems), rows.filter(r => r.problems.length > 0)],
    [t.groupOk(rows.length - withProblems), rows.filter(r => r.problems.length === 0)],
  ].filter(([, list]) => (list as LegalBasisRow[]).length > 0) as [string, LegalBasisRow[]][]
  const pending = objections.filter(o => o.status === "pending").length
  const basisOf = (r: LegalBasisRow) => r.legalBasis ? (r.basisLabel ?? tr.basisLabel[r.legalBasis]) : t.none
  const statusOf = (r: LegalBasisRow) => r.problems.length === 0
    ? <span className="tag">{t.ok}</span>
    : r.problems.map(p => <span key={p} className="tag tag--draft">{t.problems[p]}</span>)
  const versionOf = (r: LegalBasisRow) =>
    `${r.versionLabel}${r.effectiveFrom ? ` · ${formatDate(r.effectiveFrom, language)}` : ""}`
  const responsibleOf = (r: LegalBasisRow) => r.responsible
    ? <><span>{r.responsible.fullName}</span> <a className="quiet dpo-mail" href={`mailto:${r.responsible.email}`}>{r.responsible.email}</a></>
    : t.none
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div className="dpo" style={tenantStyle(branding)}>
        <h1 className="page-title">{t.heading}</h1>
        <p className="quiet page-lead" style={{ margin: "0 0 20px", maxWidth: 640 }}>{t.intro}</p>
        <Notice message={q.msg} error={q.error === "1"} back="/dpo" />

        {/* Počty ako dlaždice (rám, bod 1) — `summarize()`, ako v e-maile. */}
        {rows.length > 0 && (
          <div className="dpo-tiles">
            {([
              [t.tileTotal, totals.total, ""],
              [t.tileProblems, totals.withProblems, totals.withProblems > 0 ? " is-warn" : ""],
              [t.tileObligation, totals.legalObligation, ""],
              [t.tileInterest, totals.legitimateInterest, ""],
            ] as [string, number, string][]).map(([label, value, mod]) => (
              <div key={label} className="card dpo-tile">
                <span className="dpo-tile-l">{label}</span>
                <span className={`dpo-tile-v${mod}`}>{value}</span>
              </div>
            ))}
          </div>
        )}

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

          {/*
            Tabuľka od 1024 px, pod tým karty (rám, body 2 a 4): na telefóne
            sa štyri stĺpce nezmestia a DPO výkaz otvorí aj z e-mailu v mobile.
            Obe podoby sú v HTML, prepína ich CSS — bez JavaScriptu.
          */}
          {rows.length > 0 && (
            <div className="dpo-table-wrap">
              <table className="dpo-table">
                <thead>
                  <tr><th>{t.colDocument}</th><th>{t.basis}</th><th>{t.responsible}</th><th>{t.colStatus}</th></tr>
                </thead>
                <tbody>
                  {groups.map(([label, list]) => [
                    <tr key={label} className="dpo-group"><td colSpan={4}>{label}</td></tr>,
                    ...list.map(r => (
                      <tr key={`${r.documentId}|${r.versionId}`}>
                        <td>
                          <Link href={`/documents/${encodeURIComponent(r.documentId)}`} className="dpo-doc">{r.title}</Link>
                          <div className="quiet dpo-sub">{t.version}: {versionOf(r)}</div>
                        </td>
                        <td>
                          {basisOf(r)}
                          {r.reference && <div className="quiet dpo-sub">{t.reference}: {r.reference}</div>}
                        </td>
                        <td className="dpo-person">{responsibleOf(r)}</td>
                        <td><div className="dpo-tags">{statusOf(r)}</div></td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          )}

          <div className="dpo-cards">
            {groups.map(([label, list]) => (
              <div key={label} style={{ display: "grid", gap: 10 }}>
                <h3 className="dpo-group-h">{label}</h3>
                <ul className="widget-list">
                  {list.map(r => (
                    <li key={`${r.documentId}|${r.versionId}`} className="card dpo-card">
                      <div className="dpo-card-top">
                        <Link href={`/documents/${encodeURIComponent(r.documentId)}`} className="dpo-doc">{r.title}</Link>
                        <div className="dpo-tags">{statusOf(r)}</div>
                      </div>
                      <dl className="dpo-dl">
                        <div><dt>{t.version}</dt><dd>{versionOf(r)}</dd></div>
                        <div>
                          <dt>{t.basis}</dt>
                          <dd>{basisOf(r)}{r.reference && <> · {r.reference}</>}</dd>
                        </div>
                        <div><dt>{t.responsible}</dt><dd className="dpo-person">{responsibleOf(r)}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/*
          Námietky (ADR-012, D105). Zápis a rozhodnutie sú dva formuláre:
          námietka prichádza a vybavuje sa v inom čase a do rozhodnutia sa
          nesmie nič zmazať.
        */}
        <section id="objections" style={{ display: "grid", gap: 12, marginTop: 32 }}>
          <div className="page-head">
            <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.objectionsHeading}</h2>
            {pending > 0 && <span className="tag tag--draft">{t.pendingCount(pending)}</span>}
          </div>
          <p className="quiet" style={{ margin: 0, maxWidth: 640, fontSize: "var(--fs-body)" }}>{t.objectionsIntro}</p>

          {objections.length === 0 && (
            <div className="empty"><div className="empty-text">{t.noObjections}</div></div>
          )}
          <ul className="widget-list">
            {objections.map(o => (
              <li key={o.id} className="card dpo-obj">
                <div className="dpo-obj-head">
                  <div className="dpo-card-top">
                    <strong>{o.personName}</strong>
                    <span className={o.status === "pending" ? "tag tag--draft" : "tag"}>{t.status[o.status]}</span>
                  </div>
                  <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                    {t.receivedLine(formatDate(o.receivedAt, language), t.channels[o.channel])}
                    {" · "}{t.recordedLine(o.recordedBy, formatDate(o.recordedAt, language))}
                  </div>
                  <p className="dpo-obj-text">{o.text}</p>
                </div>

                {o.status === "pending" ? (
                  <form action={decideObjectionAction} className="dpo-obj-decide">
                    <input type="hidden" name="id" value={o.id} />
                    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 6 }}>
                      <legend className="field-label">{t.decideHeading}</legend>
                      {/* Voľby ako dlaždice; „Vyhovieť" pri výbere červené —
                          maže doklady natrvalo, hneď po odoslaní (D105). */}
                      <label className="hr-choice hr-choice--tile">
                        <input type="radio" name="decision" value="rejected" required /> {t.rejected}
                      </label>
                      <label className="hr-choice hr-choice--tile dpo-choice--danger">
                        <input type="radio" name="decision" value="upheld" /> {t.upheld}
                      </label>
                      <p className="dpo-warn">{t.upheldWarning}</p>
                    </fieldset>
                    <label className="field">
                      <span className="field-label">{t.decisionNote}</span>
                      <textarea className="field-input" name="note" rows={3} required />
                    </label>
                    <div><button className="button" type="submit">{t.decideSubmit}</button></div>
                  </form>
                ) : (
                  <div className="dpo-obj-done">
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

          {/*
            Zaevidovanie je zbalené (rám, bod 7; Ján 24. 9.): námietka príde
            zriedka. Po chybe sa otvorí, nech sa dá opraviť bez hľadania.
          */}
          <details className="dpo-record" open={q.error === "1"}>
            <summary className="button button--quiet">{t.recordOpen}</summary>
          <form action={recordObjectionAction} className="card" style={{ padding: 20, display: "grid", gap: 12, marginTop: 10 }}>
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
          </details>
        </section>
      </div>
    </AppShell>
  )
}
