/**
 * Prehľad — `docs/design/README.md`, časť 2.
 *
 * **Postavené proti návrhu, nie proti mojej predstave.** Zoznam prvkov,
 * poradie aj obsah dlaždíc sú zo špecifikácie; kde sa odchyľujem, je to
 * napísané pri tom mieste.
 *
 * Jedna odchýlka, vecná:
 *
 * 1. **Dlaždica „Čaká na schválenie" počíta to, čo čaká na *mňa*.** Návrh
 *    píše „moje" a odkazuje na `/approvals`; číslo z celej organizácie by na
 *    obrazovke „čo odo mňa niekto čaká" nesedelo s tým, čo po kliknutí uvidím.
 *
 * Žiadna dlaždica si svoje číslo nepočíta po svojom: povinnosti sú
 * z `pendingForPerson()`, kolá z `roundsWaitingFor()` — z tých istých funkcií,
 * ktoré kreslia obrazovky, na ktoré dlaždice odkazujú.
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
import { libraryNews, expiringVersions, recentLibrary, NEW_DAYS, EXPIRING_DAYS } from "@/lib/overview"
import { sourcesRegister } from "@/lib/sourcesRegister"
import { subscribedActs, SLOV_LEX_SOURCE_ID } from "@/lib/lawCatalog"
import { dueState } from "@/lib/due"

export const dynamic = "force-dynamic"

/*
 * Dlaždica KPI. Typ je napísaný, nie odvodený z `as const`: pri odvodení má
 * každá dlaždica vlastný tvar a `tile.tone` neexistuje na tých, ktoré ho
 * nemajú — TypeScript to hlási a mal by pravdu, lebo šablóna s ním počíta.
 */
/** Riadky v paneloch „Čo máte k dispozícii" — toľko, koľko má panel Pre vás. */
const AVAILABLE_ROWS = 6

interface Tile {
  key: string
  href: string
  value: number
  note?: string
  tone?: "bad" | "warn"
}

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

  /*
    Kontrola súladu bola od 13. 10. 2026 piata dlaždica tohto pásu; od 21. 10.
    je dlaždica v Správe s počtom požiadaviek (`navData.ts`) — pás ostáva
    povinnostiam a novinkám.
  */
  const [pending, approvals, news, expiring, nav, available, register] = await Promise.all([
    pendingForPerson(person),
    roundsWaitingFor(person.companyCode, person.email),
    libraryNews(person.companyCode),
    expiringVersions(person.companyCode),
    // Tie isté roly a počty ako shell — `cache()`, takže bez dotazov navyše.
    shellNavData(),
    recentLibrary(person.companyCode, AVAILABLE_ROWS),
    // Ten istý register ako Organizácia → Zdroje a výber zdrojov na Opýtať sa (ADR-040).
    sourcesRegister(person.companyCode, language),
  ])
  /*
    „Čo máte k dispozícii" (Ján 26. 10. 2026): odkiaľ asistent odpovedá —
    knižnica, legislatíva zo Slov-Lexu a pripojené systémy. Zdroj sa ukáže,
    len keď z neho dnes naozaj ide odpovedať: zapnutý, pripojený, dovolený
    rezidenciou a s hľadaním — presne tak, ako ho filtruje výber na Opýtať sa.
    Prihlásená osoba organizácie je `internal` (`accessLevelFor()`), interné
    zdroje sú pre ňu v poriadku.
  */
  const liveSources = register.filter(s => s.kind !== "file" && s.enabled && s.connected && s.allowed && s.uses.retrieval)
  const lawSource = liveSources.find(s => s.id === SLOV_LEX_SOURCE_ID) ?? null
  const acts = lawSource ? await subscribedActs(person.companyCode) : []
  const connectors = liveSources.filter(s => s.id !== SLOV_LEX_SOURCE_ID)
  const sourcesTotal = acts.length + connectors.length
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

  const now = new Date()
  /*
    Podtitul dlaždice „Na potvrdenie" je v návrhu „2 do piatku" — teda koľko
    z toho horí. Počítame to z termínov, ktoré položky nesú, nie z počtu dní
    od pridelenia: prah pripomienok nie je termín daný človeku (D61).
  */
  const soon = pending.items.filter(i => {
    const s = dueState(i.due, now)
    return s === "soon" || s === "over"
  }).length

  const tiles: Tile[] = [
    {
      key: "toAcknowledge",
      href: "/documents",
      value: pending.total,
      note: soon > 0 ? t.soonNote(soon) : undefined,
      tone: soon > 0 ? "bad" : undefined,
    },
    { key: "toApprove", href: "/approvals", value: approvals.length, note: t.mine },
    { key: "new", href: "/library", value: news.length, note: t.newNote(NEW_DAYS) },
    {
      key: "expiring",
      href: "/library",
      value: expiring.length,
      note: t.expiringNote(EXPIRING_DAYS),
      tone: expiring.length > 0 ? "warn" : undefined,
    },
  ]

  /*
    Stropy riadkov v paneloch (PREHLAD, úloha 3). Pozornosť: schválenia
    najviac 2, povinnosti doplnia zvyšok do 6 — inak pri deviatich
    povinnostiach schválenie nikto neuvidí, hoci je to rozhodnutie, ktoré
    blokuje druhých ľudí. Odkaz na celý zoznam sa kreslí len keď panel
    niečo skrýva.
  */
  const PANEL_ROWS = 6
  const approvalsShown = approvals.slice(0, 2)
  const dutiesShown = pending.items.slice(0, PANEL_ROWS - approvalsShown.length)
  const attentionTotal = pending.items.length + approvals.length
  const attentionHidden = attentionTotal > dutiesShown.length + approvalsShown.length
  const newsShown = news.slice(0, 6)
  const expiringShown = expiring.slice(0, 4)
  const newsTotal = news.length + expiring.length

  return (
    <AppShell language={language}>
      <div className="overview" style={tenantStyle(branding)}>
        {/* Oslovenie. Pole otázky tu už nie je (ASK-otazka-z-hlavicky, Q3):
            otázka sa kladie v hlavičke — jedno pole, jedno miesto. */}
        <h1 className="page-title overview-hello">{t.hello(person.fullName)}</h1>

        {/* KPI pás. Každá dlaždica je odkaz na predfiltrovaný zoznam — číslo
            bez cesty k nemu je ozdoba. */}
        <div className="kpi">
          {tiles.map(tile => (
            <Link key={tile.key} className="card kpi-tile" href={tile.href}>
              <span className="kpi-label">{t.tiles[tile.key]}</span>
              {/* Nula je tichá a tón sa pri nej nepoužije — nula nie je
                  červená (PREHLAD, úloha 2). */}
              <span
                className={`kpi-value${
                  tile.value === 0 ? " kpi-value--zero" : tile.tone ? ` kpi-value--${tile.tone}` : ""
                }`}
              >
                {tile.value}
              </span>
              {tile.note && <span className="quiet kpi-note">{tile.note}</span>}
            </Link>
          ))}
        </div>

        {/*
          Čo máte k dispozícii (Ján 26. 10. 2026): nad rozcestníkom, aby každý
          videl, z akého obsahu asistent odpovedá, skôr než sa pýta. Dva
          panely v tej istej mriežke ako Pre vás — knižnica a ostatné zdroje;
          tri panely by v dvojstĺpcovej mriežke nechali prázdne miesto.
          Otázka nad jedným dokumentom zatiaľ nie je (rozsah je len zdroj),
          preto má riadok dokumentu len odkaz na znenie.
        */}
        <section className="section-group" aria-labelledby="available">
          <h2 className="section-group-title" id="available">{t.available.heading}</h2>
          <div className="overview-panels">
            <section className="card panel">
              <div className="panel-head">
                <span>{t.available.library}</span>
                {available.total > 0 && <span className="panel-head-count">{available.total}</span>}
              </div>
              {available.recent.length === 0 && (
                <div className="panel-empty">
                  <span className="panel-empty-title">{t.available.emptyLibraryTitle}</span>
                  <span className="panel-empty-text">{t.available.emptyLibraryText}</span>
                </div>
              )}
              {available.recent.map(r => (
                <div key={`avail-${r.documentId}`} className="panel-row">
                  <div className="panel-main">
                    <Link className="panel-name" href={`/documents/${encodeURIComponent(r.documentId)}`}>{r.title}</Link>
                    <div className="quiet panel-meta">{r.versionLabel} · {formatDate(r.publishedAt, language)}</div>
                  </div>
                  {/* Otázka len nad týmto dokumentom (ADR-029 D269). */}
                  <Link className="panel-action" href={`/ask?${new URLSearchParams({ src: "library", doc: r.documentId }).toString()}`}>{t.available.ask}</Link>
                  <Link className="panel-action" href={`/documents/${encodeURIComponent(r.documentId)}`}>{t.open}</Link>
                </div>
              ))}
              {/* Správca obsahu ide do Knižnice, ostatní sa jej opýtajú — na 404 by skončili. */}
              <div className="panel-foot">
                {nav.flags.isContentManager
                  ? <Link href="/library">{t.wholeLibrary}</Link>
                  : <Link href={`/ask?${new URLSearchParams({ src: "library" }).toString()}`}>{t.available.askLibrary}</Link>}
              </div>
            </section>

            <section className="card panel">
              <div className="panel-head">
                <span>{t.available.sources}</span>
                {sourcesTotal > 0 && <span className="panel-head-count">{sourcesTotal}</span>}
              </div>
              {sourcesTotal === 0 && (
                <div className="panel-empty">
                  <span className="panel-empty-title">{t.available.emptySourcesTitle}</span>
                  <span className="panel-empty-text">{t.available.emptySourcesText}</span>
                </div>
              )}
              {acts.map(a => (
                <div key={`act-${a.actId}`} className="panel-row">
                  <div className="panel-main">
                    {/* Detail predpisu je v nastaveniach organizácie (správca osôb); ostatným znenie ukáže portál. */}
                    {/* Čitateľská adresa predpisu pre každého (ADR-041 D273); správa zdroja je odtiaľ tichým odkazom. */}
                    <Link className="panel-name" href={`/documents/law/${a.actId}`}>{a.title}</Link>
                    <div className="quiet panel-meta">
                      {t.available.kindLaw}{a.current ? ` · ${t.available.actEffective(formatDate(a.current.effectiveFrom, language))}` : ""}
                    </div>
                  </div>
                  <Link className="panel-action" href={`/ask?${new URLSearchParams({ src: SLOV_LEX_SOURCE_ID }).toString()}`}>{t.available.ask}</Link>
                </div>
              ))}
              {connectors.map(c => (
                <div key={`src-${c.id}`} className="panel-row">
                  <div className="panel-main">
                    <span className="panel-name">{c.name}</span>
                    <div className="quiet panel-meta">{t.available.kindConnector}{c.detail ? ` · ${c.detail}` : ""}</div>
                  </div>
                  <Link className="panel-action" href={`/ask?${new URLSearchParams({ src: c.id }).toString()}`}>{t.available.ask}</Link>
                </div>
              ))}
              <div className="panel-foot">
                {nav.flags.isPeopleAdmin
                  ? <Link href="/organisation/sources">{t.available.register}</Link>
                  : <Link href="/ask">{t.available.askAll}</Link>}
              </div>
            </section>
          </div>
        </section>

        {/* Rozcestník: pod KPI sekcie, pod nimi „Pre vás". Nadpisy skupín
            nesú kotvu pre krok skupiny v ceste (`/#management`). */}
        <SectionTiles groups={sections} language={language} />

        <section className="section-group" aria-labelledby="for-you">
          <h2 className="section-group-title" id="for-you">{t.forYou}</h2>
          <div className="overview-panels">
            <section className="card panel">
              <div className="panel-head">
                <span>{t.attention}</span>
                {attentionTotal > 0 && <span className="panel-head-count">{attentionTotal}</span>}
              </div>
              {/*
                Prázdno až vtedy, keď je prázdny celý panel — dovtedy sa veta
                „nič nečaká" kreslila aj nad riadkom schválenia. Dva riadky
                (PREHLAD, úloha 1): čo tu nie je a čo z toho vyplýva.
              */}
              {pending.items.length === 0 && approvals.length === 0 && (
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
              {/*
                Odkaz na celý zoznam v pätičke (SHELL-rozcestnik, 4a) — oba
                panely ho majú na tom istom mieste dole, rovnako vysoké karty
                tak lícujú. Počet v ňom len keď panel niečo skrýva (úloha 3).
              */}
              <div className="panel-foot">
                <Link href="/documents">{attentionHidden ? t.showAll(attentionTotal) : t.allTasks}</Link>
              </div>
            </section>

            <section className="card panel">
              <div className="panel-head">
                <span>{t.news}</span>
                {newsTotal > 0 && <span className="panel-head-count">{newsTotal}</span>}
              </div>
              {news.length === 0 && expiring.length === 0 && (
                <div className="panel-empty">
                  <span className="panel-empty-title">{t.empty.newsTitle(NEW_DAYS)}</span>
                  <span className="panel-empty-text">{t.empty.newsText}</span>
                </div>
              )}
              {newsShown.map(n => (
                <div key={`${n.documentId}-${n.versionLabel}`} className="panel-row">
                  <div className="panel-main">
                    <Link className="panel-name" href={`/documents/${encodeURIComponent(n.documentId)}`}>
                      {n.title}
                    </Link>
                    <div className="quiet panel-meta">
                      {n.versionLabel} · {formatDate(n.publishedAt, language)}
                    </div>
                  </div>
                </div>
              ))}
              {/*
                Expirujúce znenia sú v tom istom paneli, nie vo vlastnom: je to
                tá istá otázka („čo sa v knižnici deje"), len z druhej strany.
                Vlastný panel pre dva riadky by bol prázdny priestor.
              */}
              {expiringShown.map(e => (
                <div key={`exp-${e.documentId}-${e.versionLabel}`} className="panel-row">
                  <div className="panel-main">
                    <Link className="panel-name" href={`/documents/${encodeURIComponent(e.documentId)}`}>
                      {e.title}
                    </Link>
                    <div className="quiet panel-meta">{t.until(formatDate(e.effectiveTo, language))}</div>
                  </div>
                  <span className="due-chip due-chip--soon">{t.expiringChip}</span>
                </div>
              ))}
              {/* Knižnica je obrazovka správy obsahu — ostatným by odkaz
                  skončil na 404. */}
              {nav.flags.isContentManager && (
                <div className="panel-foot">
                  <Link href="/library">{t.wholeLibrary}</Link>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </AppShell>
  )
}
