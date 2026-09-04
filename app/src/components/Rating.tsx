"use client"

/**
 * Hodnotiaci panel.
 *
 * Zbiera presne tie dve veci, ktoré skript D9 spočítať nevie — *správnosť*
 * a *halucinácie* — a k tomu voliteľne overené znenie a §, čím sa napĺňa
 * zlatá sada. Tým odpadá Excel: sada vzniká používaním.
 *
 * Návrhové rozhodnutie: **žiadne tlačidlo Uložiť.** Hodnotiteľ prejde 74
 * otázok a pri každom kroku navyše by to bolo 74 kliknutí naviac. Posudok
 * sa ukladá hneď po kliknutí, textové polia po opustení. Stav uloženia je
 * vidieť, aby človek nemusel dôverovať.
 */

import { useEffect, useRef, useState } from "react"
import type { Verdict } from "@/lib/ratings"
import { dictionary, type UiLanguage } from "@/lib/i18n"

type SaveState = "cakam" | "ukladam" | "ulozene" | "chyba"

export interface RatingFields {
  correct: Verdict
  hallucination: Verdict
  verifiedAnswer: string
  correctSources: string
  note: string
}

const EMPTY: RatingFields = {
  correct: null, hallucination: null,
  verifiedAnswer: "", correctSources: "", note: "",
}

function Choice({
  active: active, color: color, onClick, children,
}: {
  active: boolean
  color: "ok" | "bad"
  onClick: () => void
  children: React.ReactNode
}) {
  const background = color === "ok" ? "var(--ok-bg)" : "var(--bad-bg)"
  const foreground = color === "ok" ? "var(--ok-fg)" : "var(--bad-fg)"
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? foreground : "var(--line)"}`,
        background: active ? background : "var(--surface)",
        color: active ? foreground : "var(--ink)",
        fontWeight: active ? 700 : 500,
        borderRadius: 9,
        padding: "7px 14px",
        fontSize: 14,
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

export default function Rating({
  recordId,
  questionId,
  onDone,
  language,
}: {
  /** Id záznamu z `/api/hodnotenie`. Kým je null, panel čaká. */
  recordId: string | null
  /** Označenie otázky zo zlatej sady, ak ide o režim sady. */
  questionId?: string
  /** Zavolá sa po posúdení správnosti — režim sady na to nadväzuje. */
  onDone?: (correct: Verdict) => void
  language?: UiLanguage
}) {
  const t = dictionary(language).goldenSet.rating
  const [fields, setFields] = useState<RatingFields>(EMPTY)
  const [status, setStatus] = useState<SaveState>("cakam")
  const [detail, setDetail] = useState(false)

  // Nová odpoveď = čisté hodnotenie. Bez toho by sa posudok z predchádzajúcej
  // otázky opticky preniesol na ďalšiu a hodnotiteľ by ho potvrdil omylom.
  useEffect(() => {
    // Vynulovanie pri zmene záznamu je práve to zosúladenie, na ktoré efekt je:
    // rozpísaný text jednej otázky sa nesmie opticky preniesť na ďalšiu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(EMPTY)
    setStatus("cakam")
    setDetail(false)
  }, [recordId])

  const lastSent = useRef<string>("")

  async function save(change: Partial<RatingFields>) {
    if (!recordId) return
    const next = { ...fields, ...change }
    setFields(next)

    // Nepošleme to isté dvakrát — textové polia strácajú fokus aj bez zmeny.
    const fingerprint = JSON.stringify({ recordId, ...change })
    if (fingerprint === lastSent.current) return
    lastSent.current = fingerprint

    setStatus("ukladam")
    try {
      const r = await fetch("/api/hodnotenie", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, ...change }),
      })
      setStatus(r.ok ? "ulozene" : "chyba")
      if (r.ok && change.correct !== undefined) onDone?.(change.correct)
    } catch {
      setStatus("chyba")
    }
  }

  if (!recordId) return null

  return (
    <div
      className="karta"
      style={{ borderColor: "var(--teal-100)", background: "var(--surface-2)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em",
                     color: "var(--muted)", margin: 0 }}>
          {t.heading}
        </h3>
        {questionId && (
          <span className="stitok tichy" style={{ fontSize: 11 }}>{questionId}</span>
        )}
        <span
          className="tichy"
          style={{ fontSize: 12, marginLeft: "auto", minWidth: 90, textAlign: "right" }}
          aria-live="polite"
        >
          {status === "ukladam" ? t.saving
            : status === "ulozene" ? t.saved
            : status === "chyba" ? t.saveFailed : ""}
        </span>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, minWidth: 190 }}>{t.correctQuestion}</span>
          <Choice active={fields.correct === 1} color="ok" onClick={() => save({ correct: 1 })}>
            {t.yes}
          </Choice>
          <Choice active={fields.correct === 0} color="bad" onClick={() => save({ correct: 0 })}>
            {t.no}
          </Choice>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, minWidth: 190 }}>{t.hallucinationQuestion}</span>
          <Choice active={fields.hallucination === 1} color="bad" onClick={() => save({ hallucination: 1 })}>
            {t.yesInvented}
          </Choice>
          <Choice active={fields.hallucination === 0} color="ok" onClick={() => save({ hallucination: 0 })}>
            {t.noGrounded}
          </Choice>
        </div>

        {/* Doplnenie zlatej sady. Skryté, lebo pri väčšine otázok stačia
            dve kliknutia a otvorený formulár by zbytočne zdržiaval. */}
        <button
          type="button"
          onClick={() => setDetail(d => !d)}
          className="tichy"
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: 13.5, textAlign: "left", textDecoration: "underline",
            textUnderlineOffset: 3, width: "fit-content",
          }}
        >
          {detail ? t.hideDetail : t.showDetail}
        </button>

        {detail && (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>{t.expectedAnswer}</span>
              <textarea
                value={fields.verifiedAnswer}
                onChange={e => setFields(p => ({ ...p, verifiedAnswer: e.target.value }))}
                onBlur={e => save({ verifiedAnswer: e.target.value })}
                rows={3}
                maxLength={4000}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>{t.sources}</span>
              <input
                value={fields.correctSources}
                onChange={e => setFields(p => ({ ...p, correctSources: e.target.value }))}
                onBlur={e => save({ correctSources: e.target.value })}
                maxLength={500}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>{t.note}</span>
              <textarea
                value={fields.note}
                onChange={e => setFields(p => ({ ...p, note: e.target.value }))}
                onBlur={e => save({ note: e.target.value })}
                rows={2}
                maxLength={2000}
                style={fieldStyle}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface)",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 14.5,
  fontFamily: "inherit",
  lineHeight: 1.6,
  resize: "vertical",
}
