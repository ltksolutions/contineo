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
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import AppShell from "@/components/AppShell"
import HrTabs from "@/components/HrTabs"
import { allTracks } from "@/lib/tracks"
import { duties, trackStatuses } from "@/lib/hrReport"
import { listPeople } from "@/lib/people"

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
  const [overview, tracks, rows, people] = await Promise.all([
    assignmentOverviews(ctx.person.companyCode),
    allTracks(ctx.person.companyCode),
    duties(ctx.person.companyCode),
    listPeople(ctx.person.companyCode),
  ])
  /*
    Trasy (2. 10. 2026): povinnosť z trasy nevzniká pridelením, takže v zozname
    pridelení nebola — kto pridal oddelenie na trasu, nevidel tu nič. Karta
    za každú zapnutú trasu s ľuďmi, stav z tých istých riadkov ako výkaz.
  */
  const statuses = trackStatuses(rows)
  const trackCards = tracks
    .filter(tr => tr.isActive)
    .map(tr => ({
      track: tr,
      people: people.filter(p => p.status !== "inactive" && p.tracks.includes(tr.key)).length,
      documents: tr.steps.filter(s => s.type === "document" && s.requiresAcknowledgement && s.documentId).length,
      status: statuses.get(tr.title) ?? { total: 0, done: 0, perPerson: new Map() },
    }))
    .filter(c => c.people > 0)
  const branding = brandingView(ctx.tenant)
  const language = ctx.person.language
  const t = dictionary(language).hr.overview
  const tl = dictionary(language).library

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 860, ...tenantStyle(branding) }}>
      {/*
        Nadpis sekcie, podmenu a jediná akcia vpravo (ZAKLAD-podmenu-a-akcie,
        2. 10. 2026). Dovtedy rad tlačidiel, v ktorom „Prideliť dokument"
        (akcia) stálo plné vedľa tichých odkazov na podstránky a vyzeralo
        ako vybraná položka.
      */}
      <div className="page-head">
        <h1 className="page-title">{dictionary(language).nav.assigned}</h1>
        <span className="page-head-spacer" aria-hidden="true" />
        <Link className="button" href="/hr/assign">{t.assign}</Link>
      </div>
      <HrTabs current="/hr" person={ctx.person} language={language} />
      <p className="quiet page-lead" style={{ maxWidth: 620 }}>
        {t.intro} <em>{t.today}</em>.
      </p>

      <Notice language={language} message={message} error={error === "1"} back="/hr" />

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
                    style={{ fontSize: "var(--fs-section)", fontWeight: 700 }}
                  >
                    {p.subject.documentTitle}
                  </Link>
                  <span className="tag">{t.versionTag(p.subject.versionLabel)}</span>
                </div>

                <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "8px 0 0" }}>
                  {audienceLabel(p.audience)} · {t.assignedBy(p.assignedBy)} ·{" "}
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
                  {/* Odkaz na potvrdenie, nie tlačidlo, ktoré hneď odvolá: po
                      odvolaní sa karty posunú a druhé kliknutie trafilo iné
                      pridelenie (30. 9. 2026). */}
                  <Link className="button button--quiet" href={`/hr/${encodeURIComponent(p.id)}/revoke`}>
                    {t.revoke}
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {trackCards.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: "var(--fs-section)", margin: "0 0 4px" }}>{t.tracks}</h2>
          <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 14px" }}>{t.tracksNote}</p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 14 }}>
            {trackCards.map(({ track: tr, people: n, documents, status }) => {
              const missing = status.total - status.done
              const href = `/hr/tracks/${encodeURIComponent(tr.key)}`
              return (
                <li key={tr.key} className="card" style={{ padding: "18px 20px" }}>
                  <Link href={href} style={{ fontSize: "var(--fs-section)", fontWeight: 700 }}>{tr.title}</Link>
                  <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "8px 0 0" }}>{t.trackLine(n, documents)}</p>
                  <div className="hr-ack">
                    <AckBar acknowledged={status.done} assigned={status.total}
                            label={tl.list.acknowledgedOf(status.done, status.total)} />
                  </div>
                  <div className="admin-data">
                    <div>
                      <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{t.acknowledged}</div>
                      <div style={{ fontSize: "var(--fs-lead)", fontWeight: 600 }}>{status.done} / {status.total}</div>
                    </div>
                    <div>
                      <div className="quiet" style={{ fontSize: "var(--fs-micro)" }}>{t.missing}</div>
                      <div style={{ fontSize: "var(--fs-lead)", fontWeight: 600, color: missing > 0 ? "var(--warn-fg)" : "var(--muted)" }}>
                        {missing === 0 ? t.nobody : `${missing}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                    {missing > 0 && (
                      <Link className="button button--quiet" href={`${href}/notify`}>{t.notifyByEmail}</Link>
                    )}
                    <Link className="button button--quiet" href={href}>{t.openTrack}</Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
    </AppShell>
  )
}
