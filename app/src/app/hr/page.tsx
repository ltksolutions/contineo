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
import { revokeAction } from "./actions"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function HrOverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/prihlasenie")
    notFound()
  }

  const { msg: message, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const overview = await assignmentOverviews(ctx.person.companyCode)
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).hr.overview

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 860, ...tenantStyle(branding) }}>
      <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
        {t.heading}
      </h1>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 18px", maxWidth: 620 }}>
        {t.intro} <em>dnes</em>.
      </p>

      <Notice message={message} error={error === "1"} back="/hr" />

      <p style={{ margin: "0 0 24px" }}>
        <Link className="tlacidlo" href="/hr/pridelit">{t.assign}</Link>
      </p>

      {overview.length === 0 ? (
        <p className="karta" style={{ padding: 20, fontSize: 15 }}>
          {t.empty}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
          {overview.map(p => {
            const error = p.count - p.acknowledged
            return (
              <li key={p.id} className="karta" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link
                    href={`/hr/${encodeURIComponent(p.id)}`}
                    style={{ fontSize: 16.5, fontWeight: 700, textDecoration: "none" }}
                  >
                    {p.subject.documentTitle}
                  </Link>
                  <span className="stitok">verzia {p.subject.versionLabel}</span>
                </div>

                <p className="tichy" style={{ fontSize: 13.5, margin: "8px 0 0" }}>
                  {audienceLabel(p.audience)} · pridelil {p.assignedBy} ·{" "}
                  {formatDate(p.assignedAt, language)}
                </p>

                {/* Dôvod je to, čím sa uzatvára D30 — nie ozdoba, ale jediné
                    miesto, kde je napísané, prečo sa norma potvrdzuje znova. */}
                <p style={{ fontSize: 14.5, margin: "10px 0 0", lineHeight: 1.55 }}>
                  {p.reason}
                </p>

                <div className="admin-udaje">
                  <div>
                    <div className="tichy" style={{ fontSize: 12.5 }}>{t.acknowledged}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600 }}>
                      {p.acknowledged} / {p.count}
                    </div>
                  </div>
                  <div>
                    <div className="tichy" style={{ fontSize: 12.5 }}>{t.notified}</div>
                    <div style={{ fontSize: 15.5, fontWeight: 600, color: p.lastNotified ? undefined : "var(--muted)" }}>
                      {p.lastNotified
                        ? `${formatDate(p.lastNotified.at, language)}${p.notifiedTotal > 1 ? ` · ${p.notifiedTotal}×` : ""}`
                        : t.no}
                    </div>
                  </div>
                  <div>
                    <div className="tichy" style={{ fontSize: 12.5 }}>{t.missing}</div>
                    <div
                      style={{
                        fontSize: 15.5,
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
                    <Link className="tlacidlo tlacidlo--tiche" href={`/hr/${encodeURIComponent(p.id)}/oznamit`}>
                      {t.notifyByEmail}
                    </Link>
                  )}
                  <form action={revokeAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="tlacidlo tlacidlo--tiche" type="submit">
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
  )
}
