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

type SaveState = "cakam" | "ukladam" | "ulozene" | "chyba"

export interface RatingFields {
  spravna: Verdict
  halucinacia: Verdict
  overenaOdpoved: string
  spravneZdroje: string
  poznamka: string
}

const EMPTY: RatingFields = {
  spravna: null, halucinacia: null,
  overenaOdpoved: "", spravneZdroje: "", poznamka: "",
}

function Choice({
  aktivna: active, farba: color, onClick, children,
}: {
  aktivna: boolean
  farba: "ok" | "bad"
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
  zaznamId: recordId,
  otazkaId: questionId,
  onHotovo: onDone,
}: {
  /** Id záznamu z `/api/hodnotenie`. Kým je null, panel čaká. */
  zaznamId: string | null
  /** Označenie otázky zo zlatej sady, ak ide o režim sady. */
  otazkaId?: string
  /** Zavolá sa po posúdení správnosti — režim sady na to nadväzuje. */
  onHotovo?: (correct: Verdict) => void
}) {
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
    const fingerprint = JSON.stringify({ zaznamId: recordId, ...change })
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
      if (r.ok && change.spravna !== undefined) onDone?.(change.spravna)
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
          Ako hodnotíte túto odpoveď?
        </h3>
        {questionId && (
          <span className="stitok tichy" style={{ fontSize: 11 }}>{questionId}</span>
        )}
        <span
          className="tichy"
          style={{ fontSize: 12, marginLeft: "auto", minWidth: 90, textAlign: "right" }}
          aria-live="polite"
        >
          {status === "ukladam" ? "ukladám…"
            : status === "ulozene" ? "uložené"
            : status === "chyba" ? "neuložilo sa" : ""}
        </span>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, minWidth: 190 }}>Je odpoveď vecne správna?</span>
          <Choice aktivna={fields.spravna === 1} farba="ok" onClick={() => save({ spravna: 1 })}>
            Áno
          </Choice>
          <Choice aktivna={fields.spravna === 0} farba="bad" onClick={() => save({ spravna: 0 })}>
            Nie
          </Choice>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, minWidth: 190 }}>
            Tvrdí niečo, čo v zdrojoch nie je?
          </span>
          <Choice aktivna={fields.halucinacia === 1} farba="bad" onClick={() => save({ halucinacia: 1 })}>
            Áno, vymyslel si
          </Choice>
          <Choice aktivna={fields.halucinacia === 0} farba="ok" onClick={() => save({ halucinacia: 0 })}>
            Nie, všetko má oporu
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
          {detail ? "Skryť doplnenie" : "Doplniť správnu odpoveď a §"}
        </button>

        {detail && (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>
                Ako mala odpoveď znieť?
              </span>
              <textarea
                value={fields.overenaOdpoved}
                onChange={e => setFields(p => ({ ...p, overenaOdpoved: e.target.value }))}
                onBlur={e => save({ overenaOdpoved: e.target.value })}
                rows={3}
                maxLength={4000}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>
                Ktoré predpisy a § to upravujú? Napríklad &bdquo;SP čl. 78, DP čl. 37&ldquo;.
              </span>
              <input
                value={fields.spravneZdroje}
                onChange={e => setFields(p => ({ ...p, spravneZdroje: e.target.value }))}
                onBlur={e => save({ spravneZdroje: e.target.value })}
                maxLength={500}
                style={fieldStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>
                Poznámka — čo bolo na odpovedi zavádzajúce alebo neúplné?
              </span>
              <textarea
                value={fields.poznamka}
                onChange={e => setFields(p => ({ ...p, poznamka: e.target.value }))}
                onBlur={e => save({ poznamka: e.target.value })}
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
