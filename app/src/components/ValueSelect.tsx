/**
 * ValueSelect — výber skupín osôb a značiek dokumentov
 * (ZAKLAD-vyber-skupin-a-znaciek, 8. 10. 2026; nahradil `TagSelect`).
 *
 * `List(selection:)` + `Section`: `.form-group` s kartou riadkov
 * `.select-row` (natívny checkbox, celý riadok terč 44 px), vpravo tlmený
 * počet. Navrchu karty jedno pole „Hľadať alebo pridať" (`ValueCombo`, Q6,
 * pri každom počte) — bez JS je to pole novej hodnoty (`${name}New`, viac
 * hodnôt čiarkou), s JS filtruje riadky a ponúkne „+ Pridať".
 *
 * - Hodnota, ktorú má len táto osoba / dokument, je vždy v zozname
 *   a zaškrtnutá s „len tu" — uložením sa nesmie ticho stratiť.
 * - Poradie: zaškrtnuté hore, ostatné abecedne (Q4).
 */

import type { ReactNode } from "react"
import Link from "next/link"
import ValueCombo from "@/components/ValueCombo"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export interface ValueOption {
  value: string
  /** Názov na obrazovke; bez neho sa ukáže hodnota (kľúč). */
  label?: string
  /** Koľko ľudí / dokumentov ju má. */
  count?: number
  /** Podnadpis pod názvom (napr. „nie je v číselníku"). */
  sub?: string
}

export default function ValueSelect({
  kind, name, legend, options, selected, language, prefillNew, forced, warning,
}: {
  /** Skupiny osôb alebo značky dokumentov — určuje texty. */
  kind: "groups" | "tags"
  name: string
  legend: string
  options: ValueOption[]
  selected: string[]
  language?: UiLanguage
  /** Predvyplnená nová hodnota (voľba „Založiť napriek tomu"). */
  prefillNew?: string
  /** Hodnota, ktorá sa uloží aj napriek podobnosti (`${name}Force`). */
  forced?: string
  /** Varovanie pri podobnom názve — `.sel-warn` v karte pod riadkami. */
  warning?: ReactNode
}) {
  const t = dictionary(language).valueSelect
  const labels = { ...t[kind], onlyHere: t.onlyHere }
  const key = (s: string) => s.trim().toLowerCase()
  const chosen = new Set(selected.map(key))
  const all: ValueOption[] = [
    ...options,
    ...[...chosen].filter(v => !options.some(o => key(o.value) === v)).map(v => ({ value: v })),
  ]
  const name_ = (o: ValueOption) => o.label ?? o.value
  const sorted = [
    ...all.filter(o => chosen.has(key(o.value))),
    ...all.filter(o => !chosen.has(key(o.value))).sort((a, b) => name_(a).localeCompare(name_(b), "sk")),
  ]

  return (
    <fieldset className="form-group">
      <legend className="form-group-head">{legend}</legend>
      <div className="card form-group-body form-group-body--rows">
        <ValueCombo name={name} kind={kind} empty={sorted.length === 0} language={language} />
        <div className="form-list">
          {sorted.map(o => {
            const on = chosen.has(key(o.value))
            const only = on && (o.count ?? 0) <= 1
            return (
              <label key={o.value} className="form-row select-row" data-value={`${name_(o)}\u0000${o.value}`}>
                <input type="checkbox" name={name} value={o.value} defaultChecked={on} />
                <span className="form-row-main">
                  <span>{name_(o)}</span>
                  {o.sub && <span className="form-row-sub">{o.sub}</span>}
                </span>
                {only
                  ? <span className="form-row-detail is-only">{labels.onlyHere}</span>
                  : o.count !== undefined && <span className="form-row-detail">{labels.count(o.count)}</span>}
              </label>
            )
          })}
          {/* Sem `ValueCombo` vloží pridané hodnoty a riadok „+ Pridať". */}
          <div className="sel-added" />
        </div>
        {/* „Založiť napriek tomu" (Q3): nová hodnota je zaškrtnutý riadok. */}
        {prefillNew && (
          <div className="form-list">
            <label className="form-row select-row">
              <input type="checkbox" name={`${name}New`} value={prefillNew} defaultChecked />
              <span className="form-row-main"><span>{prefillNew}</span><span className="form-row-sub">{labels.addSub}</span></span>
            </label>
          </div>
        )}
        {forced && <input type="hidden" name={`${name}Force`} value={forced} />}
        {warning}
      </div>
      <p className="form-group-foot quiet">{sorted.length ? labels.foot : labels.emptyFoot}</p>
    </fieldset>
  )
}

/** Hodnoty mimo číselníka (bez názvu) dostanú podnadpis „nie je v číselníku". */
export function withCodelistNote(options: ValueOption[], language?: UiLanguage): ValueOption[] {
  const note = dictionary(language).valueSelect.notInCodelist
  return options.map(o => (o.label ? o : { ...o, sub: note }))
}

/**
 * Varovanie pri podobnom názve (Q3) — `.sel-warn` v karte pod riadkami.
 * Server novú hodnotu neuložil (zvyšok áno) a vrátil `?similar=&like=`.
 * Obe voľby sú tiché odkazy, ktoré formulár pripravia: zaškrtnúť existujúcu
 * (`pick=like`), alebo vyplniť novú s potvrdením (`pick=new`, skryté
 * `…Force`). Uloží sa hlavným tlačidlom formulára.
 */
export function SimilarWarning({ href, anchor, similar, like, likeLabel, kind, language }: {
  href: string
  anchor: string
  similar?: string
  like?: string
  likeLabel?: string
  kind: "groups" | "tags"
  language?: UiLanguage
}) {
  if (!similar || !like) return null
  const t = dictionary(language).valueSelect
  const q = `similar=${encodeURIComponent(similar)}&like=${encodeURIComponent(like)}`
  const shown = likeLabel ?? like
  return (
    <div className="sel-warn" role="status">
      <p>{t.similar(similar, shown)} {kind === "groups" ? t.similarGroupNote : t.similarTagNote}</p>
      <div className="more-acts">
        <Link className="button button--quiet button--sm" href={`${href}?${q}&pick=like#${anchor}`}>{t.pickLike(shown)}</Link>
        <Link className="button button--quiet button--sm" href={`${href}?${q}&pick=new#${anchor}`}>{t.createAnyway(similar)}</Link>
      </div>
    </div>
  )
}
