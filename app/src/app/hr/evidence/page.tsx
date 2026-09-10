/**
 * Reťaz dôkazov naprieč organizáciou (ADR-005, krok 5).
 *
 * **Ten istý komponent a tá istá funkcia ako na karte osoby** (D67). Dva
 * pohľady na to isté, ktoré si každý počíta po svojom, sú dva pohľady, ktoré
 * si raz budú odporovať — a pri dôkaze je to horšie než nemať druhý.
 *
 * Filtre sú **v adrese**, ako v knižnici: pohľad sa dá poslať kolegovi aj
 * s filtrom a funguje bez JavaScriptu.
 *
 * Prístup: personalista vo **vlastnej** organizácii (D32, D33). Nie naprieč
 * tenantmi a nie pre správcu obsahu — je to údaj o ľuďoch, nie o dokumentoch.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { hrContext } from "@/lib/hr"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import EvidenceTimeline from "@/components/EvidenceTimeline"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { evidenceRows } from "@/lib/evidenceDb"
import type { EvidenceState } from "@/lib/evidence"

export const dynamic = "force-dynamic"

const STATES: EvidenceState[] = ["acknowledged", "opened-not-acknowledged", "not-opened"]

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ layout?: string; person?: string; state?: string }>(await searchParams)
  const ctx = await hrContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const language = ctx.person.language
  const t = dictionary(language).evidence
  const branding = brandingView(ctx.tenant)

  const all = await evidenceRows(ctx.person.companyCode)
  const wantedState = STATES.includes(q.state as EvidenceState) ? (q.state as EvidenceState) : null
  const wantedPerson = (q.person ?? "").trim().toLowerCase()

  const rows = all.filter(r =>
    (!wantedState || r.state === wantedState) &&
    (!wantedPerson ||
      r.duty.fullName.toLowerCase().includes(wantedPerson) ||
      r.duty.email.toLowerCase().includes(wantedPerson)),
  )

  /*
    Ľudia sa hľadajú aj podľa adresy, nie len podľa mena: personalista, ktorý
    niekoho hľadá, nevie dopredu, čo si o ňom pamätá. Rovnaké pravidlo ako
    v zozname osôb.
  */
  const csv = new URLSearchParams()
  if (wantedPerson) csv.set("person", wantedPerson)
  if (wantedState) csv.set("state", wantedState)

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div style={{ maxWidth: 900, ...tenantStyle(branding) }}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 6px" }}>
          <h1 style={{ fontSize: 26, letterSpacing: "-0.02em", margin: 0 }}>{t.heading}</h1>
          <span className="quiet library-count">{t.shown(rows.length, all.length)}</span>
          <Link className="button button--quiet" href={`/hr/evidence/csv?${csv.toString()}`}>
            {t.exportCsv}
          </Link>
        </div>
        <p className="quiet" style={{ fontSize: 15, margin: "0 0 6px", maxWidth: 640 }}>{t.intro}</p>
        {/*
          Chýbajúci riadok o upozorneniach sa **pomenuje na obrazovke**, nie
          len v komentári v kóde. Kto os číta ako dôkaz, musí vedieť, čo v nej
          nie je — a prečo.
        */}
        <p className="quiet" style={{ fontSize: 13, margin: "0 0 20px", maxWidth: 640 }}>
          {t.notifiedMissing}
        </p>

        <form className="evidence-filters card" method="get">
          <label className="field">
            <span className="field-label">{t.filterPerson}</span>
            <input className="field-input" name="person" defaultValue={q.person ?? ""} />
          </label>
          <label className="field">
            <span className="field-label">{t.filterState}</span>
            {/*
              Obyčajný `<select>`, nie vlastný komponent: formulár musí bežať
              bez JavaScriptu a tri hodnoty sa doňho zmestia bez pomoci.
            */}
            <select className="field-input" name="state" defaultValue={wantedState ?? ""}>
              <option value="">{t.filterAll}</option>
              {STATES.map(s => <option key={s} value={s}>{t.states[s]}</option>)}
            </select>
          </label>
          <div><button className="button" type="submit">{t.apply}</button></div>
        </form>

        {rows.length === 0 && <p className="card" style={{ padding: 20 }}>{t.nothing}</p>}

        <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "grid", gap: 16 }}>
          {rows.map(r => (
            <li key={`${r.duty.personId}-${r.duty.versionId}`} className="card" style={{ padding: 18 }}>
              <div className="evidence-head">
                <strong>{r.duty.fullName}</strong>
                <span className={`tag evidence-state evidence-state--${r.state}`}>
                  {t.states[r.state]}
                </span>
              </div>
              <div className="quiet" style={{ fontSize: 13.5 }}>
                {r.duty.documentTitle} · {r.duty.versionLabel}
                {r.duty.due && ` · ${formatDate(r.duty.due, language)}`}
              </div>
              <EvidenceTimeline timeline={r.timeline} language={language} />
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  )
}
