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
  value: string
  label: string
}

export default function Select({
  name: name,
  options: options,
  initial: initial,
  fieldLabel: fieldLabel,
}: {
  name: string
  options: SelectOption[]
  initial?: string
  /** Pre čítačky obrazovky, keď `<label>` obaľuje celý blok. */
  fieldLabel?: string
}) {
  const [value, setValue] = useState(initial ?? options[0]?.value ?? "")
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const id = useId()

  const selected = options.find(v => v.value === value) ?? options[0]

  // Kliknutie mimo aj Escape zatvárajú. Bez toho zostane zoznam otvorený,
  // človek klikne inam a nechápe, prečo mu prekáža.
  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", outside)
    return () => document.removeEventListener("mousedown", outside)
  }, [open])

  function openList() {
    setHighlighted(Math.max(0, options.findIndex(v => v.value === value)))
    setOpen(true)
  }

  function pick(v: SelectOption) {
    setValue(v.value)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      const v = options[highlighted]
      if (v) pick(v)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlighted(i => Math.min(options.length - 1, i + 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlighted(i => Math.max(0, i - 1))
      return
    }
    if (e.key === "Home") { e.preventDefault(); setHighlighted(0); return }
    if (e.key === "End") { e.preventDefault(); setHighlighted(options.length - 1) }
  }

  return (
    <div className="vyber" ref={wrap}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        className="pole-vstup vyber-tlacidlo"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={fieldLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
      >
        <span>{selected?.label ?? "—"}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="vyber-sipka">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="vyber-zoznam" role="listbox" aria-labelledby={id} tabIndex={-1}>
          {options.map((v, i) => (
            <li
              key={v.value}
              role="option"
              aria-selected={v.value === value}
              className={`vyber-polozka${i === highlighted ? " je-zvyraznena" : ""}`}
              onMouseEnter={() => setHighlighted(i)}
              // `onMouseDown` a nie `onClick`: klik by najprv spustil
              // poslucháča „mimo" a zoznam by sa zavrel skôr, než sa vyberie.
              onMouseDown={e => { e.preventDefault(); pick(v) }}
            >
              <span className="vyber-znak" aria-hidden="true">
                {v.value === value ? "✓" : ""}
              </span>
              {v.label}
            </li>
          ))}
        </ul>
      )}

      {/* Bez JavaScriptu sa odošle toto. Pri zapnutom JS to prehliadač
          neparsuje ako prvky, takže sa hodnota nikdy neodošle dvakrát. */}
      <noscript>
        <select className="pole-vstup" name={name} defaultValue={initial}>
          {options.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      </noscript>
    </div>
  )
}
