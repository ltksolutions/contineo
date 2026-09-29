"use client"

/**
 * SectionsSheet — tlačidlo 9 bodiek na začiatku pásu cesty a plachta so
 * všetkými sekciami (SHELL-rozcestnik, Q5).
 *
 * Stále menu od 640 px nie je; toto je rýchle prepnutie bez návratu na
 * Prehľad — dva kliky. Stĺpce Hlavné · Organizácia · Správa, počty ako
 * odznaky, aktuálna sekcia zvýraznená. Popisy sekcií tu nie sú, tie nesú
 * dlaždice na Prehľade.
 *
 * **Bez JavaScriptu** je to `<details>`: otvorí aj zavrie ho klik na
 * tlačidlo. Skript pridá zavretie Esc, klikom mimo, výberom a zmenou
 * stránky a návrat fokusu na tlačidlo.
 *
 * Položky prichádzajú hotové zo servera (`AppShell` — `navItems()`,
 * `sectionGroups()`), aj s popisom počtu pre čítačku: funkcia sa na
 * klienta poslať nedá.
 */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Icon from "./Icon"
import { activeHref, type NavKey } from "@/lib/appNav"

export interface SheetItem {
  href: string
  key: NavKey
  label: string
  count?: number
  /** „čakajú 3" — pre čítačku, holé číslo nič nehovorí. */
  countLabel?: string
}

export interface SheetColumn {
  key: string
  title: string
  items: SheetItem[]
}

/** Adresa bez dotazu — testy zodpovednej osoby majú `?tab=results`. */
const bare = (href: string) => href.split("?")[0]

export default function SectionsSheet({
  columns,
  labels,
}: {
  columns: SheetColumn[]
  labels: { allSections: string; escCloses: string; sheetHint: string }
}) {
  const pathname = usePathname()
  const current = activeHref(pathname, columns.flatMap(c => c.items.map(i => bare(i.href))))
  const sheet = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)

  const close = () => { if (sheet.current) sheet.current.open = false }

  // Zmena stránky zavrie plachtu — inak by visela nad novým obsahom.
  useEffect(() => { if (sheet.current) sheet.current.open = false }, [pathname])

  // Esc a klik mimo zavrú otvorenú plachtu.
  useEffect(() => {
    if (!open) return
    const d = sheet.current
    if (!d) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") d.open = false }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (d.querySelector(".sections-sheet")?.contains(target)) return
      if (d.querySelector("summary")?.contains(target)) return
      d.open = false
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [open])

  // Fokus do plachty pri otvorení, späť na tlačidlo pri zavretí — ale len
  // keď bol v plachte; kto medzitým klikol inam, tomu sa fokus nepresúva.
  const onToggle = () => {
    const d = sheet.current
    if (!d) return
    setOpen(d.open)
    if (d.open) {
      d.querySelector<HTMLAnchorElement>(".sections-sheet a")?.focus()
    } else if (d.contains(document.activeElement) || document.activeElement === document.body) {
      d.querySelector("summary")?.focus()
    }
  }

  return (
    <details ref={sheet} className="sections" onToggle={onToggle}>
      <summary
        className="sections-button"
        aria-label={labels.allSections}
        title={labels.allSections}
        aria-controls="all-sections"
        aria-expanded={open}
      >
        <Icon name="grid" size={18} />
      </summary>
      <div className="sections-scrim" aria-hidden="true" onClick={close} />
      <nav className="sections-sheet" id="all-sections" aria-label={labels.allSections}>
        {columns.map(col => (
          <div key={col.key} className="sections-col">
            <h2 className="sections-col-title">{col.title}</h2>
            {col.items.map(o => {
              const on = bare(o.href) === current
              const n = typeof o.count === "number" && o.count > 0 ? o.count : 0
              return (
                <Link
                  key={o.href}
                  href={o.href}
                  className={`sections-item${on ? " is-active" : ""}`}
                  aria-current={on ? "page" : undefined}
                  // Výber zavrie plachtu aj vtedy, keď sa stránka nezmení
                  // (klik na sekciu, v ktorej človek už je).
                  onClick={close}
                >
                  <Icon name={o.key} size={17} />
                  <span className="sections-item-label">{o.label}</span>
                  {n > 0 && <span className="sections-item-count" aria-label={o.countLabel}>{n}</span>}
                </Link>
              )
            })}
          </div>
        ))}
        <div className="sections-foot">
          <span><kbd>Esc</kbd> {labels.escCloses}</span>
          <Link href="/" onClick={close}>{labels.sheetHint}</Link>
        </div>
      </nav>
    </details>
  )
}
