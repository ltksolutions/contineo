"use client"

/**
 * ValueSearch — pole „Hľadať…" nad riadkami `ValueSelect`
 * (ZAKLAD-vyber-skupin-a-znaciek Q5, od 12 možností). Bez JavaScriptu sa
 * nevykreslí vôbec a všetky riadky ostanú vidno. Odfiltrované riadky sú len
 * `hidden` — ostávajú vo formulári, zaškrtnuté sa skryť nedajú.
 */

import { useRef, useState, useSyncExternalStore } from "react"
import { foldValue } from "@/lib/valueSelect"
import { dictionary, type UiLanguage } from "@/lib/i18n"

const noop = () => () => {}

export default function ValueSearch({ label, language }: { label: string; language?: UiLanguage }) {
  const of = dictionary(language).valueSelect.searchOf
  const [count, setCount] = useState<{ shown: number; total: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  // Vykresliť až po načítaní skriptu — bez JS by bolo pole, ktoré nič nerobí.
  // Na serveri `false`, v prehliadači `true` (ten istý vzor ako `PeopleSearch`).
  const ready = useSyncExternalStore(noop, () => true, () => false)

  function filter(q: string) {
    const rows = box.current?.parentElement?.querySelectorAll<HTMLLabelElement>("label[data-value]") ?? []
    const needle = foldValue(q)
    let shown = 0
    rows.forEach(r => {
      const checked = r.querySelector("input")?.checked ?? false
      const hit = !needle || foldValue(r.dataset.value ?? "").includes(needle)
      r.hidden = !(hit || checked)
      if (!r.hidden) shown++
    })
    setCount(needle ? { shown, total: rows.length } : null)
  }

  if (!ready) return <div ref={box} hidden />
  return (
    <div ref={box} className="sel-search">
      <span aria-hidden="true">⌕</span>
      <input type="search" aria-label={label} placeholder={label} onChange={e => filter(e.target.value)} autoCapitalize="none" autoCorrect="off" />
      {count && <span className="sel-search-count" aria-live="polite">{of(count.shown, count.total)}</span>}
    </div>
  )
}
