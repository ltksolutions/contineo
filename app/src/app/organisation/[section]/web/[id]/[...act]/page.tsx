/**
 * /organisation/sources/web/slov-lex/SK/ZZ/2015/440 — detail predpisu
 * z katalógu legislatívy (ADR-039): znenia, ktoré katalóg drží, a celý text
 * jedného z nich na čítanie.
 *
 * Identifikátor predpisu má lomky (`SK/ZZ/2015/440`, ADR-037 D245), preto je
 * trasa zberná (`[...act]`) a nie jeden segment — adresa ostáva čitateľná
 * a dá sa poslať odkazom. Znenie v adrese je `?version=20260101`; bez neho
 * sa ukáže znenie účinné dnes.
 *
 * Text kreslí `LawActText` — ten istý ako na čitateľskom detaile
 * `/documents/law/<actId>` (ADR-041 D273), kam sa odtiaľto nevedie: správca
 * je tu kvôli zdroju (kontrola, chyba, odber), čitateľ tam kvôli predpisu.
 *
 * Stránka sa len číta; odber a odber do knižnice sú na zozname predpisov.
 * Prístup ako celé nastavenia organizácie (správca osôb, D154).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { orgPageContext } from "@/lib/orgSettings"
import {
  SLOV_LEX_SOURCE_ID, actById, versionsOf, catalogVersion, versionToShow, subscriptionsFor,
} from "@/lib/lawCatalog"
import { lawDocumentsFor } from "@/lib/lawLibraryLink"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import LawActText from "@/components/LawActText"

export const dynamic = "force-dynamic"

export default async function LawActDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; id: string; act: string[] }>
  searchParams: Promise<RawQuery>
}) {
  const { section, id, act: segments } = await params
  if (section !== "sources" || id !== SLOV_LEX_SOURCE_ID) notFound()
  const ctx = await orgPageContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  if (!ctx.canAdmin) notFound()

  const actId = segments.map(decodeURIComponent).join("/")
  const act = await actById(actId)
  if (!act) notFound()

  const language = ctx.person.language
  const d = dictionary(language)
  const t = d.org
  const td = t.law.detail
  const query = normalizeQuery<{ version?: string }>(await searchParams)
  const now = new Date()

  const [versions, subscriptions, library] = await Promise.all([
    versionsOf(actId),
    subscriptionsFor(ctx.tenant.companyCode),
    lawDocumentsFor(ctx.tenant.companyCode, [actId]),
  ])
  const subscription = subscriptions.find(s => s.actId === actId) ?? null
  const inLibrary = library.get(actId) ?? null
  const shown = versionToShow(versions, query.version, now)
  // Text sa číta až tu — zoznam znení ho nepotrebuje a jedno znenie má státisíce znakov.
  const full = shown ? await catalogVersion(actId, shown.timepoint) : null
  const date = (x: Date) => formatDate(x, language)
  const base = `/organisation/sources/web/${SLOV_LEX_SOURCE_ID}/${actId}`
  const slovLexHref = `https://www.slov-lex.sk/pravne-predpisy/${actId}/`

  const state = (v: (typeof versions)[number]): string => {
    if (v.effectiveFrom.getTime() > now.getTime()) return td.stateLater
    if (v.effectiveTo && v.effectiveTo.getTime() <= now.getTime()) return td.statePast
    return td.stateNow
  }

  return (
    <AppShell language={language} title={act.title}
              trail={{ "/organisation": t.heading, "/organisation/sources": t.tabs.sources, "/organisation/sources/web": t.sources.tabWeb, [`/organisation/sources/web/${SLOV_LEX_SOURCE_ID}`]: t.sources.slovLex }}>
      <div className="org-set" style={tenantStyle(brandingView(ctx.tenant))}>
        <div className="page-head">
          <div>
            <h1 className="page-title">{act.title}</h1>
            <p className="quiet page-lead" style={{ margin: "4px 0 0" }}>
              {[
                act.kind,
                act.actId,
                subscription ? td.subscribedSince(date(subscription.addedAt)) : td.notSubscribed,
                act.lastCheckedAt ? t.law.checked(date(act.lastCheckedAt)) : t.law.neverChecked,
              ].filter(Boolean).join(" · ")}
              {" · "}
              <a href={slovLexHref} target="_blank" rel="noopener noreferrer">Slov-Lex</a>
              {inLibrary && <>{" · "}<Link href={`/library/${encodeURIComponent(inLibrary.documentId)}`}>{t.law.inLibrary}</Link></>}
            </p>
            {act.lastError && <p className="tone-bad" style={{ margin: "6px 0 0", fontSize: 13 }}>{t.law.checkError(act.lastError)}</p>}
          </div>
        </div>

        <section className="card more">
          <div className="more-head"><h2>{td.versionsHeading}</h2></div>
          {versions.length === 0 ? (
            <div className="more-row"><div className="more-main"><span>{t.law.pending}</span></div></div>
          ) : [...versions].reverse().map(v => {
            const isShown = shown?.timepoint === v.timepoint
            return (
              <div key={v.timepoint} className="more-row" aria-current={isShown ? "true" : undefined}>
                <div className="more-main">
                  <b>
                    {v.effectiveTo ? td.effectiveRange(date(v.effectiveFrom), date(v.effectiveTo)) : t.law.current(date(v.effectiveFrom))}
                    {" "}<span className={v.effectiveFrom.getTime() <= now.getTime() && !(v.effectiveTo && v.effectiveTo.getTime() <= now.getTime()) ? "tag tag--published" : "tag"}>{state(v)}</span>
                  </b>
                  <span>
                    {[
                      v.amendment ? t.law.amendment(v.amendment) : td.original,
                      td.fetched(date(v.fetchedAt)),
                      td.chunks(v.chunkCount),
                    ].join(" · ")}
                    {" · "}
                    <a href={v.portalUrl} target="_blank" rel="noopener noreferrer">Slov-Lex</a>
                    {" · "}
                    <a href={v.pdfUrl} target="_blank" rel="noopener noreferrer">PDF</a>
                  </span>
                </div>
                {/* Karty s vlastnou akciou majú tlačidlá tiché (DESIGN_ODCHYLKY R1); zobrazené znenie tlačidlo nemá. */}
                {isShown
                  ? <span className="quiet" style={{ fontSize: 13 }}>{td.shownBelow}</span>
                  : <Link className="button button--quiet" href={`${base}?${new URLSearchParams({ version: v.timepoint }).toString()}#text`}>{td.fullText}</Link>}
              </div>
            )
          })}
        </section>

        {full && <LawActText markdown={full.markdown} heading={td.textHeading(date(full.effectiveFrom))} note={td.textNote} />}
      </div>
    </AppShell>
  )
}
