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

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { askQuestion } from "@/lib/sseClient"
import type { AskResult } from "@/lib/sseClient"
import Answer from "./Answer"
import type { AnswerState } from "./Answer"
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
          sources: v.sources, citations: v.citations,
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

  return (
    <div style={{ display: "grid", gap: 18 }}>
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

      <Answer state={state} organisation={organisation} language={language} />

      <Rating recordId={recordId} canEvaluate={canEvaluate} language={language} />
    </div>
  )
}
