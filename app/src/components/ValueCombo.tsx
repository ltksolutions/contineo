"use client"

/**
 * ValueCombo — jedno pole „Hľadať alebo pridať" navrchu karty `ValueSelect`
 * (ZAKLAD-vyber-skupin-a-znaciek Q6, 8. 10. 2026; SwiftUI `.searchable`
 * so `searchSuggestions`).
 *
 * - **Bez JavaScriptu** je to obyčajné pole `${name}New`: napísaný text (viac
 *   hodnôt čiarkou) sa odošle s formulárom ako nová hodnota a server ho
 *   porovná s existujúcimi (podobný názov, Q3).
 * - **S JavaScriptom** písanie filtruje riadky (bez diakritiky, zaškrtnuté
 *   ostávajú). Keď sa text presne nezhoduje so žiadnou hodnotou, pod riadkami
 *   pribudne „+ Pridať „…"". Ťuknutie alebo Enter vloží zaškrtnutý riadok
 *   (`${name}New`, server ho spracuje ako novú hodnotu) a pole vyprázdni.
 *   Pri presnej zhode Enter zaškrtne existujúci riadok.
 *
 * Odfiltrované riadky sú len `hidden` — ostávajú vo formulári.
 */

import { useCallback, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { foldValue } from "@/lib/valueSelect"
import { dictionary, type UiLanguage } from "@/lib/i18n"

const noop = () => () => {}

export default function ValueCombo({ name, kind, empty, language }: {
  name: string
  kind: "groups" | "tags"
  /** Zoznam je prázdny — pole len pridáva. */
  empty: boolean
  language?: UiLanguage
}) {
  const t = dictionary(language).valueSelect
  const tk = t[kind]
  // Fieldset, v ktorom pole sedí — riadky aj miesto pre pridané hodnoty.
  const [fieldset, setFieldset] = useState<HTMLFieldSetElement | null>(null)
  const box = useCallback((el: HTMLDivElement | null) => { setFieldset(el?.closest("fieldset") ?? null) }, [])
  const [query, setQuery] = useState("")
  const [offer, setOffer] = useState(false)
  const [added, setAdded] = useState<string[]>([])
  const [count, setCount] = useState<{ shown: number; total: number } | null>(null)
  // Na serveri `false`, v prehliadači `true` — ten istý vzor ako `PeopleSearch`.
  const ready = useSyncExternalStore(noop, () => true, () => false)

  const rows = () => [...(fieldset?.querySelectorAll<HTMLLabelElement>("label[data-value]") ?? [])]
  const exact = (q: string) => {
    const f = foldValue(q)
    return f ? rows().find(r => (r.dataset.value ?? "").split("\u0000").some(v => foldValue(v) === f)) ?? null : null
  }

  function filter(q: string) {
    const needle = foldValue(q)
    let shown = 0
    const all = rows()
    all.forEach(r => {
      const checked = r.querySelector("input")?.checked ?? false
      const hit = !needle || foldValue(r.dataset.value ?? "").includes(needle)
      r.hidden = !(hit || checked)
      if (!r.hidden) shown++
    })
    setCount(needle && all.length ? { shown, total: all.length } : null)
  }

  function change(q: string) {
    setQuery(q)
    filter(q)
    setOffer(q.trim() !== "" && !exact(q))
  }

  function add() {
    const v = query.trim()
    if (!v) return
    const hit = exact(v)
    if (hit) {
      const input = hit.querySelector("input")
      if (input) input.checked = true
    } else if (!added.some(a => foldValue(a) === foldValue(v))) {
      setAdded(a => [...a, v])
    }
    change("")
  }

  function key(e: KeyboardEvent<HTMLInputElement>) {
    // Enter by inak odoslal celý formulár a napísaná hodnota by sa nepridala.
    if (e.key === "Enter") { e.preventDefault(); add() }
  }

  const list = ready ? fieldset?.querySelector(".sel-added") ?? null : null

  return (
    <div ref={box} className="sel-combo">
      <span aria-hidden="true">⌕</span>
      {/* Bez JS sa text odošle ako nová hodnota; s JS sa po pridaní vyprázdni. */}
      <input type="search" name={`${name}New`} value={query}
             onChange={e => change(e.target.value)} onKeyDown={key}
             placeholder={empty ? tk.addOnly : tk.combo} aria-label={empty ? tk.addOnly : tk.combo}
             autoCapitalize="none" autoCorrect="off" />
      {count && <span className="sel-combo-count" aria-live="polite">{t.searchOf(count.shown, count.total)}</span>}
      {list && createPortal(
        <>
          {added.map(v => (
            <label key={v} className="form-row select-row">
              <input type="checkbox" name={`${name}New`} value={v} defaultChecked />
              <span className="form-row-main"><span>{v}</span><span className="form-row-sub">{tk.addSub}</span></span>
            </label>
          ))}
          {offer && (
            <button type="button" className="form-row select-row is-add" onClick={add}>
              <span className="form-row-plus" aria-hidden="true">+</span>
              <span className="form-row-main"><span>{t.addValue(query.trim())}</span><span className="form-row-sub">{tk.addSub}</span></span>
            </button>
          )}
        </>,
        list,
      )}
    </div>
  )
}
