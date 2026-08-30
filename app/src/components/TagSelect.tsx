"use client"

/**
 * VyberStitkov — výber z toho, čo v organizácii existuje.
 *
 * Skupiny a trasy sa dovtedy **písali** do textového poľa oddelené čiarkou.
 * Vyzeralo to nevinne, ale bola to pasca: `rozhodcovia` a `rozhodcova`
 * vyzerajú v poli rovnako a v databáze sú to dve skupiny, z ktorých jedna
 * nedostane nikdy nič. A personalista nemal ako vedieť, ktoré skupiny vôbec
 * existujú — musel si ich pamätať.
 *
 * Preto sa vyberá z existujúcich. **Napísať novú sa dá**, len to musí byť
 * vedomé: samostatné pole a tlačidlo, nie preklep v zozname. Nový štítok sa
 * pridá k výberu a založí sa uložením osoby — číselník skupín zámerne
 * neexistuje, zoznam sa odvodzuje z ľudí (D38).
 */

import { useState } from "react"

export interface Tag {
  hodnota: string
  /** Koľko ľudí ju má. Prázdna skupina je varovanie, nie chyba. */
  osob?: number
}

/** Rovnaká normalizácia ako `normalizeKeys()` na serveri. */
function kluc(s: string): string {
  return s.trim().toLowerCase()
}

export default function TagSelect({
  meno,
  ponuka,
  vybrane,
  popisNovej,
}: {
  meno: string
  ponuka: Tag[]
  vybrane: string[]
  popisNovej: string
}) {
  const [zvolene, setZvolene] = useState<string[]>(vybrane.map(kluc))
  const [nova, setNova] = useState("")

  // Ponuka aj to, čo osoba má, ale v organizácii to už nikto iný nemá —
  // inak by sa uložením ticho stratilo niečo, čo si nikto neželal zmazať.
  const vsetky: Tag[] = [
    ...ponuka,
    ...zvolene
      .filter(z => !ponuka.some(p => kluc(p.hodnota) === z))
      .map(z => ({ hodnota: z })),
  ]

  function prepni(h: string) {
    const k = kluc(h)
    setZvolene(z => (z.includes(k) ? z.filter(x => x !== k) : [...z, k]))
  }

  function pridaj() {
    const k = kluc(nova)
    if (!k) return
    setZvolene(z => (z.includes(k) ? z : [...z, k]))
    setNova("")
  }

  return (
    <div className="stitky">
      <input type="hidden" name={meno} value={zvolene.join(", ")} />

      {vsetky.length === 0 ? (
        <p className="tichy pole-napoveda" style={{ margin: 0 }}>
          Zatiaľ tu žiadne nie sú. Prvú vytvoríš dole.
        </p>
      ) : (
        <div className="stitky-zoznam">
          {vsetky.map(s => {
            const k = kluc(s.hodnota)
            const je = zvolene.includes(k)
            return (
              <button
                key={k}
                type="button"
                className={`stitok stitok--volba${je ? " je-zvolena" : ""}`}
                aria-pressed={je}
                onClick={() => prepni(k)}
              >
                <span className="stitok-znak" aria-hidden="true">{je ? "✓" : "+"}</span>
                {s.hodnota}
                {s.osob !== undefined && <span className="stitok-pocet">{s.osob}</span>}
              </button>
            )
          })}
        </div>
      )}

      <div className="stitky-nova">
        <input
          className="pole-vstup"
          value={nova}
          onChange={e => setNova(e.target.value)}
          placeholder={popisNovej}
          autoCapitalize="none"
          autoCorrect="off"
          // Enter by inak odoslal celý formulár a nová skupina by sa stratila.
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); pridaj() } }}
        />
        <button type="button" className="tlacidlo tlacidlo--tiche" onClick={pridaj} disabled={!nova.trim()}>
          Pridať
        </button>
      </div>

      <noscript>
        {/* Bez JavaScriptu zostáva pôvodné pole. Je horšie, ale funguje. */}
        <input
          className="pole-vstup"
          name={meno}
          defaultValue={vybrane.join(", ")}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </noscript>
    </div>
  )
}
