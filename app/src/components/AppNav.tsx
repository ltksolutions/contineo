"use client"

/**
 * AppNav — spodná lišta na telefóne (NASADENIE, PR 2).
 *
 * Pod 640 px: **Prehľad · Knižnica · Vzdelávanie · Úlohy · Menu**, u každého
 * rovnaká (SHELL-menu-v-hlavicke, Q5, 30. 9. 2026). „Úlohy" zlučujú „Na
 * potvrdenie" a „Na schválenie" (súčet v odznaku). „Menu" otvorí spodnú
 * plachtu s celým menu (`BottomMenu`) — bez skriptu je to odkaz na `/more`
 * s tým istým obsahom. Odznak na „Menu" je súčet počtov sekcií mimo lišty.
 *
 * **Od 640 px stále menu nie je** (SHELL-rozcestnik, Q1). Sekcie sú dlaždice
 * na Prehľade a plachta 9 bodiek v hlavičke.
 *
 * Zoznam položiek a čisté funkcie sú v `lib/appNav.ts`, nie tu: z modulu
 * s `"use client"` sa funkcia na serveri volať nedá.
 */

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import Icon from "./Icon"
import { BottomMenu, type MenuLabels } from "./SectionsSheet"
import { usePathname } from "next/navigation"
import { navItems, tabbarItems, isTabActive, type SheetColumn } from "@/lib/appNav"
import type { NavFlags, NavCounts } from "@/lib/appNav"
import { dictionary, type UiLanguage } from "@/lib/i18n"

/** `useSyncExternalStore` bez odberu — len rozlíšenie server / prehliadač. */
const noop = () => () => {}

export default function AppNav({
  flags,
  counts,
  language,
  columns,
  labels,
}: {
  flags: NavFlags
  counts?: NavCounts
  language?: UiLanguage
  /** Celé menu pre spodnú plachtu — z `menuColumns()` na serveri. */
  columns: SheetColumn[]
  labels: MenuLabels
}) {
  const t = dictionary(language).nav
  const pathname = usePathname()
  const tabs = tabbarItems(navItems(flags, counts))
  const ready = useSyncExternalStore(noop, () => true, () => false)
  /*
   * Plachta je otvorená pre stránku, na ktorej sa otvorila — zmena stránky
   * ju tak zavrie bez efektu, ktorý by nastavoval stav.
   */
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname

  return (
    <>
      <nav className="app-nav-tabbar" aria-label={t.sections}>
        {tabs.map(tab => {
          const menu = tab.key === "menu"
          const active = menu ? open || (!openOn && isTabActive(pathname, tab)) : !open && isTabActive(pathname, tab)
          const n = typeof tab.count === "number" && tab.count > 0 ? tab.count : 0
          const body = (
            <>
              <span className="app-nav-tab-icon">
                {/* Ikona „Úloh" je zaškrtávacie políčko z „Na potvrdenie",
                    „Menu" má 9 bodiek ako plachta v hlavičke. */}
                <Icon name={tab.key === "tasks" ? "toAcknowledge" : menu ? "grid" : tab.key} size={21} />
                {/* Nula sa nekreslí — štítok s nulou je šum, nie informácia. */}
                {n > 0 && (
                  <span className="app-nav-count" aria-label={t.waiting(n)}>
                    {n}
                  </span>
                )}
              </span>
              {t[tab.key]}
            </>
          )
          if (menu) {
            return (
              <a
                key={tab.key}
                href={tab.href}
                className={`app-nav-tab${active ? " is-active" : ""}`}
                // So skriptom tlačidlo, bez neho odkaz na `/more`.
                role={ready ? "button" : undefined}
                aria-expanded={ready ? open : undefined}
                aria-controls={ready ? "bottom-menu" : undefined}
                onClick={e => {
                  e.preventDefault()
                  setOpenOn(open ? null : pathname)
                }}
              >
                {body}
              </a>
            )
          }
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`app-nav-tab${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {body}
            </Link>
          )
        })}
      </nav>
      {open && <BottomMenu columns={columns} labels={labels} onClose={() => setOpenOn(null)} />}
    </>
  )
}
