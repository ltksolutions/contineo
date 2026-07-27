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
import type { Posudok } from "@/lib/hodnotenia"

type Stav = "cakam" | "ukladam" | "ulozene" | "chyba"

export interface HodnoteniePolia {
  spravna: Posudok
  halucinacia: Posudok
  overenaOdpoved: string
  spravneZdroje: string
  poznamka: string
}

const PRAZDNE: HodnoteniePolia = {
  spravna: null, halucinacia: null,
  overenaOdpoved: "", spravneZdroje: "", poznamka: "",
}

function Volba({
  aktivna, farba, onClick, children,
}: {
  aktivna: boolean
  farba: "ok" | "bad"
  onClick: () => void
  children: React.ReactNode
}) {
  const pozadie = farba === "ok" ? "var(--ok-bg)" : "var(--bad-bg)"
  const popredie = farba === "ok" ? "var(--ok-fg)" : "var(--bad-fg)"
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${aktivna ? popredie : "var(--line)"}`,
        background: aktivna ? pozadie : "var(--surface)",
        color: aktivna ? popredie : "var(--ink)",
        fontWeight: aktivna ? 700 : 500,
        borderRadius: 9,
        padding: "7px 14px",
        fontSize: 14,
      }}
      aria-pressed={aktivna}
    >
      {children}
    </button>
  )
}

export default function Hodnotenie({
  zaznamId,
  otazkaId,
  onHotovo,
}: {
  /** Id záznamu z `/api/hodnotenie`. Kým je null, panel čaká. */
  zaznamId: string | null
  /** Označenie otázky zo zlatej sady, ak ide o režim sady. */
  otazkaId?: string
  /** Zavolá sa po posúdení správnosti — režim sady na to nadväzuje. */
  onHotovo?: (spravna: Posudok) => void
}) {
  const [polia, setPolia] = useState<HodnoteniePolia>(PRAZDNE)
  const [stav, setStav] = useState<Stav>("cakam")
  const [detail, setDetail] = useState(false)

  // Nová odpoveď = čisté hodnotenie. Bez toho by sa posudok z predchádzajúcej
  // otázky opticky preniesol na ďalšiu a hodnotiteľ by ho potvrdil omylom.
  useEffect(() => {
    setPolia(PRAZDNE)
    setStav("cakam")
    setDetail(false)
  }, [zaznamId])

  const poslednePoslane = useRef<string>("")

  async function uloz(zmena: Partial<HodnoteniePolia>) {
    if (!zaznamId) return
    const nove = { ...polia, ...zmena }
    setPolia(nove)

    // Nepošleme to isté dvakrát — textové polia strácajú fokus aj bez zmeny.
    const otlacok = JSON.stringify({ zaznamId, ...zmena })
    if (otlacok === poslednePoslane.current) return
    poslednePoslane.current = otlacok

    setStav("ukladam")
    try {
      const r = await fetch("/api/hodnotenie", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: zaznamId, ...zmena }),
      })
      setStav(r.ok ? "ulozene" : "chyba")
      if (r.ok && zmena.spravna !== undefined) onHotovo?.(zmena.spravna)
    } catch {
      setStav("chyba")
    }
  }

  if (!zaznamId) return null

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
        {otazkaId && (
          <span className="stitok tichy" style={{ fontSize: 11 }}>{otazkaId}</span>
        )}
        <span
          className="tichy"
          style={{ fontSize: 12, marginLeft: "auto", minWidth: 90, textAlign: "right" }}
          aria-live="polite"
        >
          {stav === "ukladam" ? "ukladám…"
            : stav === "ulozene" ? "uložené"
            : stav === "chyba" ? "neuložilo sa" : ""}
        </span>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, minWidth: 190 }}>Je odpoveď vecne správna?</span>
          <Volba aktivna={polia.spravna === 1} farba="ok" onClick={() => uloz({ spravna: 1 })}>
            Áno
          </Volba>
          <Volba aktivna={polia.spravna === 0} farba="bad" onClick={() => uloz({ spravna: 0 })}>
            Nie
          </Volba>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, minWidth: 190 }}>
            Tvrdí niečo, čo v zdrojoch nie je?
          </span>
          <Volba aktivna={polia.halucinacia === 1} farba="bad" onClick={() => uloz({ halucinacia: 1 })}>
            Áno, vymyslel si
          </Volba>
          <Volba aktivna={polia.halucinacia === 0} farba="ok" onClick={() => uloz({ halucinacia: 0 })}>
            Nie, všetko má oporu
          </Volba>
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
                value={polia.overenaOdpoved}
                onChange={e => setPolia(p => ({ ...p, overenaOdpoved: e.target.value }))}
                onBlur={e => uloz({ overenaOdpoved: e.target.value })}
                rows={3}
                maxLength={4000}
                style={poleStyl}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>
                Ktoré predpisy a § to upravujú? Napríklad „SP čl. 78, DP čl. 37".
              </span>
              <input
                value={polia.spravneZdroje}
                onChange={e => setPolia(p => ({ ...p, spravneZdroje: e.target.value }))}
                onBlur={e => uloz({ spravneZdroje: e.target.value })}
                maxLength={500}
                style={poleStyl}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="tichy" style={{ fontSize: 13 }}>
                Poznámka — čo bolo na odpovedi zavádzajúce alebo neúplné?
              </span>
              <textarea
                value={polia.poznamka}
                onChange={e => setPolia(p => ({ ...p, poznamka: e.target.value }))}
                onBlur={e => uloz({ poznamka: e.target.value })}
                rows={2}
                maxLength={2000}
                style={poleStyl}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

const poleStyl: React.CSSProperties = {
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
