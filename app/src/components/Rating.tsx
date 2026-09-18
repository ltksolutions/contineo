"use client"

/**
 * Panel pod odpoveďou — v dvoch režimoch.
 *
 * **Bežný človek** povie len „sedí / nesedí" a pri „nesedí" napíše, čo bolo
 * zle. **Hodnotiteľ** (rola `evaluator`) vidí celé štyri polia: správnosť,
 * halucináciu, overené znenie a správne §.
 *
 * Prečo to rozdelenie (rozhodnutie Jána Letka 2026-09-15): do dnešného dňa
 * videl celý panel každý prihlásený a zapisoval priamo do záznamu, takže
 * posudok kolegu z matriky a posudok legislatívca boli v databáze
 * nerozoznateľné. „Očakávaná odpoveď" a „správne predpisy" sú expertné polia
 * — vyplnené od oka robia hodnotiteľovi viac práce, než keď zostanú prázdne.
 *
 * **Žiadne tlačidlo Uložiť** v režime hodnotiteľa: posudok sa ukladá hneď po
 * kliknutí, textové polia po opustení. Stav uloženia je vidieť, aby človek
 * nemusel dôverovať. Režim čitateľa tlačidlo má — je to jeden krátky text
 * a odoslanie musí byť jeho rozhodnutie, nie vedľajší účinok kliknutia inam.
 */

import { useEffect, useRef, useState } from "react"
import type { Verdict } from "@/lib/ratings"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import ReportInaccuracy from "@/components/ReportInaccuracy"

type SaveState = "idle" | "saving" | "saved" | "failed"

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
        fontSize: "var(--fs-body)",
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

/**
 * Režim čitateľa: „Sedí / Nesedí" a pri „Nesedí" popis.
 *
 * „Sedí" sa uloží hneď a tým to preňho končí — potvrdzovať správnu odpoveď
 * dvoma krokmi by znamenalo, že to nikto nespraví. Pri „Nesedí" sa posudok
 * uloží tiež hneď, ale formulár zostáva otvorený: veta, čo je zle, je to
 * jediné, z čoho sa dá niečo opraviť.
 */
function ReaderPanel({
  recordId, language,
}: {
  recordId: string
  language?: UiLanguage
}) {
  const t = dictionary(language).rating
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [done, setDone] = useState(false)

  async function say(value: 0 | 1) {
    setVerdict(value)
    if (value === 1) setDone(true)
    try {
      await fetch("/api/rating", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, readerVerdict: value }),
      })
    } catch {
      // Ticho: povedať „nepodarilo sa uložiť, že odpoveď sedí" je pre
      // čitateľa šum. Keď nesedí, na zlyhanie upozorní formulár nižšie.
    }
  }

  if (done) {
    return <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "12px 0 0" }}>{t.readerThanks}</p>
  }

  return (
    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{t.readerQuestion}</span>
        <Choice active={verdict === 1} color="ok" onClick={() => say(1)}>{t.fits}</Choice>
        <Choice active={verdict === 0} color="bad" onClick={() => say(0)}>{t.doesNotFit}</Choice>
      </div>
      {verdict === 0 && (
        <ReportInaccuracy recordId={recordId} language={language} onSent={() => setDone(true)} />
      )}
    </div>
  )
}

export default function Rating({
  recordId,
  canEvaluate: canEvaluate,
  language,
}: {
  /** Id záznamu z `/api/rating`. Kým je null, panel čaká. */
  recordId: string | null
  /**
   * Má prihlásený človek rolu `evaluator`? Ide **zo servera** — klient si to
   * neodvodzuje a ani keby si to podstrčil, API posudok bez roly odmietne.
   */
  canEvaluate?: boolean
  language?: UiLanguage
}) {
  const t = dictionary(language).rating
  const [fields, setFields] = useState<RatingFields>(EMPTY)
  const [status, setStatus] = useState<SaveState>("idle")
  const [detail, setDetail] = useState(false)

  // Nová odpoveď = čisté hodnotenie. Bez toho by sa posudok z predchádzajúcej
  // otázky opticky preniesol na ďalšiu a hodnotiteľ by ho potvrdil omylom.
  useEffect(() => {
    // Vynulovanie pri zmene záznamu je práve to zosúladenie, na ktoré efekt je:
    // rozpísaný text jednej otázky sa nesmie opticky preniesť na ďalšiu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(EMPTY)
    setStatus("idle")
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

    setStatus("saving")
    try {
      const r = await fetch("/api/rating", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, ...change }),
      })
      setStatus(r.ok ? "saved" : "failed")
    } catch {
      setStatus("failed")
    }
  }

  if (!recordId) return null

  if (!canEvaluate) return <ReaderPanel recordId={recordId} language={language} />

  return (
    <div
      className="card"
      style={{ borderColor: "var(--teal-100)", background: "var(--surface-2)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "var(--fs-small)", textTransform: "uppercase", letterSpacing: "0.05em",
                     color: "var(--muted)", margin: 0 }}>
          {t.heading}
        </h3>
        <span
          className="quiet"
          style={{ fontSize: "var(--fs-micro)", marginLeft: "auto", minWidth: 90, textAlign: "right" }}
          aria-live="polite"
        >
          {status === "saving" ? t.saving
            : status === "saved" ? t.saved
            : status === "failed" ? t.saveFailed : ""}
        </span>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--fs-body)", minWidth: 190 }}>{t.correctQuestion}</span>
          <Choice active={fields.correct === 1} color="ok" onClick={() => save({ correct: 1 })}>
            {t.yes}
          </Choice>
          <Choice active={fields.correct === 0} color="bad" onClick={() => save({ correct: 0 })}>
            {t.no}
          </Choice>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--fs-body)", minWidth: 190 }}>{t.hallucinationQuestion}</span>
          <Choice active={fields.hallucination === 1} color="bad" onClick={() => save({ hallucination: 1 })}>
            {t.yesInvented}
          </Choice>
          <Choice active={fields.hallucination === 0} color="ok" onClick={() => save({ hallucination: 0 })}>
            {t.noGrounded}
          </Choice>
        </div>

        {/* Podklad pre kuráciu. Skryté, lebo pri väčšine odpovedí stačia dve
            kliknutia a otvorený formulár by zbytočne zdržiaval. */}
        <button
          type="button"
          onClick={() => setDetail(d => !d)}
          className="quiet"
          style={{
            background: "none", border: "none", padding: 0,
            fontSize: "var(--fs-small)", textAlign: "left", textDecoration: "underline",
            textUnderlineOffset: 3, width: "fit-content",
          }}
        >
          {detail ? t.hideDetail : t.showDetail}
        </button>

        {detail && (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{t.expectedAnswer}</span>
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
              <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{t.sources}</span>
              <input
                value={fields.correctSources}
                onChange={e => setFields(p => ({ ...p, correctSources: e.target.value }))}
                onBlur={e => save({ correctSources: e.target.value })}
                maxLength={500}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="quiet" style={{ fontSize: "var(--fs-small)" }}>{t.note}</span>
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
  padding: "8px 10px",
  fontSize: "var(--fs-body)",
  fontFamily: "inherit",
}
