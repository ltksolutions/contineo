"use client"

/**
 * Beh otázky na `/ask` (ASK-otazka-z-hlavicky).
 *
 * Jedna otázka, jedna odpoveď — zámerne bez konverzačnej histórie. Systémový
 * prompt je stavaný na jednorazové dotazy („odpovedáš výlučne z kontextu");
 * konverzačný režim by zhoršil to, čo je na tomto systéme podstatné —
 * schopnosť povedať „v dokumentoch to nie je".
 *
 * **Otázka prichádza adresou** (`/ask?q=`) z poľa v hlavičke a beh sa
 * spustí hneď po pripojení (`autoRun`) — po odoslaní netreba nič robiť,
 * len čítať. Vlastné pole tu už nie je: pýta sa v hlavičke, „Upraviť
 * otázku" otvorí jej plachtu.
 */

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type SyntheticEvent } from "react"
import Link from "next/link"
import { askQuestion } from "@/lib/sseClient"
import type { AskResult } from "@/lib/sseClient"
import { AnswerBody, AnswerAside, answerHasCitations } from "./Answer"
import type { AnswerState } from "./Answer"
import CitationSheet from "./CitationSheet"
import { cleanCitation, mergeCitations } from "@/lib/formatText"
import Rating from "./Rating"
import { HEADER_ASK_ID } from "./HeaderAsk"
import { dictionary, type UiLanguage } from "@/lib/i18n"

const EMPTY: AnswerState = {
  question: "", text: "", citations: [], done: null, running: false,
}

export default function Search({
  preset: preset,
  canEvaluate: canEvaluate,
  organisation,
  language,
}: {
  /**
   * Otázka z adresy — položená v hlavičke. Číta sa len pri pripojení
   * komponentu; `/ask` preto mení jeho `key`.
   */
  preset: string
  /** Skratka organizácie do hlavičky odpovede („Odpoveď z dokumentov SFZ"). */
  organisation?: string
  /**
   * Má prihlásený človek rolu `evaluator`? Rozhoduje o tom, či pod odpoveďou
   * uvidí celý hodnotiaci panel, alebo len „sedí / nesedí". Ide zo servera.
   */
  canEvaluate?: boolean
  /** Jazyk prostredia. Bez neho slovenčina. */
  language?: UiLanguage
}) {
  const t = dictionary(language).ask
  const [state, setState] = useState<AnswerState>(EMPTY)
  /** Kedy sa beh spustil — „Opýtali ste sa o 10:42". Len v prehliadači. */
  const [askedAt, setAskedAt] = useState<Date | null>(null)
  const [recordId, setRecordId] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  /**
   * Uloží odpoveď hneď, ako dobehne — ešte pred hodnotením.
   *
   * Automatické metriky D9 (hit@5, latencia, únik interného obsahu) sa dajú
   * spočítať aj z neposúdených odpovedí. Keby sa záznam zakladal až pri
   * kliknutí na hodnotenie, prišli by sme o dáta z každej preskočenej otázky.
   */
  async function record(q: string, v: AskResult) {
    try {
      const r = await fetch("/api/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q, answer: v.text,
          sources: v.sources,
          // Bez `at` — poloha značky je len pre tento beh (ASK-odpoved-dva-
          // stlpce, Q1). Do záznamu nepatrí: nová vec v schéme by prišla
          // z tela požiadavky, nie z rozhodnutia.
          citations: v.citations.map(c => ({
            chunkIndex: c.chunkIndex, citedText: c.citedText, documentTitle: c.documentTitle, articleRef: c.articleRef,
          })),
          model: v.model, provider: v.provider,
          verifiedCitations: v.verifiedCitations,
          ttftMs: v.ttftMs, totalMs: v.totalMs, timings: v.timings,
          tokens: v.tokens, cost: v.cost, time: v.time,
        }),
      })
      if (!r.ok) return
      const { id } = await r.json()
      setRecordId(id)
    } catch {
      // Nezapísané hodnotenie nesmie zhodiť zobrazenie odpovede —
      // hodnotiteľ ju stále vidí, len ju nevie posúdiť.
    }
  }

  async function send(text: string) {
    const q = text.trim()
    if (!q || state.running) return

    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl

    setState({ question: q, text: "", citations: [], done: null, running: true, phase: undefined })
    setAskedAt(new Date())
    setRecordId(null)

    try {
      const v = await askQuestion(
        q,
        p => setState(s => ({ ...s, text: p.text, citations: p.citations, phase: p.phase, time: p.time, comparison: p.comparison })),
        { signal: ctrl.signal, language }
      )
      setState({ question: q, text: v.text, citations: v.citations, done: v, running: false, phase: undefined, time: v.time, comparison: v.comparison })
      if (!v.error && v.text) void record(q, v)
    } catch (e) {
      // Prerušenie používateľom nie je chyba — len sme prestali čakať.
      if ((e as Error)?.name === "AbortError") return
      setState(s => ({
        ...s, running: false, phase: undefined,
        done: {
          text: s.text, citations: s.citations, sources: [], model: "", provider: "",
          verifiedCitations: false, ttftMs: null, totalMs: 0,
          error: (e as Error)?.message ?? t.unknownError,
        },
      }))
    }
  }

  /*
   * Beh sa spustí hneď po pripojení — raz. `ref`, lebo v StrictMode sa efekt
   * spustí dvakrát a dve rovnaké otázky za sebou by boli dva zápisy
   * a dvojnásobná cena.
   */
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    void send(preset)
  })

  const time = askedAt?.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })

  /*
   * Prepojenie značiek `[n]` v texte s citáciami (ASK-odpoved-dva-stlpce).
   * Delegované udalosti na obale — `FormattedText` a `AnswerAside` ostávajú
   * bez stavu. Prejdenie myšou alebo fokus zvýrazní citáciu aj vetu; klik
   * zvýraznenie pripne. Pod 1180 px klik posunie na citáciu pod odpoveďou,
   * pod 640 px otvorí spodnú plachtu.
   */
  const layout = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  const [sheet, setSheet] = useState<number | null>(null)
  const active = hover ?? pinned
  const unique = mergeCitations(state.citations)
  const split = answerHasCitations(state)

  useEffect(() => {
    const root = layout.current
    if (!root) return
    root.querySelectorAll("[data-cite].is-active").forEach(el => el.classList.remove("is-active"))
    if (active === null) return
    root.querySelectorAll<HTMLElement>("[data-cite]").forEach(el => {
      if ((el.dataset.cite ?? "").split(" ").includes(String(active))) el.classList.add("is-active")
    })
  })

  const citeOf = (target: EventTarget | null): number | null => {
    const el = (target as HTMLElement | null)?.closest?.<HTMLElement>(".cite, .answer-citation")
    const n = Number(el?.dataset.cite)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const onOver = (e: SyntheticEvent) => setHover(citeOf(e.target))
  const onOut = () => setHover(null)
  const onClick = (e: ReactMouseEvent) => {
    const marker = (e.target as HTMLElement).closest?.(".cite")
    const n = citeOf(e.target)
    if (n === null) return
    setPinned(p => (p === n && !marker ? null : n))
    if (!marker) return
    if (window.matchMedia("(max-width: 639px)").matches) setSheet(n)
    else if (!window.matchMedia("(min-width: 1180px)").matches) {
      document.getElementById(`citation-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }

  return (
    <div
      ref={layout}
      className={split ? "ask-layout is-split" : "ask-layout"}
      onMouseOver={onOver}
      onMouseOut={onOut}
      onFocus={onOver}
      onBlur={onOut}
      onClick={onClick}
    >
      <div className="ask-main">
      {/* Nadpis = otázka. „Upraviť otázku" je popis poľa v hlavičke: klik
          ho zameria a tým otvorí plachtu s touto otázkou. */}
      <div className="ask-asked">
        <h1 className="ask-asked-title">{preset}</h1>
        <div className="ask-asked-meta">
          <label htmlFor={HEADER_ASK_ID} className="ask-edit">
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11.8 3.2l3 3L6.6 14.4H3.6v-3z" />
            </svg>
            {t.edit}
          </label>
          {time && <span className="quiet">{t.askedAt(time)}</span>}
        </div>
      </div>

      {/*
        Jediné miesto v systéme, ktoré bez JavaScriptu naozaj nefunguje —
        a je to zámer, nie opomenutie: odpoveď prichádza po častiach, ako ju
        model píše (SSE), a to sa serverovým formulárom nahradiť nedá.
        Namiesto odpovede, ktorá mlčí, preto povieme prečo a kam ísť.
      */}
      <noscript>
        <p className="noscript-notice">
          {t.noScript} <Link href="/documents">{t.noScriptLink}</Link>
        </p>
      </noscript>

      {/* Chyba nad kartou, nie namiesto nej (ASK, úloha 2) — a vždy s cestou
          von (knižnica funguje aj keď model nie), nie len s oznámením. */}
      {state.done?.error && !state.running && (
        <div className="ask-error" role="alert">
          <strong>{t.error.unavailable}</strong>{" "}
          <Link href="/library">{t.error.link}</Link>
        </div>
      )}

      <AnswerBody state={state} organisation={organisation} language={language} />
      </div>

      {/* Vpravo od karty (≥ 1180 px), inak pod ňou — poradie určuje CSS mriežka. */}
      <aside className="ask-aside">
        <AnswerAside state={state} canEvaluate={canEvaluate} language={language} />
      </aside>

      <div className="ask-rating">
        <Rating recordId={recordId} canEvaluate={canEvaluate} language={language} />
      </div>

      {sheet !== null && unique[sheet - 1] && (
        <CitationSheet
          n={sheet}
          total={unique.length}
          text={cleanCitation(unique[sheet - 1].citedText)}
          meta={[unique[sheet - 1].documentTitle, unique[sheet - 1].articleRef].filter(Boolean).join(" · ")}
          language={language}
          onMove={n => { setSheet(n); setPinned(n) }}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
