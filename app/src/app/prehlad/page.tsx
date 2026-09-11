/**
 * Prehľad — `docs/design/README.md`, časť 2.
 *
 * **Postavené proti návrhu, nie proti mojej predstave.** Zoznam prvkov,
 * poradie aj obsah dlaždíc sú zo špecifikácie; kde sa odchyľujem, je to
 * napísané pri tom mieste.
 *
 * Dve odchýlky, obe vecné:
 *
 * 1. **Adresa je `/prehlad`, nie `/`.** Návrh dáva Prehľad na `/`, kde je dnes
 *    obrazovka „Opýtať sa". Presunúť prvú obrazovku, ktorú človek vidí po
 *    kliknutí na prihlasovací odkaz, je zmena prevádzky — patrí rozhodnutiu,
 *    nie tichému commitu. Kým sa nerozhodne, žijú vedľa seba.
 * 2. **Dlaždica „Čaká na schválenie" počíta to, čo čaká na *mňa*.** Návrh
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
import { normalizeLayout } from "@/lib/appNav"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate } from "@/lib/i18n"
import { pendingForPerson } from "@/lib/pending"
import { roundsWaitingFor, documentTitles } from "@/lib/approvalsDb"
import { libraryNews, expiringVersions, NEW_DAYS, EXPIRING_DAYS } from "@/lib/overview"
import { dueState } from "@/lib/due"

export const dynamic = "force-dynamic"

/*
 * Dlaždica KPI. Typ je napísaný, nie odvodený z `as const`: pri odvodení má
 * každá dlaždica vlastný tvar a `tile.tone` neexistuje na tých, ktoré ho
 * nemajú — TypeScript to hlási a mal by pravdu, lebo šablóna s ním počíta.
 */
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
  const q = normalizeQuery<{ layout?: string }>(await searchParams)
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state === "not-in-tenant") notFound()

  const person = ctx.person
  const branding = brandingView(ctx.tenant)
  const language = person.language
  const t = dictionary(language).overview

  const [pending, approvals, news, expiring] = await Promise.all([
    pendingForPerson(person),
    roundsWaitingFor(person.companyCode, person.email),
    libraryNews(person.companyCode),
    expiringVersions(person.companyCode),
  ])

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

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={language}>
      <div className="overview" style={tenantStyle(branding)}>
        {/*
          Hero. Otázka odchádza na obrazovku odpovedí — Prehľad je vstup do
          hľadania, nie miesto, kde sa odpovedá. Obyčajný `GET`, teda funguje
          bez JavaScriptu, rovnako ako pole v hlavičke.
        */}
        <section className="card overview-hero">
          <h1 className="overview-hello">{t.hello(person.fullName)}</h1>
          <p className="quiet overview-lede">{t.lede}</p>
          <form className="overview-ask" method="get" action="/">
            <input
              className="field-input overview-ask-input"
              type="search"
              name="q"
              placeholder={t.askPlaceholder}
              aria-label={t.askPlaceholder}
            />
            <button className="button" type="submit">{t.ask}</button>
          </form>
          <div className="overview-suggestions">
            {t.suggestions.map(s => (
              <Link key={s} className="overview-suggestion" href={`/?q=${encodeURIComponent(s)}`}>
                {s}
              </Link>
            ))}
          </div>
        </section>

        {/* KPI pás. Každá dlaždica je odkaz na predfiltrovaný zoznam — číslo
            bez cesty k nemu je ozdoba. */}
        <div className="kpi">
          {tiles.map(tile => (
            <Link key={tile.key} className="card kpi-tile" href={tile.href}>
              <span className="kpi-label">{t.tiles[tile.key]}</span>
              <span className={`kpi-value${tile.tone ? ` kpi-value--${tile.tone}` : ""}`}>
                {tile.value}
              </span>
              {tile.note && <span className="quiet kpi-note">{tile.note}</span>}
            </Link>
          ))}
        </div>

        <div className="overview-panels">
          <section className="card panel">
            <div className="panel-head">{t.attention}</div>
            {pending.items.length === 0 && <p className="panel-empty quiet">{t.nothingPending}</p>}
            {pending.items.slice(0, 6).map(i => (
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
            {approvals.slice(0, 3).map(r => (
              <div key={`${r.documentId}-${r.round}`} className="panel-row">
                <div className="panel-main">
                  <Link className="panel-name" href="/approvals">{approvalTitles.get(r.documentId) ?? r.documentId}</Link>
                  <div className="quiet panel-meta">{t.submittedBy(r.submittedBy)}</div>
                </div>
                <Link className="panel-action" href="/approvals">{t.decide}</Link>
              </div>
            ))}
          </section>

          <section className="card panel">
            <div className="panel-head">{t.news}</div>
            {news.length === 0 && <p className="panel-empty quiet">{t.nothingNew}</p>}
            {news.slice(0, 6).map(n => (
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
            {expiring.slice(0, 4).map(e => (
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
          </section>
        </div>
      </div>
    </AppShell>
  )
}
