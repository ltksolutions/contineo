"use client"

/**
 * AssignForm.tsx — klientske doplnky formulára `/hr/assign`
 * (HR-pridelit-normy-hladanie, body 4, 7 a 8).
 *
 * Formulár sám je serverový a **bez JavaScriptu funguje ako doteraz**: nič
 * z tohto súboru nemení mená ani hodnoty polí a všetko navyše (súhrn,
 * stlmenie, jantárový stav, počet v tlačidle) sa vykreslí až po načítaní
 * skriptu. Server pošle dnešný formulár.
 *
 * Výber sa číta z `FormData` celého formulára, nie zo stavu jednotlivých
 * komponentov: polia patria trom rôznym komponentom (`DocumentSearch`,
 * `MultiSelect`, `PeopleSearch`) a jediné, čo majú spoločné, je formulár —
 * a presne to isté pošle prehliadač serveru.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { audienceSignature, selectionCounts, selectionFromForm, type SelectionCounts } from "@/lib/assignSummary"

const noop = () => () => {}
const useReady = () => useSyncExternalStore(noop, () => true, () => false)

const readState = (fd: FormData) => {
  const sel = selectionFromForm(fd)
  return JSON.stringify({ sig: audienceSignature(sel), counts: selectionCounts(sel) })
}

/**
 * Sleduje formulár podľa `id`: úder, klik aj zmena skrytých polí
 * (`MultiSelect` ich pridáva a odoberá bez udalosti — preto `MutationObserver`).
 * Vracia reťazec, aby `useSyncExternalStore` porovnával hodnotu, nie objekt.
 */
function useFormSnapshot(formId: string): string | null {
  const subscribe = useCallback((notify: () => void) => {
    const form = document.getElementById(formId)
    if (!(form instanceof HTMLFormElement)) return () => {}
    form.addEventListener("input", notify)
    form.addEventListener("change", notify)
    const watch = new MutationObserver(notify)
    watch.observe(form, { subtree: true, childList: true, attributes: true, attributeFilter: ["value", "checked", "name"] })
    return () => {
      form.removeEventListener("input", notify)
      form.removeEventListener("change", notify)
      watch.disconnect()
    }
  }, [formId])
  const snapshot = () => {
    const form = document.getElementById(formId)
    return form instanceof HTMLFormElement ? readState(new FormData(form)) : null
  }
  return useSyncExternalStore(subscribe, snapshot, () => null)
}


/**
 * Súhrn výberu, dopad a tlačidlá (body 7 a 8).
 *
 * `impact` je výsledok „Skontrolovať dopad" zo servera a `previewSignature`
 * výber publika, pre ktorý sa počítal. Keď sa výber v prehliadači od neho
 * líši, dopad už neplatí: box zjantárovie a tlačidlo stratí počet — číslo
 * v tlačidle by inak sľubovalo niečo, čo sa neodošle.
 */
export function AssignFinish({
  formId,
  language,
  impact,
  previewSignature,
  previewAction,
}: {
  /** `id` formulára, ktorého výber sa sčíta. */
  formId: string
  language: UiLanguage
  impact: { people: number; breakdown: string } | null
  previewSignature: string | null
  previewAction: (fd: FormData) => Promise<void>
}) {
  const t = dictionary(language).hr.assign
  const ready = useReady()
  const raw = useFormSnapshot(formId)
  const state = raw ? (JSON.parse(raw) as { sig: string; counts: SelectionCounts }) : null
  const stale = Boolean(impact && state && previewSignature !== null && state.sig !== previewSignature)

  return (
    <div className="assign-summary">
      {ready && state && <SummaryLine counts={state.counts} language={language} />}

      {impact && (
        <div className={`assign-impact${stale ? " is-stale" : ""}`} role="status">
          {stale ? (
            <>
              <div className="assign-impact-count">{t.impactStale}</div>
              <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>{t.impactStaleNote(impact.people)}</div>
            </>
          ) : (
            <>
              <div className="assign-impact-count">{t.impactPeople(impact.people)}</div>
              <div className="quiet" style={{ fontSize: "var(--fs-small)" }}>
                {impact.breakdown}{". "}{t.impactNote}
              </div>
            </>
          )}
        </div>
      )}

      {/* Dve tlačidlá, jeden formulár: „Skontrolovať dopad" je serverová
          akcia, ktorá nič nezapíše — vráti výber v adrese a súhrn hore.
          Počet v „Prideliť" len s JS a len pre platný dopad (Q3). */}
      <div className="assign-actions">
        <button className="button" type="submit">
          {ready && impact && !stale ? t.submitN(impact.people) : t.submit}
        </button>
        <button className="button button--quiet" type="submit" formAction={previewAction}>
          {t.checkImpact}
        </button>
      </div>
    </div>
  )
}

/** „2 normy · 2 oddelenia · 1 trasa · 1 osoba" — číslo a slovo v jednom `<span>`. */
function SummaryLine({ counts, language }: { counts: SelectionCounts; language: UiLanguage }) {
  const t = dictionary(language).hr.assign.summary
  const part = (n: number, word: string) => <span key={word}><b>{n}</b> {word}</span>
  const parts: ReactNode[] = [part(counts.documents, t.documents(counts.documents))]
  if (counts.all) {
    parts.push(<span key="all"><b>{t.everyone}</b> {t.everyoneRest}</span>)
  } else {
    if (counts.departments) parts.push(part(counts.departments, t.departments(counts.departments)))
    if (counts.groups) parts.push(part(counts.groups, t.groups(counts.groups)))
    if (counts.tracks) parts.push(part(counts.tracks, t.tracks(counts.tracks)))
    if (counts.people) parts.push(part(counts.people, t.people(counts.people)))
    if (!counts.departments && !counts.groups && !counts.tracks && !counts.people) {
      parts.push(<span key="none">{t.noAudience}</span>)
    }
  }
  return (
    <p className="assign-summary-line">
      {parts.map((p, i) => (
        <span key={i} className="assign-summary-part">{i > 0 && <span aria-hidden="true">·</span>}{p}</span>
      ))}
    </p>
  )
}

/**
 * „Všetkým v organizácii" a publiká pod ním (bod 4, Q4). Zaškrtnuté prebije
 * výber nižšie — server ho ignoruje ako doteraz —, preto sa s JS zvyšok
 * stlmí. **Hodnoty sa nemažú**: kto „Všetkým" odškrtne, nájde svoj výber.
 */
export function AudienceAll({
  label,
  note,
  defaultChecked,
  children,
}: {
  label: string
  note: string
  defaultChecked: boolean
  children: ReactNode
}) {
  const [all, setAll] = useState(defaultChecked)
  const ready = useReady()
  const rest = useRef<HTMLDivElement>(null)
  const dim = ready && all
  // `inert` cez vlastnosť, nie atribút v JSX: React 18 ho ako prop nepozná.
  // Stlmené publiká tak nevezmú ani fokus z klávesnice.
  useEffect(() => { if (rest.current) rest.current.inert = dim }, [dim])

  return (
    <>
      <label className={`hr-choice assign-all${dim ? " is-on" : ""}`}>
        <input type="checkbox" name="all" value="1" defaultChecked={defaultChecked}
               onChange={e => setAll(e.target.checked)} />
        <span>
          <strong>{label}</strong>
          <span className="quiet field-hint">{" "}{note}</span>
        </span>
      </label>
      <div className={`assign-rest${dim ? " is-dim" : ""}`} ref={rest}>{children}</div>
    </>
  )
}
