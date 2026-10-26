/**
 * Prehľad — úvodná obrazovka po prihlásení (ADR-041, D271; návrh
 * `docs/design/PREHLAD-ulohy-a-dokumenty.html` + `.md`, 26. 10. 2026).
 *
 * Odpovedá na dve otázky bežného človeka: **čo odo mňa niekto čaká** (Moje
 * úlohy) a **čo mám k dispozícii** (Dokumenty). Pod tým rozcestník sekcií —
 * Organizácia pre každého, Správa len rolám.
 *
 * Oba zoznamy sú na **výber, nie na akcie** (Q2): celý riadok vedie na
 * detail, kde sa potvrdzuje, rozhoduje aj pýta. Úlohy sú v skupinách podľa
 * naliehavosti (po termíne, blíži sa termín, ďalšie, na rozhodnutie);
 * dokumenty sú hľadanie s rozsahmi podľa druhu (SwiftUI `.searchable` +
 * `.searchScopes`, Q1) — stav je v adrese (`?find=`, `?kind=`), bez skriptu
 * je to GET formulár a odkazy.
 *
 * Žiadny panel si svoje položky nepočíta po svojom: povinnosti sú
 * z `pendingForPerson()`, kolá z `roundsWaitingFor()`, dokumenty
 * z `readableDocuments()` a `subscribedActs()` — z tých istých funkcií, ktoré
 * kreslia obrazovky, na ktoré panely odkazujú.
 */

import { Fragment } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import SectionTiles from "@/components/SectionTiles"
import LiveFilter from "@/components/LiveFilter"
import SearchStrip from "@/components/SearchStrip"
import Icon from "@/components/Icon"
import { navItems, sectionGroups } from "@/lib/appNav"
import { shellNavData } from "@/lib/navData"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { pendingForPerson } from "@/lib/pending"
import { roundsWaitingFor, documentTitles } from "@/lib/approvalsDb"
import { readableDocuments } from "@/lib/documents"
import { mergeReaderDocuments, findReaderDocuments, groupTasks, LAW_CATEGORY, type TaskGroup } from "@/lib/overview"
import { lawSourceState, subscribedActs } from "@/lib/lawCatalog"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { dueState } from "@/lib/due"
import { dueText } from "@/lib/dueText"

export const dynamic = "force-dynamic"

/** Riadky v paneloch — zvyšok je za pätičkou „Všetky …". */
const PANEL_ROWS = 6

/** Šípka riadku-odkazu (`.panel-chevron`) — ako `NavigationLink` v SwiftUI. */
function Chevron() {
  return (
    <svg className="panel-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ q?: string; find?: string; kind?: string }>(await searchParams)

  /*
    Otázka na domovskej adrese patrí obrazovke odpovede, nie sem.

    Kým Prehľad žil na `/prehlad`, odpovedalo sa na `/?q=…`. Taký odkaz môže
    byť uložený v záložke alebo v poslanom e-maile a **otázka sa z neho nesmie
    stratiť** — preto sa prenáša ďalej, nie zahadzuje. Hľadanie v dokumentoch
    má preto vlastný kľúč `find`.
  */
  if (typeof q.q === "string" && q.q.trim() !== "") {
    redirect(`/ask?q=${encodeURIComponent(q.q)}`)
  }

  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") notFound()

  const person = ctx.person
  const branding = brandingView(ctx.tenant)
  const language = person.language
  const t = dictionary(language).overview
  const now = new Date()

  const [pending, approvals, nav, docs, law] = await Promise.all([
    pendingForPerson(person),
    roundsWaitingFor(person.companyCode, person.email),
    // Tie isté roly a počty ako shell — `cache()`, takže bez dotazov navyše.
    shellNavData(),
    readableDocuments(person.companyCode, now),
    lawSourceState(person.companyCode),
  ])
  /*
    Dokumenty (D270): platné dokumenty knižnice a odoberané predpisy v jednom
    zozname — čitateľ nerozlišuje, odkiaľ obsah prišiel, len aký je to druh.
    Predpisy len keď ich rezidencia dovoľuje čítať (D257). Pripojené systémy
    tu nie sú: pre čitateľa to nie sú dokumenty; ostávajú vo výbere zdrojov.

    „Nové" je nové **pre mňa** (Q3): zverejnené od predchádzajúceho
    prihlásenia. Keď celá knižnica vyšla v jeden deň, 7-dňové okno by
    označilo všetko — a chip, ktorý je všade, nehovorí nič.
  */
  const acts = law.allowed ? await subscribedActs(person.companyCode, now) : []
  const documents = mergeReaderDocuments(docs, acts, now, person.previousLoginAt ?? null)
  const found = findReaderDocuments(documents, typeof q.find === "string" ? q.find : "", typeof q.kind === "string" ? q.kind : "")
  const kindLabels = new Map(codelistOptions("category", tenantExtras(ctx.tenant)).map(o => [o.value, o.label]))
  const kindLabel = (key: string) => kindLabels.get(key) ?? (key === LAW_CATEGORY ? t.kindLaw : key)
  const overviewHref = (kind: string, find: string) => {
    const p = new URLSearchParams({ ...(find ? { find } : {}), ...(kind ? { kind } : {}) }).toString()
    return p ? `/?${p}#documents` : "/#documents"
  }
  // Knižnica na čítanie má `search` a `kind` — päta prenesie, čo človek práve hľadá.
  const libraryHref = (() => {
    const p = new URLSearchParams({ ...(found.query ? { search: found.query } : {}), ...(found.activeKind ? { kind: found.activeKind } : {}) }).toString()
    return p ? `/library?${p}` : "/library"
  })()

  /*
    Dlaždice sekcií (SHELL-rozcestnik): od 640 px nie je stále menu, sekcie
    sú tu. Kto akú dlaždicu vidí, rozhodol `navItems()` — rovnako ako lišta
    a plachta, takže sa nemôžu rozísť.
  */
  const sections = sectionGroups(navItems(nav.flags, nav.counts))

  /*
    Názvy dokumentov pre kolá až po ich načítaní: bez nich by v paneli stál
    kľúč (`sfz:stanovy`), a to je názov pre stroj, nie pre človeka, ktorý má
    o texte rozhodnúť. Jeden dotaz navyše, a len keď je čo rozhodovať.
  */
  const approvalTitles = await documentTitles(
    person.companyCode,
    approvals.map(r => r.documentId),
  )

  /*
    Stropy riadkov (PREHLAD, úloha 3). Úlohy: schválenia najviac 2, povinnosti
    doplnia zvyšok do 6 — inak pri deviatich povinnostiach schválenie nikto
    neuvidí, hoci je to rozhodnutie, ktoré blokuje druhých ľudí. Povinnosti
    sa najprv zoradia podľa naliehavosti, až potom orežú: po termíne sa nesmie
    stratiť za tým, čo má čas.
  */
  const approvalsShown = approvals.slice(0, 2)
  const dutyGroups = groupTasks(pending.items, now)
  const dutyLimit = PANEL_ROWS - approvalsShown.length
  const dutyGroupsShown = dutyGroups.reduce<typeof dutyGroups>((shown, g) => {
    const used = shown.reduce((n, x) => n + x.items.length, 0)
    const items = g.items.slice(0, Math.max(dutyLimit - used, 0))
    return items.length > 0 ? [...shown, { ...g, items }] : shown
  }, [])
  const tasksTotal = pending.items.length + approvals.length
  const tasksShown = dutyGroupsShown.reduce((n, g) => n + g.items.length, 0) + approvalsShown.length
  const overdue = dutyGroups.find(g => g.group === "over")?.items.length ?? 0
  const groupTitle: Record<TaskGroup, string> = { over: t.groupOver, soon: t.groupSoon, rest: t.groupRest }
  const iconTone: Record<TaskGroup, string> = { over: " task-icon--bad", soon: " task-icon--soon", rest: "" }
  const documentsShown = found.shown.slice(0, PANEL_ROWS)

  return (
    <AppShell language={language}>
      <div className="overview" style={tenantStyle(branding)}>
        {/* Oslovenie. Pole otázky tu už nie je (ASK-otazka-z-hlavicky, Q3):
            otázka sa kladie v hlavičke — jedno pole, jedno miesto. */}
        <h1 className="page-title overview-hello">{t.hello(person.fullName)}</h1>

        {/* Úlohy prvé, dokumenty pod nimi na celú šírku (Q4). */}
        <section className="section-group" aria-labelledby="tasks">
          <h2 className="section-group-title" id="tasks">
            {t.tasksHeading}
            {tasksTotal > 0 && (
              <> <span className="panel-head-count">{tasksTotal}{overdue > 0 ? ` · ${t.overdueCount(overdue)}` : ""}</span></>
            )}
          </h2>
          <div className="card panel">
            {/*
              Prázdno dva riadky (PREHLAD, úloha 1): čo tu nie je a čo z toho
              vyplýva. Prázdny panel ostáva — miesto úloh sa nemá zo dňa na
              deň presúvať.
            */}
            {tasksTotal === 0 && (
              <div className="panel-empty">
                <span className="panel-empty-title">{t.empty.attentionTitle}</span>
                <span className="panel-empty-text">{t.empty.attentionText}</span>
              </div>
            )}
            {dutyGroupsShown.map(g => (
              <Fragment key={g.group}>
                <div className={`panel-group${g.group === "over" ? " panel-group--bad" : ""}`}>{groupTitle[g.group]}</div>
                {g.items.map(i => (
                  <Link key={`${i.source}-${i.id}`} className="panel-row panel-row--link" href={i.href}>
                    <span className={`task-icon${iconTone[g.group]}`} aria-hidden="true"><Icon name="toAcknowledge" size={18} /></span>
                    <span className="panel-main">
                      <span className="panel-name">{i.title}</span>
                      <span className="panel-meta">
                        {[
                          t.taskAcknowledge,
                          i.category ? kindLabel(i.category) : null,
                          i.step && i.step.total > 1 ? t.trackStep(i.step.order, i.step.total) : i.detail,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {/* Po lehote len chip v --bad-bg: prekročený termín potvrdenie nezakazuje. */}
                    {i.due && <span className={`due-chip due-chip--${dueState(i.due, now)}`}>{dueText(i.due, now, language)}</span>}
                    <Chevron />
                  </Link>
                ))}
              </Fragment>
            ))}
            {approvalsShown.length > 0 && (
              <>
                <div className="panel-group">{t.groupDecide}</div>
                {approvalsShown.map(r => (
                  <Link key={`${r.documentId}-${r.round}`} className="panel-row panel-row--link" href="/approvals">
                    <span className="task-icon task-icon--decide" aria-hidden="true"><Icon name="toApprove" size={18} /></span>
                    <span className="panel-main">
                      <span className="panel-name">{approvalTitles.get(r.documentId) ?? r.documentId}</span>
                      <span className="panel-meta">{t.taskDecide} · {t.submittedBy(r.submittedBy)}</span>
                    </span>
                    <Chevron />
                  </Link>
                ))}
              </>
            )}
            {/* Odkaz na celý zoznam v pätičke (SHELL-rozcestnik, 4a); počet len keď panel niečo skrýva. */}
            <div className="panel-foot">
              <Link href="/documents">{tasksTotal > tasksShown ? t.showAll(tasksTotal) : t.allTasks}</Link>
            </div>
          </div>
        </section>

        <section className="section-group" aria-labelledby="documents">
          <h2 className="section-group-title" id="documents">
            {t.documentsHeading}
            {documents.length > 0 && <> <span className="panel-head-count">{documents.length}</span></>}
          </h2>
          {/*
            Hľadanie s rozsahmi (Q1). Hľadá sa v názve; text píše `LiveFilter`
            do adresy a zoznam skladá server, bez skriptu je to GET formulár.
            Rozsahy sú odkazy s počtom po hľadaní — pri piatich a viac druhoch
            sa pás roluje (`.view-switch--scroll`). Bez dokumentov sa nekreslí
            ani jedno: nebolo by čo hľadať.
          */}
          {documents.length > 0 && (
            <div className="library-toolbar">
              <LiveFilter className="library-search" action="/" label={t.findLabel}>
                <SearchStrip name="find" defaultValue={found.query} placeholder={t.findPlaceholder}
                             label={t.findLabel} submitLabel={t.findSubmit} />
                {found.activeKind && <input type="hidden" name="kind" value={found.activeKind} />}
              </LiveFilter>
              {found.kinds.length > 1 || found.activeKind ? (
                <nav className="view-switch view-switch--scroll" aria-label={t.kindsLabel}>
                  <Link className={`view-switch-item${found.activeKind ? "" : " is-on"}`} aria-current={found.activeKind ? undefined : "true"}
                        href={overviewHref("", found.query)} scroll={false}>
                    {t.kindAll}<span className="view-switch-count">{found.matchedTotal}</span>
                  </Link>
                  {found.kinds.map(k => (
                    <Link key={k.key} className={`view-switch-item${k.key === found.activeKind ? " is-on" : ""}`}
                          aria-current={k.key === found.activeKind ? "true" : undefined}
                          href={overviewHref(k.key, found.query)} scroll={false}>
                      {kindLabel(k.key)}<span className="view-switch-count">{k.count}</span>
                    </Link>
                  ))}
                </nav>
              ) : null}
            </div>
          )}
          <div className="card panel">
            {documents.length === 0 && (
              <div className="panel-empty">
                <span className="panel-empty-title">{t.emptyDocumentsTitle}</span>
                <span className="panel-empty-text">{t.emptyDocumentsText}</span>
              </div>
            )}
            {documents.length > 0 && found.shown.length === 0 && (
              <div className="panel-empty">
                <span className="panel-empty-title">
                  {found.activeKind ? t.noResultsInKind(kindLabel(found.activeKind), found.query) : t.noResults(found.query)}
                </span>
                {found.activeKind && found.matchedTotal > 0 && (
                  <span className="panel-empty-text">
                    {t.otherKinds(found.matchedTotal)}{" "}
                    <Link href={overviewHref("", found.query)} scroll={false}>{t.searchAllKinds}</Link>
                  </span>
                )}
              </div>
            )}
            {documentsShown.map(r => (
              <Link key={r.key} className="panel-row panel-row--link" href={r.href}>
                <span className="panel-main">
                  <span className="panel-name">{r.title}</span>
                  <span className="panel-meta">
                    {[r.category ? kindLabel(r.category) : null, t.effectiveFromMeta(formatDate(r.effectiveFrom, language))].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {/* Končiaca platnosť je naliehavejšia než „nové" — nová aj končiaca naraz ukáže koniec. */}
                {r.expiring
                  ? <span className="due-chip due-chip--soon">{t.expiringChip}</span>
                  : r.isNew && <span className="tag tag--new">{t.newChip}</span>}
                <Chevron />
              </Link>
            ))}
            {documents.length > 0 && (
              <div className="panel-foot">
                {/* Hľadá sa v názvoch; obsah je vec otázky — ponuka ju rovno položiť. */}
                {found.query && (
                  <p className="quiet" style={{ margin: "0 0 6px", fontWeight: 400 }}>
                    {t.titlesOnly}{" "}
                    <Link href={`/ask?${new URLSearchParams({ q: found.query }).toString()}`} style={{ fontWeight: 600 }}>{t.askContent(found.query)}</Link>
                  </p>
                )}
                <Link href={libraryHref}>{found.shown.length > documentsShown.length ? t.showAll(found.shown.length) : t.documentsAll}</Link>
              </div>
            )}
          </div>
        </section>

        {/* Rozcestník: Organizácia pre každého (Knižnica ostáva, Q5), Správa
            rolám. Nadpisy skupín nesú kotvu pre krok skupiny v ceste (`/#management`). */}
        <SectionTiles groups={sections} language={language} />
      </div>
    </AppShell>
  )
}
