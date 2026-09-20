/**
 * /more — zvyšok navigácie na telefóne (NASADENIE, PR 2).
 *
 * Spodná lišta má štyri sekcie a „Viac"; sem padá zvyšok `navItems()`
 * v skupinách so sadzbou na palec (riadky 52 px). Na širokej obrazovke
 * stránka existuje tiež — adresa je adresa a otočením tabletu sa nemá
 * rozbiť — len sa na ňu z pásu nechodí: pás má prepad „Viac N" v sebe.
 *
 * Osobné veci (príručka, moje potvrdenia, odhlásenie) tu nie sú — bývajú
 * pod avatarom v hlavičke, ktorá na telefóne zostáva, a dve položky s tým
 * istým cieľom sú horšie než jedna.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import AppShell from "@/components/AppShell"
import Icon from "@/components/Icon"
import { navItems, moreGroups, normalizeLayout } from "@/lib/appNav"
import { shellNavData } from "@/lib/navData"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ layout?: string }>(await searchParams)
  const ctx = await onboardingContext()

  // Rovnaká brána ako na ostatných prihlásených obrazovkách (D29).
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  // Kto nie je medzi osobami tenanta, nemá kam navigovať — vysvetlenie mu
  // dá domovská stránka, druhá kópia tej hlášky by sa s ňou raz rozišla.
  if (ctx.state === "not-in-tenant") redirect("/")

  const person = ctx.person
  const t = dictionary(person.language).nav
  const { flags, counts } = await shellNavData()
  const groups = moreGroups(navItems(flags, counts))

  return (
    <AppShell layout={normalizeLayout(q.layout)} language={person.language}>
      {/* Užšie než shell: je to zoznam odkazov, nie tabuľka. */}
      <div style={{ maxWidth: 560 }}>
        <h1 className="page-title" style={{ margin: "0 0 14px" }}>
          {t.more}
        </h1>

        {groups.map(group => (
          <section key={group.key} className="more-group">
            <h2 className="more-group-title">
              {group.key === "organisation" ? t.groupOrganisation : t.groupManagement}
            </h2>
            <div className="more-list">
              {group.items.map(o => (
                <Link key={o.href} href={o.href} className="more-row">
                  <Icon name={o.key} size={18} />
                  <span className="more-row-label">{t[o.key]}</span>
                  {typeof o.count === "number" && o.count > 0 && (
                    <span className="app-nav-count" aria-label={t.waiting(o.count)}>
                      {o.count}
                    </span>
                  )}
                  {/* Šípka je ozdoba — smer „dovnútra" hovorí riadok sám. */}
                  <span className="more-row-chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  )
}
