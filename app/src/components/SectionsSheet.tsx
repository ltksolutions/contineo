"use client"

/**
 * SectionsSheet — plachta celého menu (SHELL-rozcestnik, SHELL-menu-v-hlavicke).
 *
 * Od 30. 9. 2026 je tlačidlo 9 bodiek **v hlavičke vľavo pred logom** na
 * každej stránke vrátane Prehľadu (Q1 A) — dovtedy bolo v páse cesty, takže
 * na Prehľade chýbalo. Na telefóne ten istý obsah otvára posledná položka
 * lišty „Menu" ako spodnú plachtu (`BottomMenu`).
 *
 * Obsah je jeden (`MenuPanel`): stĺpce Hlavné · Organizácia · Správa,
 * počty ako odznaky, aktuálna sekcia zvýraznená. Položky prichádzajú hotové
 * zo servera (`menuColumns()`), aj s popisom počtu pre čítačku.
 *
 * **Bez JavaScriptu** je plachta v hlavičke `<details>` — otvorí aj zavrie ju
 * tlačidlo. „Menu" na telefóne je bez skriptu odkaz na `/more`.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Icon from "./Icon"
import { activeHref, type SheetColumn } from "@/lib/appNav"

export type { SheetColumn, SheetItem } from "@/lib/appNav"

export interface MenuLabels {
  allSections: string
  escCloses: string
  sheetHint: string
  close: string
}

/** Adresa bez dotazu — testy zodpovednej osoby majú `?tab=results`. */
const bare = (href: string) => href.split("?")[0]

/** Stĺpce menu — spoločné pre plachtu v hlavičke aj spodnú plachtu. */
export function MenuPanel({
  columns,
  labels,
  id,
  className,
  onPick,
}: {
  columns: SheetColumn[]
  labels: MenuLabels
  id: string
  className: string
  onPick: () => void
}) {
  const pathname = usePathname()
  const current = activeHref(pathname, columns.flatMap(c => c.items.map(i => bare(i.href))))
  return (
    <nav className={className} id={id} aria-label={labels.allSections}>
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
                onClick={onPick}
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
        <Link href="/" onClick={onPick}>{labels.sheetHint}</Link>
      </div>
    </nav>
  )
}

/**
 * Tlačidlo 9 bodiek v hlavičke a plachta pod ňou (≥ 640 px). Esc, klik
 * mimo, výber a zmena stránky zavrú; fokus ide do plachty a späť na tlačidlo.
 */
export default function SectionsSheet({ columns, labels }: { columns: SheetColumn[]; labels: MenuLabels }) {
  const pathname = usePathname()
  const sheet = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)

  const close = () => { if (sheet.current) sheet.current.open = false }

  // Zmena stránky zavrie plachtu — inak by visela nad novým obsahom.
  useEffect(() => { if (sheet.current) sheet.current.open = false }, [pathname])

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
    <details ref={sheet} className="sections header-menu" onToggle={onToggle}>
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
      <MenuPanel columns={columns} labels={labels} id="all-sections" className="sections-sheet" onPick={close} />
    </details>
  )
}

/**
 * Spodná plachta „Menu" na telefóne (SHELL-menu-v-hlavicke, bod 5). Nad
 * lištou, ktorá ostáva viditeľná; závoj medzi hlavičkou a lištou. Zavrie
 * „Menu" znova, ×, závoj, potiahnutie nadol, Esc, výber aj zmena stránky.
 */
export function BottomMenu({
  columns,
  labels,
  onClose,
}: {
  columns: SheetColumn[]
  labels: MenuLabels
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  useEffect(() => {
    const from = document.activeElement
    panel.current?.querySelector<HTMLElement>(".bottom-menu-close")?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      ;(from as HTMLElement | null)?.focus?.()
    }
  }, [])

  // Potiahnutie nadol za úchyt alebo hlavičku plachty: od 80 px zavrie,
  // inak sa plachta vráti.
  const onPointerDown = (e: ReactPointerEvent) => {
    drag.current = { y: e.clientY, dy: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current || !panel.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    panel.current.style.transform = `translateY(${drag.current.dy}px)`
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!panel.current) return
    panel.current.style.transform = ""
    if (d && d.dy > 80) close.current()
  }

  return (
    <>
      <div className="bottom-menu-scrim" aria-hidden="true" onClick={() => close.current()} />
      <div ref={panel} className="bottom-menu" id="bottom-menu" role="dialog" aria-label={labels.allSections}>
        <div
          className="bottom-menu-head"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="bottom-menu-grip" aria-hidden="true" />
          <b>{labels.allSections}</b>
          <button type="button" className="bottom-menu-close" aria-label={labels.close} onClick={() => close.current()}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" aria-hidden="true">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
            </svg>
          </button>
        </div>
        <MenuPanel columns={columns} labels={labels} id="bottom-menu-list" className="bottom-menu-list" onPick={() => close.current()} />
      </div>
    </>
  )
}
