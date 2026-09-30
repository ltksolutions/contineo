"use client"

/**
 * AskSheet — plachta otázky (ASK-otazka-z-hlavicky).
 *
 * Dva tvary, jeden obsah:
 *
 *  - **`overlay`** — pole v hlavičke sa po kliknutí, fokuse alebo `⌘K`
 *    rozšíri na mieste do plachty (`HeaderAsk`). Pod 640 px ide na celú
 *    obrazovku s „×" hore a „Opýtať sa" dole nad klávesnicou (CSS).
 *  - **`inline`** — `/ask` bez otázky: tá istá plachta vložená do stránky,
 *    otvorená a bez závoja.
 *
 * Obsah: viacriadkové pole (rastie do šiestich riadkov), lišta s nápovedou
 * a tlačidlom, veta o tom, ako systém odpovedá, a vzory otázok. Vzor otázku
 * **vloží, neodošle** — človek ju má vidieť a môže ju upraviť; vzory sa
 * skryjú, len čo pole nie je prázdne.
 *
 * Je to `<form method="get" action="/ask">` s `<textarea name="q">`, takže
 * vložená plachta odošle otázku aj bez JavaScriptu. So skriptom ide
 * odoslanie cez router (bez načítania stránky) a `/ask` spustí beh hneď.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import Icon from "./Icon"
import { ContineoMark } from "./ContineoMark"
import { dictionary, type UiLanguage } from "@/lib/i18n"

/** Rovnaký strop ako API (`/api/chat`) a ako doterajšie pole na `/ask`. */
export const QUESTION_MAX = 1000
/** Počítadlo sa ukáže až blízko stropu — dovtedy je to šum. */
const COUNTER_FROM = 800
/** Šesť riadkov po 17 × 1.5 px. Ďalej pole roluje. */
const MAX_HEIGHT = 6 * 17 * 1.5
/** `useSyncExternalStore` bez odberu — len rozlíšenie server / prehliadač. */
const noop = () => () => {}

export default function AskSheet({
  mode,
  initial = "",
  organisation,
  language,
  onClose,
}: {
  mode: "overlay" | "inline"
  initial?: string
  /** Názov organizácie do vety o tom, z čoho sa odpovedá. */
  organisation: string
  language?: UiLanguage
  /**
   * Len `overlay`: zavretie Esc, „×" alebo odoslaním — s tým, čo je v poli.
   * `submitted` = otázka odišla; fokus sa vtedy do poľa v hlavičke nevracia
   * (na telefóne by vyskočila klávesnica nad odpoveďou).
   */
  onClose?: (value: string, submitted?: boolean) => void
}) {
  const t = dictionary(language)
  const ta = t.ask
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const field = useRef<HTMLTextAreaElement>(null)

  // Výška poľa podľa obsahu, najviac šesť riadkov.
  const fit = () => {
    const el = field.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  // Fokus do poľa a kurzor na koniec — plachta sa otvorila, aby sa písalo.
  useEffect(() => {
    const el = field.current
    if (!el) return
    fit()
    if (mode === "overlay") {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [mode])

  const submit = () => {
    const q = value.trim()
    if (!q) return
    onClose?.(q, true)
    router.push(`/ask?q=${encodeURIComponent(q)}`)
  }

  const pick = (example: string) => {
    setValue(example)
    // Po vykreslení nového textu — inak by výška zodpovedala prázdnemu poľu.
    requestAnimationFrame(() => {
      fit()
      field.current?.focus()
    })
  }

  const empty = value.trim() === ""
  /*
   * Prázdne pole tlačidlo vypne — ale až so skriptom. Bez neho server
   * vykreslí prázdne pole a vypnuté tlačidlo by vložená plachta na `/ask`
   * nemala ako odoslať (Enter v `<textarea>` bez skriptu robí nový riadok).
   */
  const ready = useSyncExternalStore(noop, () => true, () => false)
  const button = (
    <button type="submit" className="ask-sheet-submit" disabled={ready && empty}>
      {ta.submit}
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.9"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" />
      </svg>
    </button>
  )

  return (
    <form
      className={`ask-sheet ask-sheet--${mode}`}
      method="get"
      action="/ask"
      role={mode === "overlay" ? "dialog" : undefined}
      aria-label={mode === "overlay" ? ta.submit : undefined}
      onSubmit={e => { e.preventDefault(); submit() }}
    >
      {/* Telefón (overlay): hlavička celej obrazovky. Na širšej sa skrýva. */}
      {mode === "overlay" && (
        <div className="ask-sheet-head">
          <button type="button" className="ask-sheet-close" aria-label={ta.sheet.close} onClick={() => onClose?.(value)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" aria-hidden="true">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
            </svg>
          </button>
          <b>{ta.heading}</b>
        </div>
      )}

      <div className="ask-sheet-scroll">
        <div className="ask-sheet-top">
          <span className="ask-sheet-mark" aria-hidden="true"><ContineoMark size={18} /></span>
          <textarea
            ref={field}
            name="q"
            className="ask-sheet-field"
            value={value}
            maxLength={QUESTION_MAX}
            rows={3}
            placeholder={t.nav.searchPlaceholder}
            aria-label={t.nav.searchLabel}
            onChange={e => { setValue(e.target.value); fit() }}
            onKeyDown={e => {
              // Enter odošle, Shift+Enter robí nový riadok — otázky bývajú
              // jednoriadkové a klikať na tlačidlo by bolo otravné.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
              if (e.key === "Escape" && mode === "overlay") {
                e.preventDefault()
                onClose?.(value)
              }
            }}
          />
        </div>

        <div className="ask-sheet-bar">
          <span className="ask-sheet-hint">{mode === "overlay" ? ta.sheet.hint : ta.sheet.hintInline}</span>
          {value.length >= COUNTER_FROM && (
            <span className="ask-sheet-count">{value.length}/{QUESTION_MAX}</span>
          )}
          <span className="ask-sheet-bar-button">{button}</span>
        </div>

        <p className="ask-sheet-info">
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
               strokeLinecap="round" aria-hidden="true">
            <circle cx="9" cy="9" r="7" /><path d="M9 8.2v4.2M9 5.6v.1" />
          </svg>
          <span><b>{ta.sheet.infoLead(organisation)}</b> {ta.sheet.infoRest}</span>
        </p>

        {empty && (
          <div className="ask-sheet-examples">
            <h3>{ta.examplesLabel}</h3>
            {ta.examples.map(example => (
              <button key={example} type="button" onClick={() => pick(example)}>
                <Icon name="ask" size={15} />
                <span>{example}</span>
                <i aria-hidden="true">{ta.sheet.insert}</i>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Telefón (overlay): tlačidlo dole, nad klávesnicou. */}
      {mode === "overlay" && <div className="ask-sheet-foot">{button}</div>}
    </form>
  )
}
