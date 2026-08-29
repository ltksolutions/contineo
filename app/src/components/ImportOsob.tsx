"use client"

/**
 * Import osôb z CSV — jediná obrazovka v správe, ktorá potrebuje klientsky stav.
 *
 * Zvyšok správcovských formulárov je zámerne serverový a funguje bez
 * JavaScriptu. Tu to nejde: medzi „vyber súbor" a „zapíš" musí byť **náhľad**,
 * a ten znamená, že sa obsah súboru musí niekde podržať. Nechať človeka
 * vybrať ten istý súbor druhýkrát je horšia cena než jeden klientsky
 * komponent — najmä preto, že medzi prvým a druhým výberom by sa dal
 * podstrčiť iný.
 *
 * Bez JavaScriptu zostáva skript `npm run persons:import`, ktorý robí to isté.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { nahladImportu, vykonajImport } from "@/app/osoby/akcie"

type Nahlad = Awaited<ReturnType<typeof nahladImportu>>

export default function ImportOsob() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [nazov, setNazov] = useState("")
  const [nahlad, setNahlad] = useState<Nahlad | null>(null)
  const [pracujem, setPracujem] = useState(false)
  const [vysledok, setVysledok] = useState<string | null>(null)

  async function vyber(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    setNahlad(null)
    setVysledok(null)
    if (!f) { setText(""); setNazov(""); return }
    setNazov(f.name)
    setPracujem(true)
    try {
      const obsah = await f.text()
      setText(obsah)
      setNahlad(await nahladImportu(obsah))
    } finally {
      setPracujem(false)
    }
  }

  async function zapis() {
    setPracujem(true)
    try {
      const v = await vykonajImport(text)
      setVysledok(v.sprava)
      if (v.ok) {
        setNahlad(null)
        setText("")
        router.refresh()
      }
    } finally {
      setPracujem(false)
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <label className="pole">
        <span className="pole-popis">Súbor CSV</span>
        <input
          className="pole-vstup"
          type="file"
          accept=".csv,text/csv,text/plain"
          onChange={vyber}
          disabled={pracujem}
        />
        <span className="tichy pole-napoveda">
          Prvý riadok sú hlavičky. Rozpoznajú sa <code>email</code>, <code>meno</code>,{" "}
          <code>útvar</code>, <code>typ</code>, <code>nástup</code>, <code>trasy</code>,{" "}
          <code>skupiny</code>, <code>jazyk</code> — aj bez diakritiky a s bodkočiarkou
          ako oddeľovačom, tak ako to ukladá Excel.
        </span>
      </label>

      {pracujem && <p className="tichy">Čítam…</p>}

      {vysledok && (
        <p className="karta" style={{ padding: "12px 16px", fontSize: 14.5, margin: 0 }}>
          {vysledok}
        </p>
      )}

      {nahlad && !nahlad.ok && (
        <p className="karta" style={{ padding: "12px 16px", fontSize: 14.5, margin: 0, color: "var(--warn-fg)" }}>
          {nahlad.sprava}
        </p>
      )}

      {nahlad?.ok && (
        <section className="karta" style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Čo sa stane — {nazov}</h2>

          <div className="admin-udaje" style={{ marginTop: 0 }}>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>Riadkov</div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{nahlad.spolu}</div>
            </div>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>Pribudne</div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{nahlad.nove?.length ?? 0}</div>
            </div>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>Aktualizuje sa</div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>{nahlad.existujuce?.length ?? 0}</div>
            </div>
            <div>
              <div className="tichy" style={{ fontSize: 12.5 }}>Chybných</div>
              <div
                style={{
                  fontSize: 15.5, fontWeight: 600,
                  color: (nahlad.chyby?.length ?? 0) > 0 ? "var(--warn-fg)" : "var(--muted)",
                }}
              >
                {nahlad.chyby?.length ?? 0}
              </div>
            </div>
          </div>

          {(nahlad.nove?.length ?? 0) > 0 && (
            <div>
              <div className="tichy pole-napoveda">Pribudnú</div>
              <p style={{ fontSize: 14, margin: "2px 0 0", overflowWrap: "anywhere" }}>
                {nahlad.nove!.slice(0, 25).join(", ")}
                {nahlad.nove!.length > 25 && ` … a ďalších ${nahlad.nove!.length - 25}`}
              </p>
            </div>
          )}

          {(nahlad.chyby?.length ?? 0) > 0 && (
            <div>
              {/* Chybné riadky sa vypíšu menovite. „5 chybných" sa nedá opraviť. */}
              <div className="tichy pole-napoveda">Tieto riadky sa preskočia</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
                {nahlad.chyby!.slice(0, 15).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              {nahlad.chyby!.length > 15 && (
                <p className="tichy pole-napoveda">… a ďalších {nahlad.chyby!.length - 15}</p>
              )}
            </div>
          )}

          <p className="tichy" style={{ fontSize: 13.5, margin: 0 }}>
            Existujúcim osobám sa <strong>nemení stav</strong> — kto sa už prihlásil,
            zostáva prihlásený. Nevyplnený jazyk sa neprepíše.
          </p>

          <div>
            <button className="tlacidlo" type="button" onClick={zapis} disabled={pracujem}>
              {pracujem ? "Zapisujem…" : "Zapísať"}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
