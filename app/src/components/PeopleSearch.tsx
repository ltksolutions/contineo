"use client"

/**
 * PeopleSearch — zoznam osôb s políčkami a hľadaním nad ním
 * (KOMPONENT-hladanie-osob, 29. 9. 2026). Od HR-pridelit-normy-hladanie
 * je to všeobecný `ListSearch` — ten istý obal nesie aj zoznam noriem
 * (`DocumentSearch`); `PeopleSearch` je jeho tvar pre osoby.
 *
 * Obal okolo posuvného rámika `.approval-people`, nie `MultiSelect`:
 * komentár v `ResponsiblePicker.tsx` platí ďalej — políčka a prepínače sa na
 * telefóne ovládajú lepšie než rozbaľovací zoznam a fungujú bez JavaScriptu.
 * Pri desiatkach položiek sa však hľadá rolovaním, preto nad rámikom
 * pribudne riadok vybraných, pole hľadania a počet.
 *
 * Čo sa zámerne **nemení**:
 *  • **Bez JS nič navyše.** Pole a čipy sa vykreslia až po načítaní skriptu
 *    (`ready`); server pošle ten istý zoznam ako doteraz.
 *  • **Odfiltrované riadky sú len `hidden`.** Zostávajú vo formulári —
 *    zaškrtnutý, ale odfiltrovaný schvaľovateľ sa odošle. Keby sa riadok
 *    z DOM vyhodil, hľadanie by potichu zmenilo, komu príde žiadosť.
 *  • **Poradie zoznamu.** Vybraní sa hore nepresúvajú — riadok by uskočil
 *    spod kurzora práve vo chvíli, keď naň človek klikol.
 *
 * Texty si komponent berie z `i18n` podľa druhu (`kind`): zo serverového
 * komponentu sa funkcie (`count(n)`, `none(q)`) poslať nedajú.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type Ref } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import {
  canSearch, highlight, personItem, queryTerms, searchKeyAction, visibleItemIds,
  type ListItem, type PersonChoice,
} from "@/lib/peopleSearch"

export type { PersonChoice, ListItem } from "@/lib/peopleSearch"

const noop = () => () => {}

type Missing = "approvers" | "responsible" | "people"

interface ListProps {
  /** Druh zoznamu — určuje texty a tvar riadku. */
  kind: "people" | "documents"
  items: ListItem[]
  /** Meno poľa vo formulári — `approver`, `responsiblePersonId`, `document`. */
  name: string
  language: UiLanguage
  /** Zaškrtávacie políčka (1..n) namiesto prepínačov. */
  multiple?: boolean
  defaultSelected?: string[]
  /**
   * Prepínač je povinný. Vtedy čip vybranej položky nemá × — voľba sa dá
   * zmeniť, zrušiť nie (zmena zodpovednej osoby po zverejnení).
   */
  required?: boolean
  /** Nadpis zoznamu — pre čítačku, aby vedela, čo pole prehľadáva. */
  listLabel: string
  /**
   * Prečo tu niekto chýba, keď nič nevyhovuje. Pri schvaľovateľoch aj ten,
   * kto predkladá; inde (zodpovedná osoba, „Komu" pri prideľovaní) len vyradení.
   */
  missing?: Missing
  /** Trieda rámika navyše — výška zoznamu noriem je iná ako pri osobách. */
  listClassName?: string
}

interface ViewState {
  interactive: boolean
  query: string
  selected: string[]
  onlyFlagged?: boolean
  listRef?: Ref<HTMLDivElement>
  fieldRef?: Ref<HTMLInputElement>
  onQuery?: (q: string) => void
  onClear?: () => void
  onPick?: (id: string, on: boolean) => void
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  onFlagged?: (on: boolean) => void
}

export function ListSearch(props: ListProps) {
  const { items, multiple = false, defaultSelected = [] } = props
  // Na serveri a pri hydratácii `false`, potom `true` — bez skriptu by pole
  // bolo mŕtve a klamalo by, že filtruje.
  const ready = useSyncExternalStore(noop, () => true, () => false)
  const [query, setQuery] = useState("")
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [selected, setSelected] = useState<string[]>(() =>
    multiple ? defaultSelected : defaultSelected.slice(0, 1))
  const list = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)

  const pick = (id: string, on: boolean) => {
    if (!multiple) return setSelected(on ? [id] : [])
    setSelected(s => (on ? (s.includes(id) ? s : [...s, id]) : s.filter(x => x !== id)))
  }

  // Výber zmenený čipom × alebo Enterom prehliadač neohlási (políčko sa mení
  // len cez stav). Formulár okolo to však vedieť musí — súhrn na `/hr/assign`
  // (`AssignFinish`) počúva `change` na formulári. Pri prvom vykreslení nie.
  const announced = useRef(false)
  useEffect(() => {
    if (!announced.current) { announced.current = true; return }
    list.current?.dispatchEvent(new Event("change", { bubbles: true }))
  }, [selected])

  // Tlačidlo, ktoré hľadanie ruší, po kliknutí zmizne — bez návratu do poľa
  // by fokus spadol na začiatok stránky a klávesnica by sa stratila.
  const clear = () => { setQuery(""); field.current?.focus() }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const action = searchKeyAction(e.key, query, visibleItemIds(items, query, onlyFlagged))
    if (action.kind === "none") return
    e.preventDefault()
    if (action.kind === "enter") {
      if (action.pick) { pick(action.pick, true); setQuery("") }
    } else if (action.kind === "clear") {
      setQuery("")
    } else {
      list.current?.querySelector<HTMLInputElement>("label:not([hidden]) input")?.focus()
    }
  }

  return (
    <ListSearchView
      {...props}
      interactive={ready}
      query={query}
      selected={selected}
      onlyFlagged={onlyFlagged}
      listRef={list}
      fieldRef={field}
      onQuery={setQuery}
      onClear={clear}
      onPick={pick}
      onKeyDown={onKeyDown}
      onFlagged={setOnlyFlagged}
    />
  )
}

/**
 * Vykreslenie bez stavu — oddelené, aby sa dalo overiť na serveri
 * (`renderToStaticMarkup`) bez prehliadača.
 */
export function ListSearchView({
  kind, items, name, language, multiple = false, required = false, listLabel, missing = "people", listClassName,
  interactive, query, selected, onlyFlagged = false,
  listRef, fieldRef, onQuery, onClear, onPick, onKeyDown, onFlagged,
}: ListProps & ViewState) {
  const dict = dictionary(language)
  const t = dict.people.search
  const ta = dict.hr.assign
  const docs = kind === "documents"
  const searchable = interactive && canSearch(items.length)
  const q = searchable ? query : ""
  const flagOn = searchable && onlyFlagged
  const flaggedCount = docs ? items.filter(i => i.flagged).length : 0
  const terms = queryTerms(q)
  const shown = new Set(visibleItemIds(items, q, flagOn))
  // Čipy v poradí zoznamu, nie v poradí klikania — rovnako ako riadky.
  const picked = items.filter(i => selected.includes(i.id))
  const onlyOne = shown.size === 1 ? items.find(i => shown.has(i.id)) : undefined
  const mark = (text: string) =>
    highlight(text, terms).map((s, i) => (s.hit ? <mark key={i}>{s.text}</mark> : s.text))

  const input = (i: ListItem, on: boolean) => multiple
    ? <input type="checkbox" name={name} value={i.id} checked={on}
             onChange={e => onPick?.(i.id, e.target.checked)} />
    : <input type="radio" name={name} value={i.id} required={required} checked={on}
             onChange={e => onPick?.(i.id, e.target.checked)}
             // Povinný prepínač v skrytých riadkoch: prehliadač nemá kde
             // ukázať „vyber osobu" a formulár by mlčky neodišiel.
             onInvalid={() => onQuery?.("")} />

  return (
    <>
      {searchable && picked.length > 0 && (
        <div className="people-picked">
          <span className="people-picked-label">
            {docs ? ta.picked(picked.length) : multiple ? t.picked(picked.length) : t.pickedOne}
          </span>
          {picked.map(i => (
            <span key={i.id} className="people-chip">
              <span className="people-chip-name">{i.name}</span>
              {(multiple || !required) && (
                <button type="button" aria-label={t.remove(i.name)} onClick={() => onPick?.(i.id, false)}>×</button>
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
              placeholder={docs ? ta.docSearch : t.placeholder}
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
          {/*
            Počet vľavo, pri normách vpravo filter „len bez právneho základu"
            (Q2 — upozornenie D91, nie brána; len klientsky, riadky `hidden`).
          */}
          <div className="people-count" aria-live="polite">
            <span>{q || flagOn ? t.count(shown.size, items.length) : ""}</span>
            {docs && flaggedCount > 0 && (
              <button type="button" className="people-count-filter" onClick={() => onFlagged?.(!flagOn)}>
                {flagOn ? ta.showAll : ta.onlyMissingBasis(flaggedCount)}
              </button>
            )}
          </div>
        </>
      )}

      <div className={`approval-people${listClassName ? ` ${listClassName}` : ""}`} ref={listRef}>
        {items.map(i => {
          const on = selected.includes(i.id)
          const hidden = !shown.has(i.id)
          // Norma: riadok `.hr-doc` ako doteraz — názov, štítok vpravo, znenie pod ním.
          return docs ? (
            <label key={i.id} className="hr-doc" hidden={hidden}>
              {input(i, on)}
              <span className="hr-doc-title">{mark(i.name)}</span>
              {i.flagged && <span className="tag tag--draft hr-doc-tag">{dict.responsibility.missingBasisTag}</span>}
              {i.meta?.length ? <span className="quiet hr-doc-meta">{i.meta.join(" · ")}</span> : null}
            </label>
          ) : (
            <label key={i.id} className="approval-person" hidden={hidden}>
              {input(i, on)}
              <span>
                <span className="approval-person-name">{mark(i.name)}</span>
                <span className="quiet approval-person-meta">
                  {(i.meta ?? []).map((m, k) => <span key={k}>{k > 0 && " · "}{mark(m)}</span>)}
                </span>
              </span>
            </label>
          )
        })}
        {(q || flagOn) && shown.size === 0 && (
          <div className="people-empty">
            {docs ? ta.docNone(q) : <>{t.none(q)}<br />{missing === "approvers" ? t.noneApprovers : t.noneResponsible}</>}
            <br />
            <button type="button" className="people-empty-clear" onClick={() => { onFlagged?.(false); onClear?.() }}>
              {t.clear}
            </button>
          </div>
        )}
      </div>

      {searchable && q && (
        <span className="people-keys" aria-hidden="true">
          <kbd>↓</kbd> {t.keysDown} · <kbd>Enter</kbd> {onlyOne ? t.keysEnterOne(onlyOne.name) : t.keysEnter}
          {" · "}<kbd>Esc</kbd> {t.keysEsc}
        </span>
      )}
    </>
  )
}

interface PeopleProps extends Omit<ListProps, "kind" | "items" | "missing"> {
  people: PersonChoice[]
  missing: Missing
}

/** Zoznam osôb (schvaľovatelia, zodpovedná osoba, „Komu"). */
export default function PeopleSearch({ people, ...rest }: PeopleProps) {
  return <ListSearch kind="people" items={people.map(personItem)} {...rest} />
}

/** Vykreslenie zoznamu osôb bez stavu — na testy. */
export function PeopleSearchView({ people, ...rest }: PeopleProps & ViewState) {
  return <ListSearchView kind="people" items={people.map(personItem)} {...rest} />
}

/** Zoznam noriem na `/hr/assign` (HR-pridelit-normy-hladanie, bod 2). */
export function DocumentSearch(props: Omit<ListProps, "kind" | "multiple" | "required" | "missing">) {
  return <ListSearch kind="documents" multiple {...props} />
}
