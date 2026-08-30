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

const PRAZDNY: AnswerState = {
  otazka: "", text: "", citacie: [], hotovo: null, bezi: false,
}

/** Návrhy na začiatok — aby prvá obrazovka nebola prázdna. */
const PRIKLADY = [
  "Aká je lehota na podanie námietky?",
  "Za akých podmienok môže prestúpiť maloletý hráč?",
  "Kedy sa platí odstupné za hráča?",
  "Koľko žltých kariet znamená zastavenie činnosti?",
]

export default function Search({
  otazkaId,
  prednastavena,
  onPosudene,
}: {
  /** Označenie otázky zo zlatej sady — v režime sady. */
  otazkaId?: string
  /** Predvyplnené znenie otázky (režim sady). */
  prednastavena?: string
  /** Zavolá sa po posúdení správnosti; režim sady na to nadväzuje. */
  onPosudene?: (spravna: Verdict) => void
} = {}) {
  const [otazka, setOtazka] = useState(prednastavena ?? "")
  const [stav, setStav] = useState<AnswerState>(PRAZDNY)
  const [zaznamId, setZaznamId] = useState<string | null>(null)
  const prerus = useRef<AbortController | null>(null)

  /**
   * Uloží odpoveď hneď, ako dobehne — ešte pred hodnotením.
   *
   * Automatické metriky D9 (hit@5, latencia, únik interného obsahu) sa dajú
   * spočítať aj z neposúdených odpovedí. Keby sa záznam zakladal až pri
   * kliknutí na hodnotenie, prišli by sme o dáta z každej preskočenej otázky.
   */
  async function zapis(q: string, v: AskResult) {
    try {
      const r = await fetch("/api/hodnotenie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otazkaId, otazka: q, odpoved: v.text,
          zdroje: v.zdroje, citacie: v.citacie,
          model: v.model, provider: v.provider,
          overeneCitacie: v.overeneCitacie,
          ttftMs: v.ttftMs, celkovoMs: v.celkovoMs, casy: v.casy,
          tokeny: v.tokeny, naklad: v.naklad,
        }),
      })
      if (!r.ok) return
      const { id } = await r.json()
      setZaznamId(id)
    } catch {
      // Nezapísané hodnotenie nesmie zhodiť zobrazenie odpovede —
      // hodnotiteľ ju stále vidí, len ju nevie posúdiť.
    }
  }

  async function odosli(text: string) {
    const q = text.trim()
    if (!q || stav.bezi) return

    prerus.current?.abort()
    const ctrl = new AbortController()
    prerus.current = ctrl

    setStav({ otazka: q, text: "", citacie: [], hotovo: null, bezi: true })
    setZaznamId(null)

    try {
      const v = await askQuestion(
        q,
        p => setStav(s => ({ ...s, text: p.text, citacie: p.citacie })),
        { signal: ctrl.signal }
      )
      setStav({ otazka: q, text: v.text, citacie: v.citacie, hotovo: v, bezi: false })
      if (!v.chyba && v.text) void zapis(q, v)
    } catch (e) {
      // Prerušenie používateľom nie je chyba — len sme prestali čakať.
      if ((e as Error)?.name === "AbortError") return
      setStav(s => ({
        ...s, bezi: false,
        hotovo: {
          text: s.text, citacie: s.citacie, zdroje: [], model: "", provider: "",
          overeneCitacie: false, ttftMs: null, celkovoMs: 0,
          chyba: (e as Error)?.message ?? "Neznáma chyba",
        },
      }))
    }
  }

  // V režime sady je otázka zobrazená nad komponentom a upravuje sa tam.
  // Textové pole aj príklady by tu boli duplicita, ktorá zvádza pýtať sa
  // na niečo iné, než čo sa má posúdiť.
  const vSade = Boolean(otazkaId)

  if (vSade) {
    return (
      <div style={{ display: "grid", gap: 22 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="tlacidlo"
            onClick={() => odosli(prednastavena ?? "")}
            disabled={stav.bezi}
          >
            {stav.bezi ? "Hľadám…" : stav.hotovo ? "Spýtať sa znova" : "Položiť túto otázku"}
          </button>
          {stav.bezi && (
            <button
              type="button"
              className="tlacidlo tlacidlo--tiche"
              onClick={() => { prerus.current?.abort(); setStav(s => ({ ...s, bezi: false })) }}
            >
              Zastaviť
            </button>
          )}
        </div>

        <Answer stav={stav} />
        <Rating zaznamId={zaznamId} otazkaId={otazkaId} onHotovo={onPosudene} />
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <form
        onSubmit={e => { e.preventDefault(); odosli(otazka) }}
        style={{ display: "grid", gap: 10 }}
      >
        <textarea
          value={otazka}
          onChange={e => setOtazka(e.target.value)}
          onKeyDown={e => {
            // Enter odosiela, Shift+Enter robí nový riadok. Otázky bývajú
            // jednoriadkové, takže by bolo otravné klikať na tlačidlo.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              odosli(otazka)
            }
          }}
          placeholder="Opýtajte sa na čokoľvek z noriem…"
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
          <button type="submit" className="tlacidlo" disabled={!otazka.trim() || stav.bezi}>
            {stav.bezi ? "Hľadám…" : "Opýtať sa"}
          </button>
          {stav.bezi && (
            <button
              type="button"
              className="tlacidlo tlacidlo--tiche"
              onClick={() => { prerus.current?.abort(); setStav(s => ({ ...s, bezi: false })) }}
            >
              Zastaviť
            </button>
          )}
          <span className="tichy" style={{ fontSize: 12.5, marginLeft: "auto" }}>
            {otazka.length}/1000
          </span>
        </div>
      </form>

      {/* Príklady zmiznú, len čo je čo ukazovať. */}
      {!stav.text && !stav.bezi && !stav.hotovo && (
        <div>
          <div className="tichy" style={{ fontSize: 12.5, marginBottom: 8 }}>
            Alebo skúste:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRIKLADY.map(p => (
              <button
                key={p}
                type="button"
                className="stitok"
                style={{ background: "var(--surface)", fontWeight: 500 }}
                onClick={() => { setOtazka(p); odosli(p) }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <Answer stav={stav} />

      <Rating zaznamId={zaznamId} otazkaId={otazkaId} onHotovo={onPosudene} />
    </div>
  )
}
