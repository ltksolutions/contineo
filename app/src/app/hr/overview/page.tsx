/**
 * Výkaz potvrdení pre HR (D33).
 *
 * Tri pohľady na tie isté údaje — podľa dokumentu, osoby a trasy. Prepínajú
 * sa parametrom v adrese, nie stavom v prehliadači: výkaz je vec, na ktorú
 * sa posiela odkaz („pozri sa na toto"), a odkaz musí niesť aj pohľad.
 *
 * Zoradenie je **podľa toho, koľko chýba**, nie podľa abecedy. Zoznam, kde
 * je hore to, s čím sa dá niečo spraviť, ušetrí HR listovanie; zoznam podľa
 * abecedy ho nechá hľadať.
 *
 * Čas čítania sa ukazuje aj pri jednotlivých ľuďoch (rozhodnuté 2026-09-06).
 * Zoradiť sa podľa neho **nedá** a je to zámer: rebríček z merania, ktoré
 * nemá mať následok, by následok vyrobil.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { hrContext } from "@/lib/hr"
import { duties, byDocument, byPerson, byTrack, type Duty, type Summary } from "@/lib/hrReport"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import type { UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

type View = "document" | "person" | "track"

const VIEWS: View[] = ["document", "person", "track"]

function isView(value: string | undefined): value is View {
  return VIEWS.includes(value as View)
}

/** Sekundy na niečo, čo sa dá prečítať očami. */
function readingLabel(seconds: number | null, language: UiLanguage): string {
  const t = dictionary(language).onboarding
  if (seconds === null) return dictionary(language).hr.report.noReading
  return seconds < 60 ? t.readingSeconds(seconds) : t.readingMinutes(Math.round(seconds / 60))
}

export default async function HrReportPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const ctx = await hrContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const q = normalizeQuery<{ view?: string; open?: string }>(await searchParams)
  const view: View = isView(q.view) ? q.view : "document"
  const opened = q.open

  const language = ctx.person.language
  const t = dictionary(language).hr.report
  const branding = brandingView(ctx.tenant)

  const rows = await duties(ctx.person.companyCode)
  const summaries: Summary[] =
    view === "person" ? byPerson(rows)
    : view === "track" ? byTrack(rows)
    : byDocument(rows)

  /** Riadky rozpísanej položky. Kľúč sa líši podľa pohľadu. */
  const detailOf = (key: string): Duty[] => {
    if (view === "person") return rows.filter(d => d.personId === key)
    if (view === "track") return rows.filter(d => d.trackTitles.includes(key))
    return rows.filter(d => d.versionId === key)
  }

  const link = (change: { view?: View; open?: string | null }) => {
    const p = new URLSearchParams()
    const nextView = change.view ?? view
    if (nextView !== "document") p.set("view", nextView)
    const nextOpen = change.open === undefined ? opened : change.open
    if (nextOpen) p.set("open", nextOpen)
    const s = p.toString()
    return s ? `/hr/overview?${s}` : "/hr/overview"
  }

  return (
    <div className="obal" style={{ padding: "28px 20px 80px", maxWidth: 900, ...tenantStyle(branding) }}>
      <p style={{ margin: "0 0 16px" }}>
        <Link className="tichy" href="/hr" style={{ fontSize: 14 }}>
          {dictionary(language).hr.detail.back}
        </Link>
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
        <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0, flex: "1 1 auto" }}>{t.heading}</h1>
        {rows.length > 0 && (
          <a className="tlacidlo tlacidlo--tiche" href={`/hr/overview/csv?view=${view}`}>{t.export}</a>
        )}
      </div>
      <p className="tichy" style={{ fontSize: 15, margin: "0 0 20px", maxWidth: 660 }}>{t.intro}</p>

      {/* Pohľady. Odkazy, nie tlačidlá — musia sa dať poslať aj otvoriť na novej karte. */}
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 24px" }}>
        {VIEWS.map(v => (
          <Link
            key={v}
            href={link({ view: v, open: null })}
            className={v === view ? "tlacidlo" : "tlacidlo tlacidlo--tiche"}
          >
            {t.views[v]}
          </Link>
        ))}
      </nav>

      {summaries.length === 0 && <p className="karta" style={{ padding: 20 }}>{t.empty}</p>}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {summaries.map(s => {
          const missing = s.total - s.done
          const isOpen = opened === s.key
          return (
            <li key={s.key} className="karta" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 16, flex: "1 1 260px" }}>{s.label}</strong>
                <span className="tichy" style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                  {t.done(s.done, s.total)}
                </span>
                <span
                  className="stitok"
                  style={missing === 0
                    ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
                    : { background: "var(--warn-bg)", color: "var(--warn-fg)" }}
                >
                  {missing === 0 ? t.complete : t.missing(missing)}
                </span>
              </div>

              <p className="tichy" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
                {s.detail && <>{s.detail} · </>}
                {t.medianReading}: {readingLabel(s.medianSeconds, language)}
              </p>

              <p style={{ margin: "12px 0 0" }}>
                <Link className="tlacidlo tlacidlo--tiche" href={link({ open: isOpen ? null : s.key })}>
                  {t.open}
                </Link>
              </p>

              {isOpen && (
                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 8 }}>
                  {detailOf(s.key).map(d => (
                    <li
                      key={`${d.personId}-${d.versionId}`}
                      style={{
                        display: "flex", gap: 12, flexWrap: "wrap", alignItems: "baseline",
                        paddingTop: 8, borderTop: "1px solid var(--line)", fontSize: 14,
                      }}
                    >
                      <span style={{ flex: "1 1 200px" }}>
                        {view === "person" ? d.documentTitle : d.fullName}
                      </span>
                      <span className="tichy" style={{ fontSize: 13 }}>
                        {d.acknowledgedAt
                          ? `${t.acknowledgedAt} ${formatDate(d.acknowledgedAt, language)}`
                          : t.notAcknowledged}
                      </span>
                      <span className="tichy" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                        {t.readingTime} {readingLabel(d.readingSeconds, language)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      {rows.length > 0 && (
        <p className="tichy" style={{ fontSize: 13, margin: "28px 0 0", maxWidth: 620 }}>
          {t.readingNote}
        </p>
      )}
    </div>
  )
}
