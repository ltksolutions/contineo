/**
 * Prehľad — úvodná obrazovka po prihlásení (ADR-041, D271; návrh
 * `docs/design/ZAKLAD-prehlad-a-detail-pre-pouzivatela.md`, časť A).
 *
 * Odpovedá na dve otázky bežného človeka: **čo odo mňa niekto čaká** (Moje
 * úlohy) a **čo mám k dispozícii** (Dokumenty). Pod tým rozcestník sekcií —
 * Organizácia pre každého, Správa len rolám.
 *
 * Dlaždice KPI a blok „Pre vás" (Čo vás čaká, Novinky) zanikli 26. 10. 2026:
 * tie isté tri potvrdenia stáli v dlaždici hore aj v zozname dole a Novinky
 * boli knižnica z druhej strany. Čísla sa nestratili — sú v hlavičke panelu
 * a v chipoch `nové` a `expiruje` pri riadkoch.
 *
 * Žiadny panel si svoje položky nepočíta po svojom: povinnosti sú
 * z `pendingForPerson()`, kolá z `roundsWaitingFor()`, dokumenty
 * z `readableDocuments()` a `subscribedActs()` — z tých istých funkcií, ktoré
 * kreslia obrazovky, na ktoré panely odkazujú.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import SectionTiles from "@/components/SectionTiles"
import { navItems, sectionGroups } from "@/lib/appNav"
import { shellNavData } from "@/lib/navData"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { pendingForPerson } from "@/lib/pending"
import { roundsWaitingFor, documentTitles } from "@/lib/approvalsDb"
import { readableDocuments } from "@/lib/documents"
import { mergeReaderDocuments, LAW_CATEGORY } from "@/lib/overview"
import { lawSourceState, subscribedActs } from "@/lib/lawCatalog"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { dueState } from "@/lib/due"

export const dynamic = "force-dynamic"

/** Riadky v paneloch — zvyšok je za pätičkou „Všetky …". */
const PANEL_ROWS = 6

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ q?: string }>(await searchParams)

  /*
    Otázka na domovskej adrese patrí obrazovke odpovede, nie sem.

    Kým Prehľad žil na `/prehlad`, odpovedalo sa na `/?q=…`. Taký odkaz môže
    byť uložený v záložke alebo v poslanom e-maile a **otázka sa z neho nesmie
    stratiť** — preto sa prenáša ďalej, nie zahadzuje.
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
  */
  const acts = law.allowed ? await subscribedActs(person.companyCode, now) : []
  const documents = mergeReaderDocuments(docs, acts, now)
  const kindLabels = new Map(codelistOptions("category", tenantExtras(ctx.tenant)).map(o => [o.value, o.label]))
  const kindLabel = (key: string) => kindLabels.get(key) ?? (key === LAW_CATEGORY ? t.kindLaw : key)

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
    neuvidí, hoci je to rozhodnutie, ktoré blokuje druhých ľudí. Odkaz
    s počtom sa kreslí len keď panel niečo skrýva.
  */
  const approvalsShown = approvals.slice(0, 2)
  const dutiesShown = pending.items.slice(0, PANEL_ROWS - approvalsShown.length)
  const tasksTotal = pending.items.length + approvals.length
  const tasksHidden = tasksTotal > dutiesShown.length + approvalsShown.length
  const documentsShown = documents.slice(0, PANEL_ROWS)

  return (
    <AppShell language={language}>
      <div className="overview" style={tenantStyle(branding)}>
        {/* Oslovenie. Pole otázky tu už nie je (ASK-otazka-z-hlavicky, Q3):
            otázka sa kladie v hlavičke — jedno pole, jedno miesto. */}
        <h1 className="page-title overview-hello">{t.hello(person.fullName)}</h1>

        {/* Dva panely pod sebou na celú šírku: riadok s chipom, metou a akciou
            potrebuje šírku, v dvoch stĺpcoch by sa lámal na tri riadky. */}
        <section className="section-group" aria-labelledby="tasks">
          <h2 className="section-group-title" id="tasks">{t.tasksHeading}</h2>
          <div className="overview-panels">
            <section className="card panel">
              <div className="panel-head">
                <span>{t.tasksHeading}</span>
                {tasksTotal > 0 && <span className="panel-head-count">{tasksTotal}</span>}
              </div>
              {/*
                Prázdno až vtedy, keď je prázdny celý panel — dovtedy sa veta
                „nič nečaká" kreslila aj nad riadkom schválenia. Dva riadky
                (PREHLAD, úloha 1): čo tu nie je a čo z toho vyplýva.
              */}
              {tasksTotal === 0 && (
                <div className="panel-empty">
                  <span className="panel-empty-title">{t.empty.attentionTitle}</span>
                  <span className="panel-empty-text">{t.empty.attentionText}</span>
                </div>
              )}
              {dutiesShown.map(i => (
                <div key={`${i.source}-${i.id}`} className="panel-row">
                  <div className="panel-main">
                    <Link className="panel-name" href={i.href}>{i.title}</Link>
                    {i.detail && <div className="quiet panel-meta">{i.detail}</div>}
                  </div>
                  {/* Po lehote len chip v --bad-bg: prekročený termín potvrdenie nezakazuje. */}
                  {i.due && (
                    <span className={`due-chip due-chip--${dueState(i.due, now)}`}>
                      {t.by(formatDate(i.due, language))}
                    </span>
                  )}
                  <Link className="panel-action" href={i.href}>{t.open}</Link>
                </div>
              ))}
              {approvalsShown.map(r => (
                <div key={`${r.documentId}-${r.round}`} className="panel-row">
                  <div className="panel-main">
                    <Link className="panel-name" href="/approvals">{approvalTitles.get(r.documentId) ?? r.documentId}</Link>
                    <div className="quiet panel-meta">{t.submittedBy(r.submittedBy)}</div>
                  </div>
                  <Link className="panel-action" href="/approvals">{t.decide}</Link>
                </div>
              ))}
              {/* Odkaz na celý zoznam v pätičke (SHELL-rozcestnik, 4a); počet len keď panel niečo skrýva. */}
              <div className="panel-foot">
                <Link href="/documents">{tasksHidden ? t.showAll(tasksTotal) : t.allTasks}</Link>
              </div>
            </section>
          </div>
        </section>

        <section className="section-group" aria-labelledby="documents">
          <h2 className="section-group-title" id="documents">{t.documentsHeading}</h2>
          <div className="overview-panels">
            <section className="card panel">
              <div className="panel-head">
                <span>{t.documentsHeading}</span>
                {documents.length > 0 && <span className="panel-head-count">{documents.length}</span>}
              </div>
              {documents.length === 0 && (
                <div className="panel-empty">
                  <span className="panel-empty-title">{t.emptyDocumentsTitle}</span>
                  <span className="panel-empty-text">{t.emptyDocumentsText}</span>
                </div>
              )}
              {documentsShown.map(r => (
                <div key={r.key} className="panel-row">
                  <div className="panel-main">
                    <Link className="panel-name" href={r.href}>{r.title}</Link>
                    <div className="quiet panel-meta">
                      {[r.category ? kindLabel(r.category) : null, r.versionLabel, t.effectiveFromMeta(formatDate(r.effectiveFrom, language))]
                        .filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {/* Chip nesie to, čo kedysi dlaždice „Nové" a „Expiruje"; nová aj končiaca naraz ukáže koniec — to je naliehavejšie. */}
                  {r.expiring
                    ? <span className="due-chip due-chip--soon">{t.expiringChip}</span>
                    : r.isNew && <span className="tag tag--new">{t.newChip}</span>}
                  {/* Otázka nad jedným dokumentom (D269); nad predpisom zatiaľ nad celou Legislatívou. */}
                  <Link className="panel-action" href={r.askHref}>{t.ask}</Link>
                </div>
              ))}
              {/* Knižnica na čítanie je pre každého (30. 9. 2026); správca v nej vidí správu obsahu. */}
              <div className="panel-foot">
                <Link href="/library">{documents.length > documentsShown.length ? t.showAll(documents.length) : t.documentsAll}</Link>
              </div>
            </section>
          </div>
        </section>

        {/* Rozcestník: Organizácia pre každého, Správa rolám. Nadpisy skupín
            nesú kotvu pre krok skupiny v ceste (`/#management`). */}
        <SectionTiles groups={sections} language={language} />
      </div>
    </AppShell>
  )
}
