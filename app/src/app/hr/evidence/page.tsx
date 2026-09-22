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
import LiveFilter from "@/components/LiveFilter"
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { evidenceRows } from "@/lib/evidenceDb"
import type { EvidenceState } from "@/lib/evidence"
import { dutyState, dutyTagClass } from "@/lib/due"

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
  const tds = dictionary(language).hr.dutyState
  const branding = brandingView(ctx.tenant)
  const now = new Date()

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
        <div className="page-head">
          <h1 className="page-title" style={{ margin: 0 }}>{t.heading}</h1>
          <span className="quiet library-count">{t.shown(rows.length, all.length)}</span>
          <Link className="button button--quiet" href={`/hr/evidence/csv?${csv.toString()}`}>
            {t.exportCsv}
          </Link>
        </div>
        <p className="quiet page-lead" style={{ margin: "0 0 6px" }}>{t.intro}</p>
        {/*
          Chýbajúci riadok o upozorneniach sa **pomenuje na obrazovke**, nie
          len v komentári v kóde. Kto os číta ako dôkaz, musí vedieť, čo v nej
          nie je — a prečo.
        */}
        <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "0 0 20px", maxWidth: 640 }}>
          {t.notifiedMissing}
        </p>

        {/*
          Filter zaberie sám, hneď ako človek prestane písať (`LiveFilter`).
          Formulár, `action` aj tlačidlo zostávajú — bez JavaScriptu funguje
          pôvodná cesta. Výber stavu sa neodkladá, ten je jedno rozhodnutie.
        */}
        <LiveFilter className="evidence-filters card" action="/hr/evidence" label={t.heading}>
          <label className="field">
            <span className="field-label">{t.filterPerson}</span>
            <input className="field-input" name="person" defaultValue={q.person ?? ""} />
          </label>
          <label className="field">
            <span className="field-label">{t.filterState}</span>
            {/*
              Obyčajný `<select>`, nie vlastný komponent: formulár musí bežať
              bez JavaScriptu a tri hodnoty sa doňho zmestia bez pomoci.
              Výšku aj šípku mu dáva `select.field-input` v `globals.css`,
              takže vedľa poľa a tlačidla nevytŕča.
            */}
            <select className="field-input" name="state" defaultValue={wantedState ?? ""}>
              <option value="">{t.filterAll}</option>
              {STATES.map(s => <option key={s} value={s}>{t.states[s]}</option>)}
            </select>
          </label>
          <div><button className="button" type="submit">{t.apply}</button></div>
        </LiveFilter>

        {/* Dva prázdne stavy (HR.md, úloha 6): filter, ktorému nič nevyhovuje,
            nie je to isté ako organizácia bez jediného záznamu. */}
        {rows.length === 0 && (
          <div className="empty" style={{ marginTop: 18 }}>
            <div className="empty-title">{all.length > 0 ? t.emptyFilterTitle : t.emptyTitle}</div>
            <div className="empty-text">{all.length > 0 ? t.emptyFilterText : t.emptyText}</div>
          </div>
        )}

        {/*
          Rozbaľovacie karty, nie rozvinuté osi pod sebou.
          Sedem povinností znamenalo sedem osí po štyroch krokoch — takmer
          tridsať riadkov, z ktorých človek hľadá jeden. Zložené je vidieť
          práve to, čo pri prehľade rozhoduje (kto, stav, ktoré znenie);
          os sa otvorí tam, kde ju niekto chce čítať.

          Natívne `<details>` zámerne: rozbalenie funguje bez JavaScriptu,
          ovláda sa klávesnicou a prehliadač ho vie nájsť vyhľadávaním
          v stránke aj v zloženom stave.
        */}
        <ul className="widget-list">
          {rows.map(r => {
            // Odvolanie je záznam, ktorý výkaz nevidí (platí len „nepotvrdené");
            // pilulka ho má povedať — preto ide do `dutyState()` ako `revokedAt`.
            const duty = { ...r.duty, revokedAt: r.revocation?.revokedAt ?? null }
            const state = dutyState(duty, now)
            // Dátum do `<summary>` (HR.md, úloha 5): to, čo kontrolór hľadá,
            // je vidieť bez rozbalenia. Kedy potvrdil; pri odvolaní kedy
            // odvolané; inak kedy otvoril — alebo že vôbec nie.
            const when =
              state === "acknowledged" && r.duty.acknowledgedAt ? formatDate(r.duty.acknowledgedAt, language)
              : state === "revoked" && r.revocation ? formatDate(r.revocation.revokedAt, language)
              : r.firstOpenedAt ? formatDate(r.firstOpenedAt, language)
              : tds["not-opened"]
            return (
            <li key={`${r.duty.personId}-${r.duty.versionId}`}>
              <details className="widget card">
                <summary className="widget-summary">
                  <span className="widget-main">
                    <span className="widget-title">{r.duty.fullName}</span>
                    {/* Jedna škála pre celú rolu (HR.md, úloha 1): stav aj
                        farbu dáva `dutyState()`, nie vlastné triedy. Filter
                        ostáva na troch stavoch osi — „po termíne" je nad nimi. */}
                    <span className={dutyTagClass(duty, now)}>{tds[state]}</span>
                    <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{when}</span>
                  </span>
                  <span className="quiet widget-meta">
                    {r.duty.documentTitle} · {r.duty.versionLabel}
                    {r.duty.due && ` · ${formatDate(r.duty.due, language)}`}
                  </span>
                  <svg className="widget-chevron" width="14" height="14" viewBox="0 0 12 12"
                       fill="none" stroke="currentColor" strokeWidth="1.6"
                       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2.5 4.5L6 8l3.5-3.5" />
                  </svg>
                </summary>
                <div className="widget-body">
                  {/*
                    Údaje dôkazu (D24, D28) ako dvojice kľúč/hodnota — ten
                    istý `<dl class="detail-meta">` ako bočný panel detailu
                    dokumentu, žiadne nové triedy (HR.md, úloha 5). Nič sa
                    nezmenšuje: os s váhou riadkov ostáva pod nimi.
                  */}
                  <dl className="detail-meta" style={{ margin: "12px 0 14px" }}>
                    <div className="detail-meta-row">
                      <dt className="quiet detail-meta-key">{t.rows.ip}</dt>
                      <dd className="detail-meta-value">{r.acknowledgement?.ip ?? t.none}</dd>
                    </div>
                    <div className="detail-meta-row">
                      <dt className="quiet detail-meta-key">{t.rows.department}</dt>
                      <dd className="detail-meta-value">
                        {r.acknowledgement?.departmentNames.length ? r.acknowledgement.departmentNames.join(" / ") : t.none}
                      </dd>
                    </div>
                    <div className="detail-meta-row">
                      <dt className="quiet detail-meta-key">{t.rows.statement}</dt>
                      <dd className="detail-meta-value">{r.acknowledgement?.statementText || t.none}</dd>
                    </div>
                    <div className="detail-meta-row">
                      <dt className="quiet detail-meta-key">{t.rows.reading}</dt>
                      <dd className="detail-meta-value">
                        {r.duty.readingSeconds !== null ? t.seconds(r.duty.readingSeconds) : t.none}
                      </dd>
                    </div>
                    <div className="detail-meta-row">
                      <dt className="quiet detail-meta-key">{t.rows.opened}</dt>
                      <dd className="detail-meta-value">
                        {r.firstOpenedAt ? formatDate(r.firstOpenedAt, language) : t.gap["not-yet"]}
                      </dd>
                    </div>
                    {r.revocation && (
                      <>
                        <div className="detail-meta-row">
                          <dt className="quiet detail-meta-key">{t.rows.revokedBy}</dt>
                          <dd className="detail-meta-value">
                            {r.revocation.by ?? t.none} · {formatDate(r.revocation.revokedAt, language)}
                          </dd>
                        </div>
                        <div className="detail-meta-row">
                          <dt className="quiet detail-meta-key">{t.rows.revokeReason}</dt>
                          <dd className="detail-meta-value">{r.revocation.reason ?? t.none}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  <EvidenceTimeline timeline={r.timeline} language={language} />
                </div>
              </details>
            </li>
            )
          })}
        </ul>
      </div>
    </AppShell>
  )
}
