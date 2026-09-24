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
 *
 * **Hľadanie** (rám KOMPONENT-vyber-oddelenia, 24. 9. 2026) sa zapína samo
 * od 8 možností: pole hľadania hore v zozname, bez diakritiky, výsledky
 * s cestou v strome. Pri krátkych zoznamoch (Prístup, Jazyk) by prekážalo.
 * Stromové položky nesú `path` („A › B") namiesto odsadenia „— — ".
 */

import { useEffect, useId, useRef, useState } from "react"
import { fold } from "./MultiSelect"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export interface SelectOption {
  value: string
  label: string
  /** Cesta v strome nad položkou („Konferencia › Prezident"), ak je. */
  path?: string
}

/** Od koľkých možností sa ukáže hľadanie. */
export const SEARCH_FROM = 8

/** Kúsok textu so zvýraznenou zhodou. Porovnáva sa bez diakritiky. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim())
  if (!q) return <>{text}</>
  const at = fold(text).indexOf(q)
  if (at < 0) return <>{text}</>
  return <>{text.slice(0, at)}<mark>{text.slice(at, at + q.length)}</mark>{text.slice(at + q.length)}</>
}

export default function Select({
  name: name,
  options: options,
  initial: initial,
  fieldLabel: fieldLabel,
  form: form,
  searchable,
  required = false,
  searchPlaceholder,
  emptyText,
  language,
}: {
  name: string
  options: SelectOption[]
  initial?: string
  /** Pre čítačky obrazovky, keď `<label>` obaľuje celý blok. */
  fieldLabel?: string
  /**
   * `id` formulára, do ktorého hodnota patrí — keď výber **nestojí vnútri
   * neho**. Používa to zásuvka presunu v knižnici: leží vnútri formulára
   * hromadných akcií, ale odosiela sa vlastným formulárom, a vnorený
   * `<form>` by nebol platné HTML.
   */
  form?: string
  /** Hľadanie v zozname. Predvolene od `SEARCH_FROM` možností. */
  searchable?: boolean
  /**
   * Povinná neprázdna hodnota. S JavaScriptom ju stráži skryté povinné pole
   * (prehliadač ukáže bublinu ako pri `<select required>`), bez neho
   * `<noscript><select required>`.
   */
  required?: boolean
  searchPlaceholder?: string
  emptyText?: string
  /** Jazyk prostredia — pre text v poli hľadania a prázdny výsledok. */
  language?: UiLanguage
}) {
  const tm = dictionary(language).multiSelect
  const [value, setValue] = useState(initial ?? (required ? "" : options[0]?.value) ?? "")
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [query, setQuery] = useState("")
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const id = useId()

  const withSearch = searchable ?? options.length >= SEARCH_FROM
  const q = fold(query.trim())
  const visible = q
    ? options.filter(o => fold(o.label).includes(q) || fold(o.path ?? "").includes(q))
    : options
  const selected = options.find(v => v.value === value) ?? (required ? undefined : options[0])

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

  useEffect(() => {
    if (open && withSearch) search.current?.focus()
  }, [open, withSearch])

  function openList() {
    setQuery("")
    setHighlighted(Math.max(0, options.findIndex(v => v.value === value)))
    setOpen(true)
  }

  function pick(v: SelectOption) {
    setValue(v.value)
    setOpen(false)
    setQuery("")
    button.current?.focus()
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); button.current?.focus(); return }
    // V poli hľadania je medzera písmeno, nie výber.
    if (e.key === "Enter" || (e.key === " " && !withSearch)) {
      e.preventDefault()
      const v = visible[highlighted]
      if (v) pick(v)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlighted(i => Math.min(visible.length - 1, i + 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlighted(i => Math.max(0, i - 1))
      return
    }
    if (!withSearch && e.key === "Home") { e.preventDefault(); setHighlighted(0); return }
    if (!withSearch && e.key === "End") { e.preventDefault(); setHighlighted(visible.length - 1) }
  }

  return (
    <div className="select" ref={wrap}>
      <input type="hidden" name={name} value={value} form={form} />
      {/* Povinnosť s JavaScriptom: prehliadač overí toto pole a bublinu
          ukáže pri ňom. Nemá meno, takže sa neodošle. */}
      {required && (
        <input className="select-required" tabIndex={-1} aria-hidden="true" required
               value={value} onChange={() => {}} form={form}
               onInvalid={() => button.current?.focus()} />
      )}

      <button
        ref={button}
        type="button"
        className="field-input select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={fieldLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
      >
        <span className="select-value">
          <span>{selected?.label ?? "—"}</span>
          {selected?.path && <span className="select-path">{selected.path}</span>}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="select-arrow">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="select-pop">
          {withSearch && (
            <input
              ref={search}
              className="select-search"
              type="search"
              value={query}
              placeholder={searchPlaceholder ?? tm.searchHint}
              aria-label={fieldLabel ?? searchPlaceholder ?? tm.searchHint}
              aria-controls={id}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
              onKeyDown={onKey}
            />
          )}
          <ul className="select-list" id={id} role="listbox" tabIndex={-1}>
            {visible.map((v, i) => (
              <li
                key={v.value}
                role="option"
                aria-selected={v.value === value}
                className={`select-item${i === highlighted ? " is-highlighted" : ""}`}
                onMouseEnter={() => setHighlighted(i)}
                // `onMouseDown` a nie `onClick`: klik by najprv spustil
                // poslucháča „mimo" a zoznam by sa zavrel skôr, než sa vyberie.
                onMouseDown={e => { e.preventDefault(); pick(v) }}
              >
                <span className="select-mark" aria-hidden="true">
                  {v.value === value ? "✓" : ""}
                </span>
                <span className="select-value">
                  <span><Highlight text={v.label} query={query} /></span>
                  {v.path && <span className="select-path"><Highlight text={v.path} query={query} /></span>}
                </span>
              </li>
            ))}
            {visible.length === 0 && <li className="select-empty">{emptyText ?? tm.nothingFound}</li>}
          </ul>
        </div>
      )}

      {/* Bez JavaScriptu sa odošle toto. Pri zapnutom JS to prehliadač
          neparsuje ako prvky, takže sa hodnota nikdy neodošle dvakrát. */}
      <noscript>
        <select className="field-input" name={name} defaultValue={initial ?? ""} form={form} required={required}>
          {required && !initial && <option value="" disabled>—</option>}
          {options.map(v => (
            <option key={v.value} value={v.value}>{v.path ? `${v.path} › ${v.label}` : v.label}</option>
          ))}
        </select>
      </noscript>
    </div>
  )
}
