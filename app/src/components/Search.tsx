"use client"

/**
 * Vyhľadávacie okno.
 *
 * Jedna otázka, jedna odpoveď — zámerne bez konverzačnej histórie. Systémový
 * prompt je stavaný na jednorazové dotazy („odpovedáš výlučne z kontextu")
 * a konverzačný režim by podľa D9 zhoršil metriku správne „neviem". Kým to
 * nie je zmerané, nechávame to tak, ako sa to bude merať.
 */

import { useRef, useState } from "react"
import { askQuestion } from "@/lib/sseClient"
import type { AskResult } from "@/lib/sseClient"
import Answer from "./Answer"
import type { AnswerState } from "./Answer"
import Rating from "./Rating"
import type { Verdict } from "@/lib/ratings"
import { dictionary, type UiLanguage } from "@/lib/i18n"

const EMPTY: AnswerState = {
  question: "", text: "", citations: [], done: null, running: false,
}

/** Návrhy na začiatok — aby prvá obrazovka nebola prázdna. */
export default function Search({
  questionId: questionId,
  preset: preset,
  onReviewed: onReviewed,
  language,
}: {
  /** Označenie otázky zo zlatej sady — v režime sady. */
  questionId?: string
  /** Predvyplnené znenie otázky (režim sady). */
  preset?: string
  /** Zavolá sa po posúdení správnosti; režim sady na to nadväzuje. */
  onReviewed?: (correct: Verdict) => void
  /** Jazyk prostredia. Bez neho slovenčina. */
  language?: UiLanguage
} = {}) {
  const t = dictionary(language).ask
  const [question, setQuestion] = useState(preset ?? "")
  const [state, setState] = useState<AnswerState>(EMPTY)
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
      const r = await fetch("/api/hodnotenie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId, question: q, answer: v.text,
          sources: v.sources, citations: v.citations,
          model: v.model, provider: v.provider,
          verifiedCitations: v.verifiedCitations,
          ttftMs: v.ttftMs, totalMs: v.totalMs, timings: v.timings,
          tokens: v.tokens, cost: v.cost,
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

    setState({ question: q, text: "", citations: [], done: null, running: true })
    setRecordId(null)

    try {
      const v = await askQuestion(
        q,
        p => setState(s => ({ ...s, text: p.text, citations: p.citations })),
        { signal: ctrl.signal, language }
      )
      setState({ question: q, text: v.text, citations: v.citations, done: v, running: false })
      if (!v.error && v.text) void record(q, v)
    } catch (e) {
      // Prerušenie používateľom nie je chyba — len sme prestali čakať.
      if ((e as Error)?.name === "AbortError") return
      setState(s => ({
        ...s, running: false,
        done: {
          text: s.text, citations: s.citations, sources: [], model: "", provider: "",
          verifiedCitations: false, ttftMs: null, totalMs: 0,
          error: (e as Error)?.message ?? t.unknownError,
        },
      }))
    }
  }

  // V režime sady je otázka zobrazená nad komponentom a upravuje sa tam.
  // Textové pole aj príklady by tu boli duplicita, ktorá zvádza pýtať sa
  // na niečo iné, než čo sa má posúdiť.
  const inGoldenSet = Boolean(questionId)

  if (inGoldenSet) {
    return (
      <div style={{ display: "grid", gap: 22 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="tlacidlo"
            onClick={() => send(preset ?? "")}
            disabled={state.running}
          >
            {state.running ? t.searching : state.done ? t.askAgain : t.askThis}
          </button>
          {state.running && (
            <button
              type="button"
              className="tlacidlo tlacidlo--tiche"
              onClick={() => { abort.current?.abort(); setState(s => ({ ...s, running: false })) }}
            >
              {t.stop}
            </button>
          )}
        </div>

        <Answer state={state} language={language} />
        <Rating recordId={recordId} questionId={questionId} onDone={onReviewed} language={language} />
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <form
        onSubmit={e => { e.preventDefault(); send(question) }}
        style={{ display: "grid", gap: 10 }}
      >
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => {
            // Enter odosiela, Shift+Enter robí nový riadok. Otázky bývajú
            // jednoriadkové, takže by bolo otravné klikať na tlačidlo.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send(question)
            }
          }}
          placeholder={t.placeholder}
          rows={3}
          maxLength={1000}
          style={{
            width: "100%", resize: "vertical",
            background: "var(--surface)", color: "var(--ink)",
            border: "1px solid var(--line)", borderRadius: 12,
            padding: "14px 16px", fontSize: 16, lineHeight: 1.6,
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="submit" className="tlacidlo" disabled={!question.trim() || state.running}>
            {state.running ? t.searching : t.submit}
          </button>
          {state.running && (
            <button
              type="button"
              className="tlacidlo tlacidlo--tiche"
              onClick={() => { abort.current?.abort(); setState(s => ({ ...s, running: false })) }}
            >
              {t.stop}
            </button>
          )}
          <span className="tichy" style={{ fontSize: 12.5, marginLeft: "auto" }}>
            {question.length}/1000
          </span>
        </div>
      </form>

      {/* Príklady zmiznú, len čo je čo ukazovať. */}
      {!state.text && !state.running && !state.done && (
        <div>
          <div className="tichy" style={{ fontSize: 12.5, marginBottom: 8 }}>
            {t.examplesLabel}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {t.examples.map(p => (
              <button
                key={p}
                type="button"
                className="stitok"
                style={{ background: "var(--surface)", fontWeight: 500 }}
                onClick={() => { setQuestion(p); send(p) }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <Answer state={state} language={language} />

      <Rating recordId={recordId} questionId={questionId} onDone={onReviewed} language={language} />
    </div>
  )
}
