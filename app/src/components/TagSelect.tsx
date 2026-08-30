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
function key(s: string): string {
  return s.trim().toLowerCase()
}

export default function TagSelect({
  meno: name,
  ponuka: options,
  vybrane: selected,
  popisNovej: newLabel,
}: {
  meno: string
  ponuka: Tag[]
  vybrane: string[]
  popisNovej: string
}) {
  const [chosen, setChosen] = useState<string[]>(selected.map(key))
  const [draft, setDraft] = useState("")

  // Ponuka aj to, čo osoba má, ale v organizácii to už nikto iný nemá —
  // inak by sa uložením ticho stratilo niečo, čo si nikto neželal zmazať.
  const all: Tag[] = [
    ...options,
    ...chosen
      .filter(z => !options.some(p => key(p.hodnota) === z))
      .map(z => ({ hodnota: z })),
  ]

  function toggle(h: string) {
    const k = key(h)
    setChosen(z => (z.includes(k) ? z.filter(x => x !== k) : [...z, k]))
  }

  function add() {
    const k = key(draft)
    if (!k) return
    setChosen(z => (z.includes(k) ? z : [...z, k]))
    setDraft("")
  }

  return (
    <div className="stitky">
      <input type="hidden" name={name} value={chosen.join(", ")} />

      {all.length === 0 ? (
        <p className="tichy pole-napoveda" style={{ margin: 0 }}>
          Zatiaľ tu žiadne nie sú. Prvú vytvoríš dole.
        </p>
      ) : (
        <div className="stitky-zoznam">
          {all.map(s => {
            const k = key(s.hodnota)
            const has = chosen.includes(k)
            return (
              <button
                key={k}
                type="button"
                className={`stitok stitok--volba${has ? " je-zvolena" : ""}`}
                aria-pressed={has}
                onClick={() => toggle(k)}
              >
                <span className="stitok-znak" aria-hidden="true">{has ? "✓" : "+"}</span>
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
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={newLabel}
          autoCapitalize="none"
          autoCorrect="off"
          // Enter by inak odoslal celý formulár a nová skupina by sa stratila.
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
        />
        <button type="button" className="tlacidlo tlacidlo--tiche" onClick={add} disabled={!draft.trim()}>
          Pridať
        </button>
      </div>

      <noscript>
        {/* Bez JavaScriptu zostáva pôvodné pole. Je horšie, ale funguje. */}
        <input
          className="pole-vstup"
          name={name}
          defaultValue={selected.join(", ")}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </noscript>
    </div>
  )
}
