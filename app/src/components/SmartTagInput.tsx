"use client"

/**
 * Vstup smart:tagov „Kľúč: Hodnota" (rám MANAGE-COURSE, ADR-018 D117).
 *
 * Pilulky s × a pole. Pred dvojbodkou návrhy **kľúčov** (s počtom hodnôt),
 * po dvojbodke **hodnoty** toho kľúča (s použitím). Enter pridá, Backspace
 * v prázdnom poli odoberie posledný. Hľadanie bez diakritiky (`fold`).
 *
 * Odosiela sa skryté pole `name` s tagmi po riadkoch — server ich prečíta
 * `parseSmartTags` (normalizácia, duplicity). Bez JavaScriptu je to
 * `<textarea>` s jedným tagom na riadok, ten istý formát.
 *
 * Použije sa aj v TESTS (otázka, test, sekcia testu).
 */

import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { fold } from "./MultiSelect"

export interface SmartTagSuggestion {
  key: string
  value: string
  label: string
  /** „1 kurz · 11 otázok" — hotový text zo servera. */
  usage: string
}

export interface SmartTagInputLabels {
  placeholder: string
  /** Šablóna s `{k}`. */
  newKey: string
  /** Šablóna s `{v}`. */
  newValue: string
  /** Šablóna s `{t}`. */
  remove: string
  /** Šablóna s `{n}`. */
  values: string
  field: string
  noScript: string
}

const noop = () => () => {}
const MAX_SUGGESTIONS = 8

function keyOf(label: string) { return label.slice(0, label.indexOf(":")).trim() }
function valueOf(label: string) { return label.slice(label.indexOf(":") + 1).trim() }

export default function SmartTagInput({ name, initial, suggestions, labels }: {
  name: string
  initial: string[]
  suggestions: SmartTagSuggestion[]
  labels: SmartTagInputLabels
}) {
  const js = useSyncExternalStore(noop, () => true, () => false)
  const [tags, setTags] = useState<string[]>(initial)
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  const keys = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>()
    for (const s of suggestions) {
      const k = keyOf(s.label)
      const e = m.get(s.key) ?? { label: k, count: 0 }
      e.count++
      m.set(s.key, e)
    }
    return [...m.values()]
  }, [suggestions])

  const colon = text.indexOf(":")
  const options: { text: string; hint: string }[] = useMemo(() => {
    if (colon < 0) {
      const q = fold(text.trim())
      const hits = keys.filter(k => !q || fold(k.label).includes(q)).slice(0, MAX_SUGGESTIONS)
        .map(k => ({ text: `${k.label}: `, hint: labels.values.replace("{n}", String(k.count)) }))
      const exact = keys.some(k => fold(k.label) === q)
      return q && !exact ? [...hits, { text: `${text.trim()}: `, hint: labels.newKey.replace("{k}", text.trim()) }] : hits
    }
    const k = fold(text.slice(0, colon).trim())
    const q = fold(text.slice(colon + 1).trim())
    const values = suggestions.filter(s => fold(keyOf(s.label)) === k && (!q || fold(valueOf(s.label)).includes(q)))
      .slice(0, MAX_SUGGESTIONS).map(s => ({ text: s.label, hint: s.usage }))
    const v = text.slice(colon + 1).trim()
    const exact = values.some(o => fold(valueOf(o.text)) === q)
    return v && !exact ? [...values, { text: `${text.slice(0, colon).trim()}: ${v}`, hint: labels.newValue.replace("{v}", v) }] : values
  }, [text, colon, keys, suggestions, labels])

  function add(label: string) {
    const clean = label.trim()
    if (clean.indexOf(":") < 1 || !valueOf(clean)) {
      // Kľúč bez hodnoty — nech človek dopíše hodnotu.
      setText(clean.endsWith(":") ? `${clean} ` : clean)
      input.current?.focus()
      return
    }
    setTags(t => (t.some(x => fold(x) === fold(clean)) ? t : [...t, clean]))
    setText("")
    setHi(0)
    input.current?.focus()
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      const o = open ? options[hi] : null
      add(o ? o.text : text)
    } else if (e.key === "Backspace" && !text && tags.length) {
      setTags(t => t.slice(0, -1))
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); setOpen(true); setHi(i => Math.min(options.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); setHi(i => Math.max(0, i - 1))
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  if (!js) {
    return (
      <>
        <textarea className="field-input" name={name} rows={4} defaultValue={initial.join("\n")} aria-label={labels.field} />
        <span className="quiet field-hint">{labels.noScript}</span>
      </>
    )
  }

  return (
    <div className="sti" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}>
      <input type="hidden" name={name} value={tags.join("\n")} />
      <div className="sti-box field-input" onClick={() => input.current?.focus()}>
        {tags.map(t => (
          <span key={t} className="stag">
            <span className="stag-k">{keyOf(t)}:</span>{valueOf(t)}
            <button type="button" className="sti-x" aria-label={labels.remove.replace("{t}", t)} onClick={() => setTags(x => x.filter(y => y !== t))}>×</button>
          </span>
        ))}
        <input
          ref={input}
          className="sti-input"
          value={text}
          placeholder={tags.length ? "" : labels.placeholder}
          aria-label={labels.field}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open && options.length > 0}
          aria-autocomplete="list"
          onChange={e => { setText(e.target.value); setOpen(true); setHi(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
      </div>
      {open && options.length > 0 && (
        <ul id={listId} className="select-list sti-list" role="listbox">
          {options.map((o, i) => (
            <li key={o.text} role="option" aria-selected={i === hi} className={`select-item${i === hi ? " is-highlighted" : ""}`}
                onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); add(o.text) }}>
              <span className="sti-opt">{o.text}</span><span className="quiet sti-hint">{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
