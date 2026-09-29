/**
 * SearchStrip — pole hľadania v zozname (knižnica, adresár, osoby).
 *
 * Pás 36 px s lupou **vnútri rámika** (`ZAKLAD.html`, „pás 36 px so
 * značkou — hlavička · lišta zoznamu"; `KNIZNICA.html`, `.library-search`).
 * Ten istý tvar ako pole v hlavičke, len s lupou namiesto bubliny: hľadá sa
 * reťazec v zozname, nepýta sa model (`ZAKLAD.md`, odchýlka B).
 *
 * Dovtedy mali tieto tri obrazovky lupu **pred** poľom a pole s vlastným
 * rámikom vedľa nej — ikona tak visela vo vzduchu a pole vyzeralo ako
 * ktorékoľvek pole formulára, nie ako hľadanie.
 *
 * Bez stavu a bez skriptu: pole je súčasť formulára okolo (`LiveFilter`).
 * Tlačidlo na odoslanie je len pre čítačku a klávesnicu — Enter v poli robí
 * to isté a viditeľné tlačidlo by lištu roztiahlo (rovnako ako v hlavičke).
 */

import type { InputHTMLAttributes } from "react"
import Icon from "./Icon"

export default function SearchStrip({
  name,
  defaultValue,
  placeholder,
  label,
  submitLabel,
  className,
  ...input
}: {
  name: string
  defaultValue?: string
  placeholder: string
  /** Meno poľa pre čítačku — viditeľný popis lišta nemá. */
  label: string
  /** Neviditeľné tlačidlo na odoslanie; bez neho sa odosiela Enterom. */
  submitLabel?: string
  className?: string
} & Pick<InputHTMLAttributes<HTMLInputElement>, "autoCapitalize" | "autoCorrect">) {
  return (
    <div className={`search-strip${className ? ` ${className}` : ""}`}>
      <span className="search-strip-icon" aria-hidden="true">
        <Icon name="search" size={16} />
      </span>
      <input
        type="search"
        className="search-strip-input"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        {...input}
      />
      {submitLabel && <button type="submit" className="sr-only">{submitLabel}</button>}
    </div>
  )
}
