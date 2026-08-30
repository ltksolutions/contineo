"use client"

/**
 * Vyber — rozbaľovací výber jednej hodnoty.
 *
 * **Prečo nie natívny `<select>`:** jeho rozbalený zoznam kreslí operačný
 * systém a CSS naň nesiaha. Vo zvyšku rozhrania má všetko rovnaký rámček,
 * rádius a písmo; systémový popup z toho vypadne a v tmavej téme vyzerá ako
 * cudzí prvok. Ovládací prvok sa dá zjednotiť, zoznam nie — a práve ten je
 * vidieť v tej chvíli, keď človek vyberá.
 *
 * Cena je jasná: potrebuje JavaScript a je to viac kódu. Preto je **v
 * `<noscript>` skutočný `<select>` s tým istým `name`** — bez skriptu sa
 * formulár odošle rovnako. Prehliadač obsah `<noscript>` pri zapnutom
 * JavaScripte neparsuje ako prvky, takže sa nikdy neodošlú obe hodnoty.
 *
 * Klávesnica je súčasť zadania, nie ozdoba: `<select>` sa ňou ovládať dá
 * a náhrada, ktorá to nevie, je krok späť.
 */

import { useEffect, useId, useRef, useState } from "react"

export interface SelectOption {
  hodnota: string
  popis: string
}

export default function Select({
  meno,
  volby,
  predvolena,
  popisPola,
}: {
  meno: string
  volby: SelectOption[]
  predvolena?: string
  /** Pre čítačky obrazovky, keď `<label>` obaľuje celý blok. */
  popisPola?: string
}) {
  const [hodnota, setHodnota] = useState(predvolena ?? volby[0]?.hodnota ?? "")
  const [otvorene, setOtvorene] = useState(false)
  const [zvyraznena, setZvyraznena] = useState(0)
  const obal = useRef<HTMLDivElement>(null)
  const id = useId()

  const vybrana = volby.find(v => v.hodnota === hodnota) ?? volby[0]

  // Kliknutie mimo aj Escape zatvárajú. Bez toho zostane zoznam otvorený,
  // človek klikne inam a nechápe, prečo mu prekáža.
  useEffect(() => {
    if (!otvorene) return
    const mimo = (e: MouseEvent) => {
      if (!obal.current?.contains(e.target as Node)) setOtvorene(false)
    }
    document.addEventListener("mousedown", mimo)
    return () => document.removeEventListener("mousedown", mimo)
  }, [otvorene])

  function otvor() {
    setZvyraznena(Math.max(0, volby.findIndex(v => v.hodnota === hodnota)))
    setOtvorene(true)
  }

  function vyber(v: SelectOption) {
    setHodnota(v.hodnota)
    setOtvorene(false)
  }

  function klavesa(e: React.KeyboardEvent) {
    if (!otvorene) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        otvor()
      }
      return
    }
    if (e.key === "Escape") { e.preventDefault(); setOtvorene(false); return }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const v = volby[zvyraznena]
      if (v) vyber(v)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setZvyraznena(i => Math.min(volby.length - 1, i + 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setZvyraznena(i => Math.max(0, i - 1))
      return
    }
    if (e.key === "Home") { e.preventDefault(); setZvyraznena(0); return }
    if (e.key === "End") { e.preventDefault(); setZvyraznena(volby.length - 1) }
  }

  return (
    <div className="vyber" ref={obal}>
      <input type="hidden" name={meno} value={hodnota} />

      <button
        type="button"
        className="pole-vstup vyber-tlacidlo"
        aria-haspopup="listbox"
        aria-expanded={otvorene}
        aria-label={popisPola}
        onClick={() => (otvorene ? setOtvorene(false) : otvor())}
        onKeyDown={klavesa}
      >
        <span>{vybrana?.popis ?? "—"}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="vyber-sipka">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {otvorene && (
        <ul className="vyber-zoznam" role="listbox" aria-labelledby={id} tabIndex={-1}>
          {volby.map((v, i) => (
            <li
              key={v.hodnota}
              role="option"
              aria-selected={v.hodnota === hodnota}
              className={`vyber-polozka${i === zvyraznena ? " je-zvyraznena" : ""}`}
              onMouseEnter={() => setZvyraznena(i)}
              // `onMouseDown` a nie `onClick`: klik by najprv spustil
              // poslucháča „mimo" a zoznam by sa zavrel skôr, než sa vyberie.
              onMouseDown={e => { e.preventDefault(); vyber(v) }}
            >
              <span className="vyber-znak" aria-hidden="true">
                {v.hodnota === hodnota ? "✓" : ""}
              </span>
              {v.popis}
            </li>
          ))}
        </ul>
      )}

      {/* Bez JavaScriptu sa odošle toto. Pri zapnutom JS to prehliadač
          neparsuje ako prvky, takže sa hodnota nikdy neodošle dvakrát. */}
      <noscript>
        <select className="pole-vstup" name={meno} defaultValue={predvolena}>
          {volby.map(v => <option key={v.hodnota} value={v.hodnota}>{v.popis}</option>)}
        </select>
      </noscript>
    </div>
  )
}
