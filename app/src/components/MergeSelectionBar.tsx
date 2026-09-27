"use client"

/**
 * Pás „Vybraté 3 · Zlúčiť do…" (rám MANAGE, zlúčenie smart:tagov).
 *
 * Výber sú obyčajné políčka vo `<form method="get">`; tento pás len
 * priebežne ukazuje ich počet a od dvoch vybraných sa objaví. Bez
 * JavaScriptu je vidieť stále ako tlačidlo „Zlúčiť vybraté" — formulár
 * funguje rovnako (server vráti krok 2 alebo chybu pri jednom tagu).
 */

import { useEffect, useState, useSyncExternalStore } from "react"

const noop = () => () => {}

export default function MergeSelectionBar({ formId, labels }: {
  formId: string
  labels: { selected: string; mergeInto: string; clear: string; mergeSelected: string }
}) {
  const js = useSyncExternalStore(noop, () => true, () => false)
  const [count, setCount] = useState(0)

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return
    const read = () => setCount(form.querySelectorAll('input[name="sel"]:checked').length)
    form.addEventListener("change", read)
    read()
    return () => form.removeEventListener("change", read)
  }, [formId])

  function clear() {
    const form = document.getElementById(formId) as HTMLFormElement | null
    form?.querySelectorAll<HTMLInputElement>('input[name="sel"]:checked').forEach(i => { i.checked = false })
    setCount(0)
  }

  if (!js) {
    return <div className="tg-bar"><button type="submit" form={formId} className="button button--quiet">{labels.mergeSelected}</button></div>
  }
  if (count < 2) return null
  return (
    <div className="tg-bar is-on" role="region" aria-live="polite">
      <span className="tg-bar-count">{labels.selected.replace("{n}", String(count))}</span>
      <button type="submit" form={formId} className="button">{labels.mergeInto}</button>
      <button type="button" className="button button--quiet" onClick={clear}>{labels.clear}</button>
    </div>
  )
}
