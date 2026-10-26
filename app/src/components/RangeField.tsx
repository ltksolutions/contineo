"use client"

/**
 * RangeField — posuvník v rozsahu (SwiftUI `Slider`), trieda `.field-range`
 * v design systéme (Ján 25. 10. 2026, `.design-sync/conventions.md`).
 *
 * Natívny `<input type="range">` s farbou organizácie (`accent-color`), nad
 * ním popis a aktuálna hodnota, pod ním krajné hodnoty a nápoveda. Na malé
 * celé čísla s rozumnou predvoľbou, nie na presnú sumu či dátum — tam je pole.
 *
 * **Bez JavaScriptu** posuvník funguje a odošle sa vo formulári; číslo vedľa
 * popisu ukáže uloženú hodnotu a pri posúvaní sa len neprekresľuje.
 */

import { useState } from "react"

export default function RangeField({
  name, label, hint, min, max, step = 1, defaultValue,
}: {
  /** Názov poľa vo formulári. */
  name: string
  label: string
  hint?: string
  min: number
  max: number
  step?: number
  defaultValue: number
}) {
  const [value, setValue] = useState(defaultValue)
  const id = `range-${name}`
  return (
    <div className="field field-range">
      <div className="field-range-head">
        <label className="field-label" htmlFor={id}>{label}</label>
        <output className="field-range-value" htmlFor={id} aria-live="polite">{value}</output>
      </div>
      <input
        id={id}
        className="field-range-input"
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        onInput={e => setValue(Number((e.target as HTMLInputElement).value))}
      />
      <div className="field-range-scale quiet" aria-hidden="true"><span>{min}</span><span>{max}</span></div>
      {hint && <span className="quiet field-hint">{hint}</span>}
    </div>
  )
}
