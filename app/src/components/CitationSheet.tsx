"use client"

/**
 * CitationSheet — spodná plachta citácie na telefóne (ASK-odpoved-dva-stlpce).
 *
 * Pod 640 px ťuknutie na značku `[n]` v texte otvorí citáciu zospodu —
 * úryvok, dokument a listovanie na ďalšie (tlačidlá 44 px). Zoznam citácií
 * pod odpoveďou ostáva; plachta je skratka, aby človek pri čítaní tvrdenia
 * nemusel rolovať na koniec a späť. Esc, závoj alebo „×" zavrie a fokus sa
 * vráti na značku, z ktorej sa otvorila.
 */

import { useEffect, useRef } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function CitationSheet({
  n,
  total,
  text,
  meta,
  language,
  onMove,
  onClose,
}: {
  n: number
  total: number
  text: string
  meta: string
  language?: UiLanguage
  onMove: (n: number) => void
  onClose: () => void
}) {
  const t = dictionary(language).answer
  const panel = useRef<HTMLDivElement>(null)

  // `onClose` je nová funkcia pri každom vykreslení rodiča — efekt s ním
  // v závislostiach by sa spúšťal znova a fokus by skákal späť na značku.
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  // Fokus do plachty pri otvorení, späť na značku pri zavretí.
  useEffect(() => {
    const from = document.activeElement
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current() }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      ;(from as HTMLElement | null)?.focus?.()
    }
  }, [])

  return (
    <>
      <div className="citation-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={panel}
        className="citation-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t.citationOf(n, total)}
        tabIndex={-1}
      >
        <div className="citation-sheet-head">
          <span className="answer-citation-n" aria-hidden="true">{n}</span>
          <b>{t.citationOf(n, total)}</b>
          <button type="button" className="citation-sheet-close" aria-label={t.close} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" aria-hidden="true">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
            </svg>
          </button>
        </div>
        <q className="citation-sheet-text">{text}</q>
        {meta && <div className="answer-citation-meta">{meta}</div>}
        <div className="citation-sheet-nav">
          <button type="button" className="button button--quiet" disabled={n <= 1} onClick={() => onMove(n - 1)}>
            ← {t.prev}
          </button>
          <button type="button" className="button button--quiet" disabled={n >= total} onClick={() => onMove(n + 1)}>
            {t.next} →
          </button>
        </div>
      </div>
    </>
  )
}
