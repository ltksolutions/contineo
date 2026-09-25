"use client"

/**
 * Názov a kľúč položky číselníka — **kľúč sa predgeneruje z názvu**, rovnako
 * ako pri novom dokumente (`KeyPreview`, ADR-010). „Metodický pokyn" →
 * `metodicky_pokyn`.
 *
 * Kým človek do kľúča nezasiahne, kľúč nasleduje názov. Keď ho prepíše, už
 * sa nemení — ručný kľúč je vedomé rozhodnutie a písanie názvu ho nesmie
 * prepísať. Vymazaný kľúč sa znova napojí na názov.
 *
 * **Bez JavaScriptu** zostane pole prázdne a kľúč z názvu odvodí server
 * (`slugifyKey`) — to isté pravidlo na oboch stranách.
 *
 * Obsadený kľúč sa povie hneď pod poľom; rozhoduje však server.
 */

import { useState } from "react"
import { slugifyKey, slugifyTrackKey } from "@/lib/slug"

export default function KeyFromLabel({
  usedKeys,
  labels,
  layout = "inline",
  labelName = "label",
  separator = "_",
  initialLabel = "",
  initialKey = "",
  hint,
}: {
  usedKeys: string[]
  labels: {
    label: string
    labelPlaceholder: string
    key: string
    keyPlaceholder: string
    /** Veta pri obsadenom kľúči. */
    taken: string
  }
  /** `inline` — dve polia v riadku bez nadpisov; `fields` — polia s popiskami. */
  layout?: "inline" | "fields"
  /** Meno poľa názvu vo formulári — trasa ho volá `title`. */
  labelName?: string
  /** Oddeľovač v kľúči: `_` (číselníky, dokumenty) alebo `-` (trasy onboardingu). */
  separator?: "_" | "-"
  /** Hodnoty po chybe — formulár sa vráti predvyplnený. */
  initialLabel?: string
  initialKey?: string
  /** Nápoveda pod kľúčom (pri `fields`). */
  hint?: string
}) {
  const slug = separator === "-" ? slugifyTrackKey : slugifyKey
  const [label, setLabel] = useState(initialLabel)
  const [key, setKey] = useState(initialKey)
  const [manual, setManual] = useState(initialKey.trim() !== "" && initialKey !== slug(initialLabel))
  const shown = manual ? key : slug(label)
  const taken = Boolean(shown) && usedKeys.includes(shown)

  const labelInput = (
    <input className="field-input" name={labelName} required value={label}
           placeholder={labels.labelPlaceholder}
           aria-label={layout === "inline" ? labels.label : undefined}
           onChange={e => setLabel(e.target.value)} />
  )
  const keyInput = (
    <input className="field-input" name="key" value={shown}
           placeholder={labels.keyPlaceholder}
           aria-label={layout === "inline" ? labels.key : undefined}
           aria-invalid={taken || undefined}
           autoCapitalize="none" autoCorrect="off" spellCheck={false}
           style={{ maxWidth: layout === "inline" ? 220 : 260 }}
           onChange={e => {
             const v = e.target.value
             setKey(v)
             setManual(v.trim() !== "")
           }} />
  )
  const warning = taken && (
    <span className="quiet field-hint" role="status" style={{ color: "var(--bad-fg)" }}>{labels.taken}</span>
  )

  if (layout === "inline") {
    return <>{labelInput}{keyInput}{warning}</>
  }
  return (
    <>
      <label className="field">
        <span className="field-label">{labels.label}</span>
        {labelInput}
      </label>
      <label className="field">
        <span className="field-label">{labels.key}</span>
        {keyInput}
        {warning}
        {hint && <span className="quiet field-hint">{hint}</span>}
      </label>
    </>
  )
}
