"use client"

/**
 * PeopleSearch — zoznam osôb s políčkami a hľadaním nad ním
 * (KOMPONENT-hladanie-osob, 29. 9. 2026).
 *
 * Obal okolo posuvného rámika `.approval-people`, nie `MultiSelect`:
 * komentár v `ResponsiblePicker.tsx` platí ďalej — políčka a prepínače sa na
 * telefóne ovládajú lepšie než rozbaľovací zoznam a fungujú bez JavaScriptu.
 * Pri desiatkach ľudí sa však meno v rámiku 260 px hľadá rolovaním, preto nad
 * ním pribudne riadok vybraných, pole hľadania a počet.
 *
 * Čo sa zámerne **nemení**:
 *  • **Bez JS nič navyše.** Pole a čipy sa vykreslia až po načítaní skriptu
 *    (`ready`); server pošle ten istý zoznam ako doteraz.
 *  • **Odfiltrované riadky sú len `hidden`.** Zostávajú vo formulári —
 *    zaškrtnutý, ale odfiltrovaný schvaľovateľ sa odošle. Keby sa riadok
 *    z DOM vyhodil, hľadanie by potichu zmenilo, komu príde žiadosť.
 *  • **Poradie zoznamu.** Vybraní sa hore nepresúvajú — riadok by uskočil
 *    spod kurzora práve vo chvíli, keď naň človek klikol.
 */

import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type Ref } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import {
  canSearch, highlight, queryTerms, searchKeyAction, visibleIds,
  type PersonChoice,
} from "@/lib/peopleSearch"

export type { PersonChoice } from "@/lib/peopleSearch"

const noop = () => () => {}

interface Props {
  people: PersonChoice[]
  /** Meno poľa vo formulári — `approver`, `responsiblePersonId`. */
  name: string
  language: UiLanguage
  /** Zaškrtávacie políčka (1..n) namiesto prepínačov. */
  multiple?: boolean
  defaultSelected?: string[]
  /**
   * Prepínač je povinný. Vtedy čip vybranej osoby nemá × — voľba sa dá
   * zmeniť, zrušiť nie (zmena zodpovednej osoby po zverejnení).
   */
  required?: boolean
  /** Nadpis zoznamu — pre čítačku, aby vedela, čo pole prehľadáva. */
  listLabel: string
  /**
   * Prečo tu niekto chýba, keď nič nevyhovuje. Pri schvaľovateľoch aj ten,
   * kto predkladá; inde (zodpovedná osoba, „Komu" pri prideľovaní) len vyradení.
   */
  missing: "approvers" | "responsible" | "people"
}

export default function PeopleSearch(props: Props) {
  const { people, multiple = false, defaultSelected = [] } = props
  // Na serveri a pri hydratácii `false`, potom `true` — bez skriptu by pole
  // bolo mŕtve a klamalo by, že filtruje.
  const ready = useSyncExternalStore(noop, () => true, () => false)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string[]>(() =>
    multiple ? defaultSelected : defaultSelected.slice(0, 1))
  const list = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)

  const pick = (id: string, on: boolean) => {
    if (!multiple) return setSelected(on ? [id] : [])
    setSelected(s => (on ? (s.includes(id) ? s : [...s, id]) : s.filter(x => x !== id)))
  }

  // Tlačidlo, ktoré hľadanie ruší, po kliknutí zmizne — bez návratu do poľa
  // by fokus spadol na začiatok stránky a klávesnica by sa stratila.
  const clear = () => { setQuery(""); field.current?.focus() }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const action = searchKeyAction(e.key, query, visibleIds(people, query))
    if (action.kind === "none") return
    e.preventDefault()
    if (action.kind === "enter") {
      if (action.pick) { pick(action.pick, true); setQuery("") }
    } else if (action.kind === "clear") {
      setQuery("")
    } else {
      list.current?.querySelector<HTMLInputElement>(".approval-person:not([hidden]) input")?.focus()
    }
  }

  return (
    <PeopleSearchView
      {...props}
      interactive={ready}
      query={query}
      selected={selected}
      listRef={list}
      fieldRef={field}
      onQuery={setQuery}
      onClear={clear}
      onPick={pick}
      onKeyDown={onKeyDown}
    />
  )
}

/**
 * Vykreslenie bez stavu — oddelené, aby sa dalo overiť na serveri
 * (`renderToStaticMarkup`) bez prehliadača.
 */
export function PeopleSearchView({
  people, name, language, multiple = false, required = false, listLabel, missing,
  interactive, query, selected, listRef, fieldRef, onQuery, onClear, onPick, onKeyDown,
}: Props & {
  interactive: boolean
  query: string
  selected: string[]
  listRef?: Ref<HTMLDivElement>
  fieldRef?: Ref<HTMLInputElement>
  onQuery?: (q: string) => void
  onClear?: () => void
  onPick?: (id: string, on: boolean) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}) {
  const t = dictionary(language).people.search
  const searchable = interactive && canSearch(people.length)
  const q = searchable ? query : ""
  const terms = queryTerms(q)
  const shown = new Set(visibleIds(people, q))
  // Čipy v poradí zoznamu, nie v poradí klikania — rovnako ako riadky.
  const picked = people.filter(p => selected.includes(p.id))
  const onlyOne = shown.size === 1 ? people.find(p => shown.has(p.id)) : undefined
  const mark = (text: string) =>
    highlight(text, terms).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : s.text))

  return (
    <>
      {searchable && picked.length > 0 && (
        <div className="people-picked">
          <span className="people-picked-label">{multiple ? t.picked(picked.length) : t.pickedOne}</span>
          {picked.map(p => (
            <span key={p.id} className="people-chip">
              {p.fullName}
              {(multiple || !required) && (
                <button type="button" aria-label={t.remove(p.fullName)} onClick={() => onPick?.(p.id, false)}>×</button>
              )}
            </span>
          ))}
        </div>
      )}

      {searchable && (
        <>
          <div className="people-search">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor"
                 strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" /><path d="M12.2 12.2 16 16" />
            </svg>
            {/* Bez `name` — dotaz nie je súčasť formulára a nemá sa odoslať. */}
            <input
              ref={fieldRef}
              className="field-input"
              type="search"
              value={query}
              placeholder={t.placeholder}
              aria-label={t.label(listLabel)}
              autoComplete="off"
              enterKeyHint="search"
              onChange={e => onQuery?.(e.target.value)}
              onKeyDown={onKeyDown}
            />
            {query && (
              <button type="button" className="people-search-clear" aria-label={t.clearInput}
                      onClick={onClear}>×</button>
            )}
          </div>
          <div className="people-count" aria-live="polite">
            {q ? t.count(shown.size, people.length) : ""}
          </div>
        </>
      )}

      <div className="approval-people" ref={listRef}>
        {people.map(p => {
          const on = selected.includes(p.id)
          return (
            <label key={p.id} className="approval-person" hidden={!shown.has(p.id)}>
              {multiple
                ? <input type="checkbox" name={name} value={p.id} checked={on}
                         onChange={e => onPick?.(p.id, e.target.checked)} />
                : <input type="radio" name={name} value={p.id} required={required} checked={on}
                         onChange={e => onPick?.(p.id, e.target.checked)}
                         // Povinný prepínač v skrytých riadkoch: prehliadač nemá kde
                         // ukázať „vyber osobu" a formulár by mlčky neodišiel.
                         onInvalid={() => onQuery?.("")} />}
              <span>
                <span className="approval-person-name">{mark(p.fullName)}</span>
                <span className="quiet approval-person-meta">
                  {p.department ? <>{mark(p.department)} · </> : ""}{mark(p.email)}
                </span>
              </span>
            </label>
          )
        })}
        {q && shown.size === 0 && (
          <div className="people-empty">
            {t.none(q)}<br />
            {missing === "approvers" ? t.noneApprovers : t.noneResponsible}<br />
            <button type="button" className="people-empty-clear" onClick={onClear}>{t.clear}</button>
          </div>
        )}
      </div>

      {searchable && q && (
        <span className="people-keys" aria-hidden="true">
          <kbd>↓</kbd> {t.keysDown} · <kbd>Enter</kbd> {onlyOne ? t.keysEnterOne(onlyOne.fullName) : t.keysEnter}
          {" · "}<kbd>Esc</kbd> {t.keysEsc}
        </span>
      )}
    </>
  )
}
