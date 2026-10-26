/**
 * /documents/law/SK/ZZ/2015/440 — predpis z katalógu legislatívy pre
 * čitateľa (ADR-041, D273): rovnaký tvar ako čitateľský detail dokumentu
 * knižnice — riadok druh · znenie · účinné od, karta údajov, karta znení,
 * celý text. Čitateľ je každý prihlásený človek organizácie, ktorá predpis
 * odoberá; kto nie je, dostane 404 — rovnako ako pri cudzom dokumente (D32).
 *
 * Správa zdroja (posledná kontrola, chyba, odber, PDF) ostáva na
 * `/organisation/sources/web/slov-lex/<actId>` — verejné cesty sa
 * neprejmenúvajú; správca osôb sem má jeden tichý odkaz (D274).
 *
 * Identifikátor predpisu má lomky (ADR-037 D245), preto je trasa zberná.
 * Statický segment `law` má v Next prednosť pred `[documentId]`, takže
 * `/documents/law/…` nikdy nespadne do detailu dokumentu knižnice.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import type { ReactNode } from "react"
import { onboardingContext } from "@/lib/session"
import {
  SLOV_LEX_SOURCE_ID, actById, versionsOf, catalogVersion, versionToShow, lawSourceState,
} from "@/lib/lawCatalog"
import { lawDocumentsFor } from "@/lib/lawLibraryLink"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { codelistOptions } from "@/lib/codelists"
import { PEOPLE_ROLE } from "@/lib/people"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import LawActText from "@/components/LawActText"

export const dynamic = "force-dynamic"

export default async function LawActReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ act: string[] }>
  searchParams: Promise<RawQuery>
}) {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") notFound()
  const person = ctx.person

  const actId = (await params).act.map(decodeURIComponent).join("/")
  // Odber je v podmienke (D32): predpis, ktorý organizácia neodoberá, sa
  // tvári ako neexistujúci — aj keď v katalógu je pre inú organizáciu.
  const source = await lawSourceState(person.companyCode)
  if (!source.allowed || !source.actIds.includes(actId)) notFound()
  const act = await actById(actId)
  if (!act) notFound()

  const language = person.language
  const d = dictionary(language)
  const t = d.onboarding
  const tl = d.org.law
  const td = tl.detail
  const tv = d.library.docView
  const query = normalizeQuery<{ version?: string }>(await searchParams)
  const now = new Date()

  const [versions, library] = await Promise.all([versionsOf(actId), lawDocumentsFor(person.companyCode, [actId], now)])
  const inLibrary = library.get(actId) ?? null
  const shown = versionToShow(versions, query.version, now)
  // Text sa číta až tu — zoznam znení ho nepotrebuje a jedno znenie má státisíce znakov.
  const full = shown ? await catalogVersion(actId, shown.timepoint) : null
  const date = (x: Date) => formatDate(x, language)
  const base = `/documents/law/${actId}`
  const manageHref = `/organisation/sources/web/${SLOV_LEX_SOURCE_ID}/${actId}`
  const isPeopleAdmin = Boolean(person.roles?.includes(PEOPLE_ROLE))

  const state = (v: (typeof versions)[number]): "now" | "past" | "later" => {
    if (v.effectiveFrom.getTime() > now.getTime()) return "later"
    if (v.effectiveTo && v.effectiveTo.getTime() <= now.getTime()) return "past"
    return "now"
  }
  const stateLabel = { now: td.stateNow, past: td.statePast, later: td.stateLater }

  /*
    Karta údajov kreslí len to, čo katalóg má (D273): pôvod s odkazom na
    portál, jazyk, a keď je predpis aj v knižnici, odkaz na ten dokument —
    tam sú údaje organizácie (zodpovedná osoba, nadradené). Nič sa nedomýšľa.
  */
  const facts: [string, ReactNode][] = [
    [tv.rows.origin, shown
      ? <a key="origin" href={shown.portalUrl} target="_blank" rel="noopener noreferrer">Slov-Lex</a>
      : <a key="origin" href={`https://www.slov-lex.sk/pravne-predpisy/${actId}/`} target="_blank" rel="noopener noreferrer">Slov-Lex</a>],
    [tv.rows.language, codelistOptions("language").find(o => o.value === "sk")?.label ?? "sk"],
    ...(inLibrary?.published
      ? [[td.libraryRow, <Link key="lib" href={`/documents/${encodeURIComponent(inLibrary.documentId)}`}>{inLibrary.title}</Link>] as [string, ReactNode]]
      : []),
  ]

  return (
    <AppShell language={language} title={act.title}>
      <div style={{ maxWidth: 760, ...tenantStyle(brandingView(ctx.tenant)) }}>
        {/* Tiché akcie: otázka nad Legislatívou (rozsah na jeden predpis zatiaľ
            nie je, ADR-029 § 7) a pre správcu osôb správa zdroja (D274). */}
        <div className="page-head">
          <h1 className="page-title">{act.title}</h1>
          <span className="page-head-spacer" />
          {isPeopleAdmin && <Link className="button button--quiet" href={manageHref}>{td.manageSource}</Link>}
          <Link className="button button--quiet" href={`/ask?${new URLSearchParams({ src: SLOV_LEX_SOURCE_ID }).toString()}`}>
            {t.askDocument}
          </Link>
        </div>

        <div className="zn-head">
          <p className="quiet zn-version">
            <span>{[act.kind, act.actId, shown ? tl.current(date(shown.effectiveFrom)) : tl.pending].join(" · ")}</span>
          </p>
          <section className="card insp-rows" aria-label={t.factsHeading}>
            {facts.map(([label, value]) => (
              <div className="labeled-row" key={label}>
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </section>
        </div>

        {/* Znenia (D272): najnovšie prvé; zobrazené znenie tlačidlo nemá (R1). */}
        {versions.length > 1 && (
          <section className="card more" style={{ marginBottom: 24 }}>
            <div className="more-head"><h2>{t.versionsHeading(versions.length)}</h2></div>
            {[...versions].reverse().map(v => {
              const isShown = shown?.timepoint === v.timepoint
              const s = state(v)
              return (
                <div key={v.timepoint} className="more-row" aria-current={isShown ? "true" : undefined}>
                  <div className="more-main">
                    <b>
                      {v.effectiveTo ? td.effectiveRange(date(v.effectiveFrom), date(v.effectiveTo)) : tl.current(date(v.effectiveFrom))}
                      {" "}<span className={s === "now" ? "tag tag--published" : "tag"}>{stateLabel[s]}</span>
                    </b>
                    <span>
                      {v.amendment ? tl.amendment(v.amendment) : td.original}
                      {" · "}
                      <a href={v.portalUrl} target="_blank" rel="noopener noreferrer">Slov-Lex</a>
                    </span>
                  </div>
                  {isShown
                    ? <span className="quiet" style={{ fontSize: 13 }}>{t.versionShown}</span>
                    : <Link className="button button--quiet" href={`${base}?${new URLSearchParams({ version: v.timepoint }).toString()}#text`}>{t.versionShow}</Link>}
                </div>
              )
            })}
          </section>
        )}

        {full && <LawActText markdown={full.markdown} heading={td.textHeading(date(full.effectiveFrom))} note={td.textNote} />}
      </div>
    </AppShell>
  )
}
