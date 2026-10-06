/**
 * /dpo — ochrana údajov pre zodpovednú osobu (ADR-012, D104, D105).
 *
 * Výkaz právnych základov platných predpisov: čo platí, kto zaň zodpovedá
 * a čo chýba. DPO základ **kontroluje, neurčuje** (O15/A10) — stránka preto
 * nič nemení a pri nedostatku ukazuje, na koho sa obrátiť.
 *
 * Podoba podľa rámu `docs/design/DPO-ochrana-udajov.md` (24. 9. 2026):
 * tabuľka od 1024 px, karty pod tým. V karte ostáva „Zodpovedná osoba",
 * nie „Garant" (Ján 24. 9.).
 *
 * **Hľadanie, filtre a zoskupenie** podľa `docs/design/DPO-vykaz-hladanie.md`
 * (Q1–Q5, 1. 10. 2026) — mení bod 1 rámu DPO-ochrana-udajov: dlaždice
 * s počtami sú preč, čísla sú pri filtroch a čakajúca námietka je pás nad
 * výkazom. Bez skriptu: filtre sú odkazy, hľadanie `GET` formulár, stav
 * v adrese. CSV (`/dpo/csv`) je vždy celý výkaz — je to doklad (Q3).
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  dpoContext, dpoFacets, dpoHref, filterLegalBasisRows, groupByPerson, highlight, parseDpoQuery, personMailto,
  type DpoQuery, type LegalBasisRow,
} from "@/lib/dpo"
import { legalBasisRows } from "@/lib/dpoDb"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { listObjections } from "@/lib/objectionsDb"
import { MANUAL_OBJECTION_CHANNELS, type Objection } from "@/lib/objections"
import Notice from "@/components/Notice"
import Icon from "@/components/Icon"
import SearchStrip from "@/components/SearchStrip"
import { tenantOrigin } from "@/lib/certificates"
import { recordObjectionAction, decideObjectionAction } from "./actions"
import SubmitButton from "@/components/SubmitButton"

export const dynamic = "force-dynamic"

export default async function DpoPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{
    msg?: string; error?: string; q?: string; state?: string; basis?: string; person?: string; group?: string
  }>(await searchParams)
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

  const query = parseDpoQuery(q)
  const shown = filterLegalBasisRows(rows, query)
  const facets = dpoFacets(rows, query)
  const filtered = Boolean(query.q || query.state || query.basis || query.person)
  const shownProblems = shown.filter(r => r.problems.length > 0).length
  const origin = tenantOrigin(ctx.tenant.hostnames ?? [])

  const pendingList = objections
    .filter(o => o.status === "pending")
    .sort((a, b) => +new Date(a.receivedAt) - +new Date(b.receivedAt))
  const pending = pendingList.length
  const decided = objections.filter(o => o.status !== "pending")

  const basisOf = (r: LegalBasisRow) => r.legalBasis ? (r.basisLabel ?? tr.basisLabel[r.legalBasis]) : t.none
  const statusOf = (r: LegalBasisRow) => r.problems.length === 0
    ? <span className="tag">{t.ok}</span>
    : r.problems.map(p => <span key={p} className="tag tag--draft">{t.problems[p]}</span>)
  const versionOf = (r: LegalBasisRow) =>
    `${r.versionLabel}${r.effectiveFrom ? ` · ${formatDate(r.effectiveFrom, language)}` : ""}`
  const responsibleOf = (r: LegalBasisRow) => r.responsible
    ? <><span>{r.responsible.fullName}</span> <a className="quiet dpo-mail" href={`mailto:${r.responsible.email}`}>{r.responsible.email}</a></>
    : t.none
  // Zhoda v názve. Kúsky sú text, React ich escapuje — `<mark>` sa nikdy
  // neskladá z reťazca, takže názov predpisu nemôže vložiť značky.
  const titleOf = (r: LegalBasisRow) =>
    highlight(r.title, query.q).map((seg, i) => seg.hit ? <mark key={i}>{seg.text}</mark> : seg.text)
  // Na kartu v správe, nie na čitateľskú stránku: právny základ sa určuje
  // tam (D151) a `/documents/…` je potvrdzovanie (Ján 2. 10. 2026).
  const docLink = (r: LegalBasisRow) =>
    <Link href={`/library/${encodeURIComponent(r.documentId)}`} className="dpo-doc">{titleOf(r)}</Link>
  const todayIso = new Date().toISOString().slice(0, 10)

  /*
   * Skupiny výkazu. Podľa osoby (predvolené, Q2): hlavička s menom, adresou,
   * počtami a e-mailom pre celú skupinu — DPO píše človeku raz, nie pri
   * každom predpise. Podľa stavu: dnešné dve skupiny.
   */
  const byPerson = query.group === "person"
  type Group = { key: string; title: string; meta?: string; mailto?: string | null; bad: number; rows: LegalBasisRow[] }
  const groups: Group[] = byPerson
    ? groupByPerson(shown).map(g => ({
      key: g.person?.email ?? "",
      title: g.person?.fullName ?? t.noPerson,
      meta: [g.person?.email, t.groupPersonMeta(g.rows.length, g.bad)].filter(Boolean).join(" · "),
      mailto: personMailto(g, { subject: t.mailSubject, body: t.mailBody, bodyLink: t.mailBodyLink }, origin),
      bad: g.bad,
      rows: g.rows,
    }))
    : ([
      ["problems", t.groupProblems(shownProblems), shown.filter(r => r.problems.length > 0)],
      ["ok", t.groupOk(shown.length - shownProblems), shown.filter(r => r.problems.length === 0)],
    ] as [string, string, LegalBasisRow[]][])
      .filter(([, , list]) => list.length > 0)
      .map(([key, title, list]) => ({ key, title, bad: 0, rows: list }))
  const colCount = byPerson ? 3 : 4

  const mailButton = (g: Group) => g.mailto
    ? (
      <a className="button button--quiet dpo-button-sm dpo-mail-button" href={g.mailto}>
        <Icon name="mail" size={14} />
        {t.writeEmail(g.bad)}
      </a>
    )
    : null

  /*
   * Námietky (ADR-012, D105). Zápis a rozhodnutie sú dva formuláre:
   * námietka prichádza a vybavuje sa v inom čase a do rozhodnutia sa
   * nesmie nič zmazať.
   */
  const objectionCard = (o: Objection) => (
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
          <div><SubmitButton className="button">{t.decideSubmit}</SubmitButton></div>
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
  )

  /*
   * Filtre: tri skupiny, v každej „Všetky" a hodnoty s počtom. Odkaz zapne
   * hodnotu, druhý klik na zapnutú ju zruší. Ten istý zoznam kreslí stĺpec
   * (od 1024 px) aj pilulky pod poľom (pod 1024 px) — prepína ich CSS.
   */
  type Facet = { label: string; count: number; on: boolean; href: string; warn?: boolean }
  const toggle = <K extends "state" | "basis" | "person">(key: K, value: DpoQuery[K]) =>
    dpoHref(query, { [key]: query[key] === value ? undefined : value } as Partial<DpoQuery>)
  const facetGroups: { key: string; title: string; all: Facet; rows: Facet[] }[] = [
    {
      key: "state", title: t.filterState,
      all: { label: t.filterAll, count: facets.state.all, on: !query.state, href: dpoHref(query, { state: undefined }) },
      rows: [
        { label: t.stateProblems, count: facets.state.problems, on: query.state === "problems", href: toggle("state", "problems"), warn: true },
        { label: t.stateOk, count: facets.state.ok, on: query.state === "ok", href: toggle("state", "ok") },
      ],
    },
    {
      key: "basis", title: t.filterBasis,
      all: { label: t.filterAll, count: facets.basis.all, on: !query.basis, href: dpoHref(query, { basis: undefined }) },
      rows: [
        { label: t.basisObligation, count: facets.basis.legalObligation, on: query.basis === "legalObligation", href: toggle("basis", "legalObligation") },
        { label: t.basisInterest, count: facets.basis.legitimateInterest, on: query.basis === "legitimateInterest", href: toggle("basis", "legitimateInterest") },
        { label: t.basisNone, count: facets.basis.none, on: query.basis === "none", href: toggle("basis", "none"), warn: true },
      ],
    },
    {
      key: "person", title: t.filterPerson,
      all: { label: t.filterAll, count: facets.person.all, on: !query.person, href: dpoHref(query, { person: undefined }) },
      rows: facets.person.people.map(p => ({
        label: p.fullName, count: p.count, on: query.person === p.email, href: toggle("person", p.email),
      })),
    },
  ]
  const facetCount = (f: Facet) =>
    <span className={`facet-count${f.warn && f.count > 0 ? " is-warn" : ""}`}>{f.count}</span>

  // Čipy nasadených filtrov — krížik zruší jeden, „Zrušiť všetko" všetky.
  const chips: { key: string; label: string; href: string }[] = [
    ...(query.q ? [{ key: t.chipSearch, label: query.q, href: dpoHref(query, { q: "" }) }] : []),
    ...facetGroups.flatMap(g => g.rows.filter(f => f.on).map(f => ({ key: g.title.toLowerCase(), label: f.label, href: f.href }))),
  ]
  const clearHref = dpoHref({ q: "", group: query.group })

  return (
    <AppShell language={language}>
      <div className="dpo" style={tenantStyle(branding)}>
        <div className="page-head">
          <div className="dpo-head-text">
            <h1 className="page-title">{t.heading}</h1>
            <p className="quiet page-lead" style={{ margin: 0, maxWidth: 640 }}>{t.intro}</p>
          </div>
          {rows.length > 0 && (
            <Link className="button button--quiet dpo-csv dpo-csv--head" href="/dpo/csv">{t.csv}</Link>
          )}
        </div>
        <Notice message={q.msg} error={q.error === "1"} back="/dpo" />

        {/*
          Čakajúca námietka (D153) je pás nad výkazom, nie piata dlaždica
          (Q1). Len keď niečo čaká — prázdny pás by učil oko ho prehliadať.
        */}
        {pending > 0 && (
          <div className="dpo-alert" role="status">
            <div className="dpo-alert-text">
              <strong>{t.pendingBanner(pending)}</strong>
              {t.pendingBannerMeta(pendingList[0].personName, formatDate(pendingList[0].receivedAt, language))}
            </div>
            <a className="button dpo-button-sm" href="#objections">{t.pendingDecide}</a>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="empty dpo-section"><div className="empty-text">{t.empty}</div></div>
        ) : (
          <div className="dpo-layout">
            <aside className="card dpo-facets" aria-label={t.reportHeading}>
              {facetGroups.map(g => (
                <div className="facet-group" key={g.key}>
                  <h2 className="lf-title">{g.title}</h2>
                  {[g.all, ...g.rows].map(f => (
                    <Link key={f.label} href={f.href} className={`facet${f.on ? " is-on" : ""}`} aria-current={f.on ? "true" : undefined}>
                      <span className="facet-box facet-box--radio" aria-hidden="true" />
                      <span className="facet-name">{f.label}</span>
                      {facetCount(f)}
                    </Link>
                  ))}
                </div>
              ))}
            </aside>

            <section className="dpo-list" id="report" aria-label={t.reportHeading}>
              <div className="library-toolbar">
                {/* Hľadanie je formulár, nie odkaz; skryté polia nesú filtre
                    a zoskupenie, inak by ich odoslanie zrušilo. */}
                <form className="library-search" method="get" action="/dpo" role="search">
                  <SearchStrip
                    name="q"
                    defaultValue={query.q}
                    placeholder={t.searchPlaceholder}
                    label={t.searchPlaceholder}
                    submitLabel={t.searchSubmit}
                  />
                  {query.state && <input type="hidden" name="state" value={query.state} />}
                  {query.basis && <input type="hidden" name="basis" value={query.basis} />}
                  {query.person && <input type="hidden" name="person" value={query.person} />}
                  {query.group === "state" && <input type="hidden" name="group" value="state" />}
                </form>
                <nav className="view-switch" aria-label={t.groupBy}>
                  <Link className={`view-switch-item${!byPerson ? " is-on" : ""}`} href={dpoHref(query, { group: "state" })} aria-current={!byPerson ? "true" : undefined}>{t.groupState}</Link>
                  <Link className={`view-switch-item${byPerson ? " is-on" : ""}`} href={dpoHref(query, { group: "person" })} aria-current={byPerson ? "true" : undefined}>{t.groupPerson}</Link>
                </nav>
              </div>

              {/* Pod 1024 px tie isté filtre ako pilulky v jednom riadku. */}
              <nav className="dpo-pills" aria-label={t.reportHeading}>
                <Link href={dpoHref(query, { state: undefined, basis: undefined, person: undefined })}
                  className={`dpo-pill${!query.state && !query.basis && !query.person ? " is-on" : ""}`}>
                  {t.filterAll}<span className="dpo-pill-count">{facets.state.all}</span>
                </Link>
                {facetGroups.flatMap(g => g.rows).map(f => (
                  <Link key={f.label} href={f.href} className={`dpo-pill${f.on ? " is-on" : ""}${f.count === 0 && !f.on ? " is-empty" : ""}`}>
                    {f.label}
                    <span className={`dpo-pill-count${f.warn && f.count > 0 ? " is-warn" : ""}`}>{f.count}</span>
                  </Link>
                ))}
              </nav>

              <div className="dpo-count">
                <span className="quiet library-count">
                  {filtered ? t.shownOf(shown.length, rows.length) : t.summary(rows.length, shownProblems)}
                </span>
                {chips.map(c => (
                  <Link key={`${c.key}-${c.label}`} href={c.href} className="library-chip" aria-label={t.removeFilter(c.label)}>
                    <span className="library-chip-key">{c.key}</span>
                    {c.label}
                    <span className="library-chip-x" aria-hidden="true">×</span>
                  </Link>
                ))}
                {chips.length > 1 && <Link className="library-chips-clear" href={clearHref}>{t.clearAll}</Link>}
              </div>

              {shown.length === 0 ? (
                /* Prázdny stav s filtrom (ZAKLAD, úloha 1). */
                <div className="empty">
                  <div className="empty-title">{t.noMatch}</div>
                  <div className="empty-text">
                    {t.noMatchText} <Link href="/library">{t.noMatchLibrary}</Link>.
                  </div>
                  <div className="empty-action">
                    <Link className="button button--quiet" href="/dpo">{t.clearSearch}</Link>
                  </div>
                </div>
              ) : (
                <>
                  {/*
                    Tabuľka od 1024 px, pod tým karty (rám, body 2 a 4): na
                    telefóne sa stĺpce nezmestia a DPO výkaz otvorí aj
                    z e-mailu v mobile. Obe podoby sú v HTML, prepína ich CSS.
                    Pri zoskupení podľa osoby stĺpec Zodpovedná osoba odpadá —
                    osoba je v hlavičke skupiny.
                  */}
                  <div className="dpo-table-wrap">
                    <table className={`dpo-table${byPerson ? " dpo-table--person" : ""}`}>
                      <thead>
                        <tr>
                          <th>{t.colDocument}</th><th>{t.basis}</th>
                          {!byPerson && <th>{t.responsible}</th>}
                          <th>{t.colStatus}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map(g => [
                          <tr key={`g-${g.key}`} className={`dpo-group${byPerson ? " dpo-group--person" : ""}`}>
                            <td colSpan={colCount}>
                              {byPerson ? (
                                <div className="dpo-group-row">
                                  <span className="dpo-group-name">{g.title}</span>
                                  <span className="quiet dpo-group-meta">{g.meta}</span>
                                  {mailButton(g)}
                                </div>
                              ) : g.title}
                            </td>
                          </tr>,
                          ...g.rows.map(r => (
                            <tr key={`${g.key}|${r.documentId}|${r.versionId}`}>
                              <td>
                                {docLink(r)}
                                <div className="quiet dpo-sub">{t.version}: {versionOf(r)}</div>
                              </td>
                              <td>
                                {basisOf(r)}
                                {r.reference && <div className="quiet dpo-sub">{t.reference}: {r.reference}</div>}
                              </td>
                              {!byPerson && <td className="dpo-person">{responsibleOf(r)}</td>}
                              <td><div className="dpo-tags">{statusOf(r)}</div></td>
                            </tr>
                          )),
                        ])}
                      </tbody>
                    </table>
                  </div>

                  <div className="dpo-cards">
                    {groups.map(g => (
                      <div key={g.key} className="dpo-card-group">
                        <div className="dpo-card-group-head">
                          <h3 className="dpo-group-h">{g.title}</h3>
                          {byPerson && <span className="quiet dpo-group-meta">{g.meta}</span>}
                          {byPerson && mailButton(g)}
                        </div>
                        <ul className="widget-list">
                          {g.rows.map(r => (
                            <li key={`${r.documentId}|${r.versionId}`} className="card dpo-card">
                              <div className="dpo-card-top">
                                {docLink(r)}
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
                </>
              )}

              {/* Na telefóne sa CSV do hlavičky nezmestí — je na konci zoznamu. */}
              <Link className="button button--quiet dpo-csv dpo-csv--foot" href="/dpo/csv">{t.csv}</Link>
            </section>
          </div>
        )}

        {/*
          Lehoty uchovávania, doplnok na /privacy a kontakt GDPR sú od 1. 10.
          2026 v nastaveniach organizácie, záložka GDPR (D154). Upravuje ich
          ďalej len DPO.
        */}
        <p className="card" style={{ padding: "14px 16px", margin: "32px 0 0", fontSize: "var(--fs-body)" }}>
          {t.settingsMoved}{" "}
          <Link href="/organisation/gdpr">{t.settingsLink}</Link>
        </p>

        {/*
          Námietky (ADR-012, D105). Zápis a rozhodnutie sú dva formuláre:
          námietka prichádza a vybavuje sa v inom čase a do rozhodnutia sa
          nesmie nič zmazať.
        */}
        <section id="objections" className="dpo-objections">
          <div className="page-head dpo-objections-head">
            <h2 style={{ fontSize: "var(--fs-section)", margin: 0 }}>{t.objectionsHeading}</h2>
            {pending > 0 && <span className="tag tag--draft">{t.pendingCount(pending)}</span>}
            <span className="page-head-spacer" aria-hidden="true" />
            {/*
              Zaevidovanie je zbalené (rám, bod 7; Ján 24. 9.): námietka príde
              zriedka. Tlačidlo je v hlavičke sekcie (DPO-vykaz-hladanie);
              otvorený formulár ide na celý riadok pod ňu. Po chybe sa
              otvorí, nech sa dá opraviť bez hľadania.
            */}
            <details className="dpo-record" open={q.error === "1"}>
              <summary className="button button--quiet dpo-button-sm">{t.recordOpen}</summary>
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
                      {MANUAL_OBJECTION_CHANNELS.map(c => <option key={c} value={c}>{t.channels[c]}</option>)}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">{t.objectionText}</span>
                  <textarea className="field-input" name="text" rows={4} required />
                  <span className="quiet field-hint">{t.objectionTextNote}</span>
                </label>
                <div><SubmitButton className="button button--quiet">{t.recordSubmit}</SubmitButton></div>
              </form>
            </details>
          </div>
          <p className="quiet" style={{ margin: 0, maxWidth: 640, fontSize: "var(--fs-body)" }}>{t.objectionsIntro}</p>

          {objections.length === 0 && (
            <div className="empty"><div className="empty-text">{t.noObjections}</div></div>
          )}
          {pendingList.length > 0 && (
            <ul className="widget-list">{pendingList.map(o => objectionCard(o))}</ul>
          )}
          {/* Rozhodnuté sú doklad, nie úloha — zbalené pod čakajúcimi. */}
          {decided.length > 0 && (
            <details className="dpo-decided">
              <summary>{t.decidedToggle(decided.length)}</summary>
              <ul className="widget-list">{decided.map(o => objectionCard(o))}</ul>
            </details>
          )}
        </section>
      </div>
    </AppShell>
  )
}
