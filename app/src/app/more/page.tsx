/**
 * /more — celé menu (SHELL-menu-v-hlavicke, Q4).
 *
 * Ten istý obsah ako plachta 9 bodiek v hlavičke a spodná plachta „Menu"
 * na telefóne: Hlavné · Organizácia · Správa (`menuGroups()`), ako dlaždice
 * (`SectionTiles`) v jednom stĺpci. So skriptom sa sem z lišty nechodí —
 * „Menu" otvorí plachtu; bez skriptu je to cieľ jeho odkazu a adresa
 * funguje aj priamo.
 *
 * Osobné veci (príručka, moje potvrdenia, odhlásenie) tu nie sú — bývajú
 * pod avatarom v hlavičke, a dve položky s tým istým cieľom sú horšie než
 * jedna.
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
    <AppShell language={person.language} title={t.menu}>
      {/* Užšie než shell: je to zoznam na palec, nie tabuľka. */}
      <div style={{ maxWidth: 560 }}>
        <h1 className="page-title" style={{ margin: "0 0 14px" }}>
          {t.menu}
        </h1>
        <SectionTiles groups={groups} language={person.language} single />
      </div>
    </AppShell>
  )
}
