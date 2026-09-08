"use client"

/**
 * MultiSelect — viacnásobný výber s hľadaním.
 *
 * `TagSelect` vypíše všetky možnosti naraz ako pilulky. Pri skupinách osôb to
 * stačí — je ich pár. Pri oddeleniach, štítkoch knižnice a schvaľovateľoch nie:
 * tridsať pilulák je stena, v ktorej sa nedá nič nájsť, a formulár sa kvôli
 * jednému poľu roztiahne na dve obrazovky.
 *
 * Preto tento tvar: zvolené sú vidieť ako chips, ostatné sa hľadajú písaním.
 * Hľadá sa **bez diakritiky** — kto píše „oddelenie", myslí „Oddelenie", a nútiť ho
 * trafiť dĺžne v poli, ktoré má hľadanie zjednodušiť, je posmech.
 *
 * Čo je prevzaté zo `Select.tsx` a nie je to náhoda:
 *  • výber na `onMouseDown` s `preventDefault()` — pri `onClick` by poslucháč
 *    „klik mimo" zatvoril zoznam skôr, než sa hodnota vyberie,
 *  • `<noscript>` s obyčajným textovým poľom rovnakého mena — bez skriptu sa
 *    formulár odošle rovnako, len nepohodlnejšie,
 *  • klávesnica je súčasť zadania, nie ozdoba.
 *
 * Rozmery zámerne sedia s `Select.tsx`, nie s prototypom z handoffu: obe polia
 * stoja na tom istom formulári vedľa seba a o 2 px menšie písmo v jednom z nich
 * vyzerá ako chyba. Kompaktný tvar z návrhu knižnice príde s premennými hustoty.
 */

import { useEffect, useId, useRef, useState } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export interface MultiSelectOption {
  value: string
  label: string
  /** Koľko záznamov ju má. Zobrazuje sa vpravo v zozname, keď je známy. */
  count?: number
}

/**
 * Rovnaká normalizácia ako `normalizeKeys()` v `lib/persons.ts` a `splitList()`
 * v `lib/oauth.ts`.
 *
 * **Bez podčiarkovníkov.** Handoff navrhoval `replace(/\s+/g, "_")`, ale server
 * medzery necháva — „právne a legislatíva" by sa uložilo dvakrát v dvoch
 * tvaroch a jeden z nich by nikdy nikomu nesadol.
 */
export function normalizeValue(value: string): string {
  return value.trim().toLowerCase()
}

/** Text bez diakritiky a veľkých písmen. Slúži len na porovnávanie. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

/**
 * Ponuka vrátane hodnôt, ktoré záznam má, ale v organizácii ich už nikto iný
 * nemá — inak by sa uložením ticho stratilo niečo, čo nikto nezmazal.
 * Rovnaký dôvod ako v `TagSelect.tsx`.
 */
export function mergeOptions(options: MultiSelectOption[], chosen: string[]): MultiSelectOption[] {
  const known = new Set(options.map(o => normalizeValue(o.value)))
  return [
    ...options,
    ...chosen.filter(v => !known.has(v)).map(v => ({ value: v, label: v })),
  ]
}

/** Položky, ktoré vyhovujú napísanému textu. Prázdny dotaz vráti všetko. */
export function filterOptions(all: MultiSelectOption[], query: string): MultiSelectOption[] {
  const q = fold(query.trim())
  if (!q) return all
  return all.filter(o => fold(o.label).includes(q) || fold(o.value).includes(q))
}

/**
 * Tvar pre skryté pole. Čiarka a medzera, rovnako ako `TagSelect` — server to
 * číta `splitList()`, ktorému je oddeľovač aj medzery jedno.
 */
export function serialize(chosen: string[]): string {
  return chosen.join(", ")
}

/**
 * Ako sa vybrané hodnoty dostanú do odoslaného formulára.
 *
 * `csv` je jedno pole s hodnotami oddelenými čiarkou — tak to číta server
 * pri ukladaní záznamu (`splitList()`), a `FormData.get()` by z opakovaného
 * kľúča vrátil len prvú hodnotu.
 *
 * `repeat` je jedno pole na každú hodnotu, teda `?tag=a&tag=b` v adrese —
 * tvar, ktorý prehliadač posiela z políčok a ktorý filtre knižnice čítajú
 * ako zoznam. V jednom poli s čiarkou by bola adresa neprečítateľná pre
 * kohokoľvek okrem nás.
 */
export type EmitShape = "csv" | "repeat"

export default function MultiSelect({
  name: name,
  label: label,
  options: options,
  selected: selected,
  placeholder: placeholder,
  allowNew: allowNew = false,
  emit: emit = "csv",
  language,
}: {
  name: string
  /** Popis nad poľom. Keď chýba, pole si ho vypýta obal cez `<label>`. */
  label?: string
  options: MultiSelectOption[]
  selected: string[]
  placeholder?: string
  /** Smie sa napísať hodnota, ktorá v ponuke nie je? Pri číselníkoch nie. */
  allowNew?: boolean
  /** Tvar skrytého poľa — `csv` do formulára záznamu, `repeat` do adresy. */
  emit?: EmitShape
  /** Jazyk prostredia. */
  language?: UiLanguage
}) {
  const t = dictionary(language).multiSelect
  const [chosen, setChosen] = useState<string[]>(selected.map(normalizeValue))
  const [extra, setExtra] = useState<MultiSelectOption[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const all = mergeOptions([...options, ...extra], chosen)
  const visible = filterOptions(all, query)
  const byValue = new Map(all.map(o => [normalizeValue(o.value), o.label]))

  // Kliknutie mimo aj Escape zatvárajú — bez toho zoznam prekrýva formulár
  // a človek nechápe, prečo sa nedá kliknúť na ďalšie pole.
  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", outside)
    return () => document.removeEventListener("mousedown", outside)
  }, [open])

  function toggle(value: string) {
    const v = normalizeValue(value)
    setChosen(z => (z.includes(v) ? z.filter(x => x !== v) : [...z, v]))
  }

  /** Napísaná hodnota: buď sadne na existujúcu položku, alebo vznikne nová. */
  function addTyped() {
    const raw = query.trim()
    if (!raw) return
    const hit = all.find(o => fold(o.label) === fold(raw) || fold(o.value) === fold(raw))
    const value = normalizeValue(hit ? hit.value : raw)
    if (!hit) {
      if (!allowNew) return
      // Pôvodný zápis si pamätáme kvôli chipu: v ňom má byť „Právne
      // a legislatíva", nie „právne a legislatíva".
      setExtra(z => (z.some(o => normalizeValue(o.value) === value) ? z : [...z, { value, label: raw }]))
    }
    setChosen(z => (z.includes(value) ? z : [...z, value]))
    setQuery("")
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); return }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
      setHighlighted(i => Math.min(visible.length - 1, i + 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlighted(i => Math.max(0, i - 1))
      return
    }
    if (e.key === "Enter") {
      // Bez toho by Enter odoslal celý formulár a rozpísaná hodnota by sa
      // stratila — rovnaká pasca ako v `TagSelect`.
      e.preventDefault()
      const pick = open ? visible[highlighted] : undefined
      if (pick && query.trim() === "") toggle(pick.value)
      else if (query.trim() !== "") addTyped()
      else setOpen(true)
      return
    }
    if (e.key === "Backspace" && query === "" && chosen.length > 0) {
      setChosen(z => z.slice(0, -1))
    }
  }

  return (
    <div className="multiselect" ref={wrap}>
      {emit === "repeat"
        ? chosen.map(v => <input key={v} type="hidden" name={name} value={v} />)
        : <input type="hidden" name={name} value={serialize(chosen)} />}

      {label && <span className="multiselect-label">{label}</span>}

      {/* Celá kontrolka je klikacia plocha pre vstup — pri poli, ktoré vyzerá
          ako rámček s textom, človek klikne kamkoľvek doň, nie do 70 px
          medzery medzi poslednou chipsou a okrajom. */}
      <div className="multiselect-control" onClick={() => { input.current?.focus(); setOpen(true) }}>
        {chosen.map(v => (
          <span key={v} className="multiselect-chip">
            {byValue.get(v) ?? v}
            <button
              type="button"
              className="multiselect-chip-remove"
              aria-label={t.remove(byValue.get(v) ?? v)}
              onClick={e => { e.stopPropagation(); toggle(v) }}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={input}
          className="multiselect-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={label}
          value={query}
          placeholder={chosen.length ? "" : (placeholder ?? t.searchHint)}
          autoCapitalize="none"
          autoCorrect="off"
          onChange={e => { setQuery(e.target.value); setOpen(true); setHighlighted(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />

        {chosen.length > 0 && (
          <span className="multiselect-counter" aria-label={t.chosenOf(chosen.length, all.length)}>
            {chosen.length}/{all.length}
          </span>
        )}
      </div>

      {open && (
        <div className="multiselect-list" id={listId} role="listbox" aria-multiselectable="true">
          {visible.map((o, i) => {
            const v = normalizeValue(o.value)
            const has = chosen.includes(v)
            return (
              <div
                key={v}
                role="option"
                aria-selected={has}
                className={`multiselect-option${i === highlighted ? " is-highlighted" : ""}`}
                onMouseEnter={() => setHighlighted(i)}
                // `onMouseDown` a nie `onClick`: klik by najprv spustil
                // poslucháča „mimo" a zoznam by sa zavrel skôr, než sa vyberie.
                onMouseDown={e => { e.preventDefault(); toggle(v) }}
              >
                <span className="multiselect-mark" aria-hidden="true">{has ? "✓" : ""}</span>
                <span className="multiselect-option-name">{o.label}</span>
                {o.count !== undefined && <span className="multiselect-option-count">{o.count}</span>}
              </div>
            )
          })}

          {visible.length === 0 && (
            <p className="multiselect-empty">
              {all.length === 0 ? t.empty : allowNew ? t.nothingFoundNew : t.nothingFound}
            </p>
          )}

          <div className="multiselect-footer">
            <button
              type="button"
              className="multiselect-clear"
              onMouseDown={e => { e.preventDefault(); setChosen([]) }}
            >
              {t.clearAll}
            </button>
            <button
              type="button"
              className="multiselect-done"
              onMouseDown={e => { e.preventDefault(); setOpen(false); setQuery("") }}
            >
              {t.done}
            </button>
          </div>
        </div>
      )}

      {/* Bez JavaScriptu zostáva pôvodné pole. Je horšie, ale funguje —
          a odošle sa rovnaký tvar, aký číta `splitList()`. */}
      <noscript>
        <input
          className="field-input"
          name={name}
          defaultValue={serialize(selected.map(normalizeValue))}
          autoCapitalize="none"
          autoCorrect="off"
        />
      </noscript>
    </div>
  )
}
