/**
 * HR prehľad — čo je v organizácii nevybavené (D33).
 *
 * Opak widgetu na úvodnej strane: ten ukazuje „čo čaká na mňa", tento „ako je
 * na tom organizácia". Preto je za inou rolou (D36) a na doméne, ktorá tejto
 * organizácii patrí (D29, D32).
 *
 * Čísla sa **počítajú pri zobrazení**. Uložený súčet je druhá kópia pravdy
 * a rozíde sa s ňou práve vtedy, keď na nej niekomu záleží (D27).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext } from "@/lib/hr"
import { assignmentOverviews, audienceLabel } from "@/lib/assignments"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import Notice from "@/components/Notice"
import AckBar from "@/components/AckBar"
import { revokeAction } from "./actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"

export const dynamic = "force-dynamic"

export default async function HrOverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const overview = await assignmentOverviews(ctx.person.companyCode)
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).hr.overview
  const tl = dictionary(language).library

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 860, ...tenantStyle(branding) }}>
      <h1 className="page-title">
        {t.heading}
      </h1>
      <p className="quiet page-lead" style={{ maxWidth: 620 }}>
        {t.intro} <em>dnes</em>.
      </p>

      <Notice message={message} error={error === "1"} back="/hr" />

      <p style={{ margin: "0 0 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="button" href="/hr/assign">{t.assign}</Link>
        <Link className="button button--quiet" href="/hr/overview">
          {dictionary(language).hr.report.heading}
        </Link>
        <Link className="button button--quiet" href="/hr/reminders">
          {dictionary(language).hr.reminders.heading}
        </Link>
      </p>

      {overview.length === 0 ? (
        /* `.empty` zo ZAKLADU (HR.md, úloha 6). Bez tlačidla — „Prideliť
           normu" je hneď nad tým. */
        <div className="empty">
          <div className="empty-title">{t.emptyTitle}</div>
          <div className="empty-text">{t.emptyText}</div>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          {overview.map(p => {
            const error = p.count - p.acknowledged
            return (
              <li key={p.id} className="card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link
                    href={`/hr/${encodeURIComponent(p.id)}`}
                    style={{ fontSize: "var(--fs-section)", fontWeight: 700, textDecoration: "none" }}
                  >
                    {p.subject.documentTitle}
                  </Link>
                  <span className="tag">verzia {p.subject.versionLabel}</span>
                </div>

                <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "8px 0 0" }}>
                  {audienceLabel(p.audience)} · pridelil {p.assignedBy} ·{" "}
                  {formatDate(p.assignedAt, language)}
                </p>

                {/* Dôvod je to, čím sa uzatvára D30 — nie ozdoba, ale jediné
                    miesto, kde je napísané, prečo sa norma potvrdzuje znova. */}
                <p style={{ fontSize: "var(--fs-body)", margin: "10px 0 0", lineHeight: 1.55 }}>
                  {p.reason}
                </p>

                {/* Ten istý pásik ako v knižnici (HR.md, úloha 2): pri desiatich
                    prideleniach sa zaostávajúce nájde pohľadom, nie čítaním
                    tridsiatich čísel. Čísla zostávajú pod ním. */}
                <div className="hr-ack">
                  <AckBar
                    acknowledged={p.acknowledged}
                    assigned={p.count}
                    label={tl.list.acknowledgedOf(p.acknowledged, p.count)}
                  />
                </div>

                <div className="admin-data">
                  <div>
                    <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{t.acknowledged}</div>
                    <div style={{ fontSize: "var(--fs-lead)", fontWeight: 600 }}>
                      {p.acknowledged} / {p.count}
                    </div>
                  </div>
                  <div>
                    <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{t.notified}</div>
                    <div style={{ fontSize: "var(--fs-lead)", fontWeight: 600, color: p.lastNotified ? undefined : "var(--muted)" }}>
                      {p.lastNotified
                        ? `${formatDate(p.lastNotified.at, language)}${p.notifiedTotal > 1 ? ` · ${p.notifiedTotal}×` : ""}`
                        : t.no}
                    </div>
                  </div>
                  <div>
                    <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{t.missing}</div>
                    <div
                      style={{
                        fontSize: "var(--fs-lead)",
                        fontWeight: 600,
                        color: error > 0 ? "var(--warn-fg)" : "var(--muted)",
                      }}
                    >
                      {error === 0 ? t.nobody : `${error}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  {/* Dať vedieť je samostatné rozhodnutie, nie vedľajší účinok
                      pridelenia — preto odkaz na náhľad, nie tlačidlo „poslať". */}
                  {error > 0 && (
                    <Link className="button button--quiet" href={`/hr/${encodeURIComponent(p.id)}/notify`}>
                      {t.notifyByEmail}
                    </Link>
                  )}
                  <form action={revokeAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="button button--quiet" type="submit">
                      {t.revoke}
                    </button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
    </AppShell>
  )
}
