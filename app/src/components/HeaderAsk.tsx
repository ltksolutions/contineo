"use client"

/**
 * HeaderAsk — pole otázky v hlavičke (ASK-otazka-z-hlavicky).
 *
 * **Jediné miesto, kde sa otázka kladie** — ako vo vyhľadávači. Hero pole
 * na Prehľade aj vlastné pole na `/ask` odišli (Q3); robili to isté na troch
 * miestach.
 *
 * Bez JavaScriptu je to obyčajný `<form method="get" action="/ask">`
 * s `<input name="q">`, ako doteraz. So skriptom klik, fokus alebo `⌘K`
 * rozšíri pole na mieste do plachty (`AskSheet`) — dlhá otázka dostane
 * miesto tam, kde sa začala, a vysvetlenie, z čoho sa odpovedá, príde
 * v okamihu, keď ho človek potrebuje. Esc alebo klik mimo plachtu zavrie
 * a text v poli ostane.
 *
 * Na `/ask` nesie pole položenú otázku. „Upraviť otázku" na tej stránke je
 * `<label>` tohto poľa (`id="header-q"`): klik naň pole zameria, a tým
 * otvorí plachtu s otázkou — bez spoločného stavu medzi hlavičkou
 * v `layout.tsx` a stránkou.
 */

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import AskSheet from "./AskSheet"
import { ContineoMark } from "./ContineoMark"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export const HEADER_ASK_ID = "header-q"

export default function HeaderAsk({
  initial = "",
  organisation,
  kbdHint,
  language,
}: {
  /** Na `/ask` položená otázka, inde prázdne. */
  initial?: string
  organisation: string
  kbdHint: string
  language?: UiLanguage
}) {
  const t = dictionary(language)
  const [draft, setDraft] = useState(initial)
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  // Zavretie: text ostane v poli, fokus späť naň — bez toho, aby sa plachta
  // hneď znova otvorila (fokus ju otvára).
  const reopenGuard = useRef(false)
  const close = (value: string, submitted = false) => {
    setDraft(value)
    setOpen(false)
    if (submitted) return
    reopenGuard.current = true
    requestAnimationFrame(() => {
      input.current?.focus()
      reopenGuard.current = false
    })
  }

  /*
   * `⌘K` / `Ctrl+K` otvorí plachtu. Zrýchlenie, nie cesta: bez skriptu sa
   * do poľa dá kliknúť aj dostať tabulátorom.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      setOpen(true)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  // Klik mimo plachtu ju zavrie (závoj je mimo nej). Text ostane.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current?.contains(e.target as Node)) return
      const field = wrap.current?.querySelector("textarea")
      close(field?.value ?? draft)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  })

  const openSheet = () => { if (!reopenGuard.current) setOpen(true) }

  return (
    <div className="header-search-wrap" ref={wrap}>
      <form className="header-search" method="get" action="/ask" role="search">
        <span className="header-search-icon" aria-hidden="true">
          {/*
            Značka Continea, nie bublina `ask` (Q1, 30. 9. 2026). Do 22. 9.
            sa značka pri 16 px čítala ako lupa; odvtedy je prekreslená
            (chvostík zvisle, hrubší kruh) a v 18 px na oblom poli jej oči
            vidieť. `ZAKLAD.md`, odchýlka B je týmto zmenená.
          */}
          <ContineoMark size={18} />
        </span>
        <input
          ref={input}
          id={HEADER_ASK_ID}
          type="search"
          name="q"
          className="header-search-input"
          placeholder={t.nav.searchPlaceholder}
          aria-label={t.nav.searchLabel}
          autoComplete="off"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={openSheet}
          onClick={openSheet}
        />
        {/* Bez skriptu musí byť čím odoslať; Enter v poli robí to isté. */}
        <button type="submit" className="header-search-submit">{t.nav.searchSubmit}</button>
        <kbd className="header-search-kbd" aria-hidden="true">{kbdHint}</kbd>
      </form>

      {open && (
        <AskSheet
          mode="overlay"
          initial={draft}
          organisation={organisation}
          language={language}
          onClose={close}
        />
      )}
      {/* Závoj pod hlavičkou (tá má `z-index` 10, závoj 9) — hlavička ostáva
          nezatienená a plachta v nej je nad ním. */}
      {open && createPortal(<div className="ask-scrim" aria-hidden="true" />, document.body)}
    </div>
  )
}
