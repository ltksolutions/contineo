/**
 * /more — zvyšok navigácie na telefóne (NASADENIE, PR 2).
 *
 * Spodná lišta má štyri sekcie a „Viac"; sem padá zvyšok `navItems()`.
 * Od 29. 9. 2026 sú to **tie isté dlaždice ako na Prehľade**
 * (`SectionTiles`, SHELL-rozcestnik Q4) v jednom stĺpci — rovnaké poradie,
 * názvy aj popisy. Na širokej obrazovke stránka existuje tiež — adresa je
 * adresa a otočením tabletu sa nemá rozbiť.
 *
 * Osobné veci (príručka, moje potvrdenia, odhlásenie) tu nie sú — bývajú
 * pod avatarom v hlavičke, ktorá na telefóne zostáva, a dve položky s tým
 * istým cieľom sú horšie než jedna.
 */

import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import AppShell from "@/components/AppShell"
import SectionTiles from "@/components/SectionTiles"
import { navItems, moreGroups } from "@/lib/appNav"
import { shellNavData } from "@/lib/navData"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export default async function MorePage() {
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
    <AppShell language={person.language} title={t.more}>
      {/* Užšie než shell: je to zoznam na palec, nie tabuľka. */}
      <div style={{ maxWidth: 560 }}>
        <h1 className="page-title" style={{ margin: "0 0 14px" }}>
          {t.more}
        </h1>
        <SectionTiles groups={groups} language={person.language} single />
      </div>
    </AppShell>
  )
}
