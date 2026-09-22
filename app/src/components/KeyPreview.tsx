"use client"

/**
 * Názov dokumentu s náhľadom identifikátora (NAHRAVANIE, úloha 4 / ADR-010).
 *
 * Kľúč sa negeneruje ručne — vzniká ako slug z názvu a formulár ukáže,
 * čo z toho bude (`sfz:pracovny_poriadok_sfz`). Prepísať sa dá, ale je to
 * vedomý krok za `<details>`, nie samostatné pole v mriežke.
 *
 * **Bez JavaScriptu sa náhľad nevykreslí vôbec** (nie prázdny): kreslí sa
 * až po pripojení. Pole názvu, ručný kľúč aj odoslanie fungujú bez skriptu
 * a server kľúč doplní tou istou funkciou (`slugifyKey`).
 *
 * Kolízia sa porovnáva so zoznamom obsadených kľúčov, ktorý stránka načíta
 * pri otvorení — bez nového API a bez dotazu pri každom údere. Zoznam môže
 * byť starý o dĺžku otvorenia formulára; poslednou bránou zostáva
 * `uploadDocument()`.
 */

import { useState, useSyncExternalStore } from "react"
import { slugifyKey } from "@/lib/slug"

export default function KeyPreview({
  prefix,
  usedKeys,
  initialTitle,
  initialKey,
  labels,
}: {
  /** Kód organizácie malými písmenami — identifikátor je `prefix:kľúč`. */
  prefix: string
  usedKeys: string[]
  initialTitle: string
  initialKey: string
  labels: {
    title: string
    titlePlaceholder: string
    titleNote: string
    preview: string
    manualSummary: string
    manualLabel: string
    manualNote: string
    taken: (id: string) => string
    keysTaken: string
  }
}) {
  const [title, setTitle] = useState(initialTitle)
  const [manual, setManual] = useState(initialKey)
  // Na serveri false, po pripojení true — náhľad sa bez skriptu nevykreslí.
  // `useSyncExternalStore` namiesto `useEffect` + `setState`: to isté bez
  // zmeny stavu v efekte (react-hooks/set-state-in-effect).
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)

  const key = manual.trim().toLowerCase() || slugifyKey(title)
  const id = key ? `${prefix}:${key}` : ""
  const taken = Boolean(key) && usedKeys.includes(key)

  return (
    <>
      <label className="field upload-wide">
        <span className="field-label">{labels.title}</span>
        <input
          className="field-input"
          name="title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          placeholder={labels.titlePlaceholder}
        />
        <span className="quiet field-hint">{labels.titleNote}</span>
        {mounted && id && (
          <span className={`key-preview${taken ? " key-preview--taken" : ""}`} aria-live="polite">
            {labels.preview} <span className="key-preview-value">{id}</span>
            {taken && <><br />{labels.taken(id)}</>}
          </span>
        )}
      </label>

      <details className="upload-wide key-manual">
        <summary>{labels.manualSummary}</summary>
        <label className="field">
          <span className="field-label">{labels.manualLabel}</span>
          <input
            className="field-input"
            name="documentKey"
            value={manual}
            onChange={e => setManual(e.target.value)}
            placeholder={slugifyKey(title) || "sutazny_poriadok"}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="quiet field-hint">{labels.manualNote}</span>
          {usedKeys.length > 0 && (
            <span className="quiet field-hint">{labels.keysTaken}{usedKeys.join(", ")}.</span>
          )}
        </label>
      </details>
    </>
  )
}
