"use client"

/**
 * AppNav — spodná lišta na telefóne (NASADENIE, PR 2).
 *
 * Pod 640 px: Prehľad · Opýtať sa · Knižnica · Úlohy · Viac. „Úlohy"
 * zlučujú „Na potvrdenie" a „Na schválenie" (súčet v odznaku), „Viac"
 * vedie na `/more` so zvyškom sekcií.
 *
 * **Od 640 px stále menu nie je** (SHELL-rozcestnik, 29. 9. 2026, Q1).
 * Sekcie sú dlaždice na Prehľade, na podstránke je pod hlavičkou cesta
 * s plachtou všetkých sekcií (`Breadcrumbs`, `SectionsSheet`). Pás
 * `topbar` aj bočný panel odišli — dve navigácie boli dvojnásobná údržba
 * a panel bral obsahu šírku.
 *
 * Zoznam položiek a čisté funkcie sú v `lib/appNav.ts`, nie tu: z modulu
 * s `"use client"` sa funkcia na serveri volať nedá a `/more` aj
 * `AppShell` ich potrebujú na serveri.
 */

import Link from "next/link"
import Icon from "./Icon"
import { usePathname } from "next/navigation"
import { navItems, tabbarItems, isTabActive } from "@/lib/appNav"
import type { NavFlags, NavCounts } from "@/lib/appNav"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function AppNav({
  flags,
  counts,
  language,
}: {
  flags: NavFlags
  counts?: NavCounts
  language?: UiLanguage
}) {
  const t = dictionary(language).nav
  const pathname = usePathname()
  const tabs = tabbarItems(navItems(flags, counts))

  /*
   * Ikona „Úloh" je zaškrtávacie políčko z „Na potvrdenie" — v lište nie sú
   * obe naraz, takže sa kresba nebije; na `/more` má schvaľovanie svoju
   * pečať.
   */
  return (
    <nav className="app-nav-tabbar" aria-label={t.sections}>
      {tabs.map(tab => {
        const active = isTabActive(pathname, tab)
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`app-nav-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="app-nav-tab-icon">
              <Icon name={tab.key === "tasks" ? "toAcknowledge" : tab.key} size={21} />
              {/* Nula sa nekreslí — štítok s nulou je šum, nie informácia. */}
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className="app-nav-count" aria-label={t.waiting(tab.count)}>
                  {tab.count}
                </span>
              )}
            </span>
            {t[tab.key]}
          </Link>
        )
      })}
    </nav>
  )
}
