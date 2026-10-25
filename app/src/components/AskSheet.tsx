"use client"

/**
 * AskSheet — plachta otázky (ASK-otazka-z-hlavicky).
 *
 * Dva tvary, jeden obsah:
 *
 *  - **`overlay`** — pole v hlavičke sa po kliknutí, fokuse alebo `⌘K`
 *    rozšíri na mieste do plachty (`HeaderAsk`). Pod 640 px ide na celú
 *    obrazovku s „×" hore a „Opýtať sa" dole nad klávesnicou (CSS).
 *  - **`inline`** — `/ask` bez otázky: tá istá plachta vložená do stránky,
 *    otvorená a bez závoja.
 *
 * Obsah: viacriadkové pole (rastie do šiestich riadkov), lišta s nápovedou
 * a tlačidlom, veta o tom, ako systém odpovedá, a vzory otázok. Vzor otázku
 * **vloží, neodošle** — človek ju má vidieť a môže ju upraviť; vzory sa
 * skryjú, len čo pole nie je prázdne.
 *
 * Je to `<form method="get" action="/ask">` s `<textarea name="q">`, takže
 * vložená plachta odošle otázku aj bez JavaScriptu. So skriptom ide
 * odoslanie cez router (bez načítania stránky) a `/ask` spustí beh hneď.
 *
 * **Zdroje hľadania** (ASK-zdroje-v-plachte, 23. 10. 2026): keď má
 * organizácia živý zdroj, v lište je „Zdroje: Knižnica ▾" a pod lištou riadky
 * `.select-row` s `checkbox name="src"` — výber ide s otázkou ešte pred prvou
 * odpoveďou. Zmena nič nespúšťa. Veta pod lištou menuje vybrané zdroje.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Icon from "./Icon"
import { ContineoMark } from "./ContineoMark"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { answerFrom } from "@/lib/answerKicker"
import { defaultScope, type AskLiveSource } from "@/lib/askScope"

/** Rovnaký strop ako API (`/api/chat`) a ako doterajšie pole na `/ask`. */
export const QUESTION_MAX = 1000
/** Počítadlo sa ukáže až blízko stropu — dovtedy je to šum. */
const COUNTER_FROM = 800
/** Šesť riadkov po 17 × 1.5 px. Ďalej pole roluje. */
const MAX_HEIGHT = 6 * 17 * 1.5
/** `useSyncExternalStore` bez odberu — len rozlíšenie server / prehliadač. */
const noop = () => () => {}

/**
 * Živé zdroje pre plachtu v hlavičke — načítajú sa raz za kartu, pri prvom
 * otvorení (layout ich na každej stránke nepýta).
 */
let sourcesOnce: Promise<{ live: AskLiveSource[]; organisation: string } | null> | null = null
function loadSources() {
  sourcesOnce ??= fetch("/api/ask/sources")
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
  return sourcesOnce
}

/** Riadok vlastnej otázky z `/api/ask/history`. */
interface Mine {
  id: string
  question: string
  createdAt: string
}

export default function AskSheet({
  mode,
  initial = "",
  organisation,
  language,
  onClose,
  live: liveProp,
  initialSources,
}: {
  mode: "overlay" | "inline"
  initial?: string
  /** Skratka organizácie do vety o tom, z čoho sa odpovedá („z dokumentov SFZ"). */
  organisation: string
  /** Živé zdroje zo servera (vložená plachta na `/ask`); bez nich ich plachta načíta sama. */
  live?: AskLiveSource[]
  /** Výber z obrazovky odpovede („Upraviť otázku"); inak predvolený (Q3 A). */
  initialSources?: string[]
  language?: UiLanguage
  /**
   * Len `overlay`: zavretie Esc, „×" alebo odoslaním — s tým, čo je v poli.
   * `submitted` = otázka odišla; fokus sa vtedy do poľa v hlavičke nevracia
   * (na telefóne by vyskočila klávesnica nad odpoveďou).
   */
  onClose?: (value: string, submitted?: boolean) => void
}) {
  const t = dictionary(language)
  const ta = t.ask
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const field = useRef<HTMLTextAreaElement>(null)

  // Zdroje: zo servera, alebo načítané pri otvorení plachty v hlavičke.
  const [loaded, setLoaded] = useState<{ live: AskLiveSource[]; organisation: string } | null>(null)
  useEffect(() => {
    if (liveProp) return
    let alive = true
    void loadSources().then(d => { if (alive && d) setLoaded(d) })
    return () => { alive = false }
  }, [liveProp])
  const live = liveProp ?? loaded?.live ?? []
  const org = loaded?.organisation ?? organisation
  const scopeIds = ["library", ...live.map(l => l.id)]
  const [picked, setPicked] = useState<string[] | null>(null)
  const fromStart = initialSources?.filter(id => scopeIds.includes(id))
  const selected = picked ?? (fromStart?.length ? fromStart : defaultScope(live))
  const [scopeOpen, setScopeOpen] = useState(false)
  const [lastWarn, setLastWarn] = useState(false)
  const scopeRef = useRef<HTMLDetailsElement>(null)
  const sourceName = (id: string) => (id === "library" ? ta.scopeLibrary : live.find(l => l.id === id)?.name ?? id)
  // Posledný zapnutý zdroj sa neodškrtne (bod 4) — riadok nie je `disabled`, inak by sa neodoslal.
  const toggle = (id: string) => {
    const next = scopeIds.filter(x => (x === id ? !selected.includes(x) : selected.includes(x)))
    if (next.length === 0) { setLastWarn(true); setTimeout(() => setLastWarn(false), 1200); return }
    setPicked(next)
  }
  const closeScope = () => {
    setScopeOpen(false)
    scopeRef.current?.querySelector("summary")?.focus()
  }
  const from = answerFrom(
    { library: selected.includes("library"), live: live.filter(l => selected.includes(l.id)).map(l => l.name) },
    org, language,
  )

  /*
   * Vlastné otázky (ASK-historia-otazok): pri prázdnom poli posledné, pri
   * písaní tie, ktoré obsahujú napísané slová. Nájsť starú odpoveď je
   * rýchlejšie a lacnejšie než nový beh modelu. Bez skriptu sa nenačítajú —
   * história je na `/ask/history`.
   */
  const [mine, setMine] = useState<Mine[]>([])
  const [active, setActive] = useState(-1)
  const [removed, setRemoved] = useState<Mine | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/ask/history?limit=5&q=${encodeURIComponent(value.trim())}`, { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: Mine[] }) => { setMine(d.items ?? []); setActive(-1) })
        // Bez histórie plachta funguje ďalej — je to pomôcka, nie podmienka.
        .catch(() => {})
    }, value.trim() ? 150 : 0)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [value])

  // „Vrátiť" po × ostáva päť sekúnd.
  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), 5000)
    return () => clearTimeout(timer)
  }, [removed])

  const hide = (item: Mine) => {
    setMine(list => list.filter(o => o.id !== item.id))
    setRemoved(item)
    void fetch(`/api/ask/history/${encodeURIComponent(item.id)}/hide`, { method: "POST" }).catch(() => {})
  }
  const undo = () => {
    if (!removed) return
    const item = removed
    setRemoved(null)
    setMine(list => [item, ...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    void fetch(`/api/ask/history/${encodeURIComponent(item.id)}/unhide`, { method: "POST" }).catch(() => {})
  }
  const openMine = (item: Mine) => {
    onClose?.(value, true)
    router.push(`/ask/a/${encodeURIComponent(item.id)}`)
  }
  const when = (iso: string) => {
    const d = new Date(iso)
    const today = new Date().toDateString() === d.toDateString()
    return today
      ? d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString(language, { day: "numeric", month: "numeric" })
  }

  // Výška poľa podľa obsahu, najviac šesť riadkov.
  const fit = () => {
    const el = field.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }

  // Fokus do poľa a kurzor na koniec — plachta sa otvorila, aby sa písalo.
  useEffect(() => {
    const el = field.current
    if (!el) return
    fit()
    if (mode === "overlay") {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [mode])

  const submit = () => {
    const q = value.trim()
    if (!q) return
    onClose?.(q, true)
    // Výber ide s otázkou (`?src=`, PR #418); bez živého zdroja nie je čo poslať.
    const src = live.length ? `&src=${encodeURIComponent(selected.join(","))}` : ""
    router.push(`/ask?q=${encodeURIComponent(q)}${src}`)
  }

  const pick = (example: string) => {
    setValue(example)
    // Po vykreslení nového textu — inak by výška zodpovedala prázdnemu poľu.
    requestAnimationFrame(() => {
      fit()
      field.current?.focus()
    })
  }

  const empty = value.trim() === ""
  /*
   * Prázdne pole tlačidlo vypne — ale až so skriptom. Bez neho server
   * vykreslí prázdne pole a vypnuté tlačidlo by vložená plachta na `/ask`
   * nemala ako odoslať (Enter v `<textarea>` bez skriptu robí nový riadok).
   */
  const ready = useSyncExternalStore(noop, () => true, () => false)
  const button = (
    <button type="submit" className="ask-sheet-submit" disabled={ready && empty}>
      {ta.submit}
      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.9"
           strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3.5 9h11M10 4.5 14.5 9 10 13.5" />
      </svg>
    </button>
  )

  return (
    <form
      className={`ask-sheet ask-sheet--${mode}`}
      method="get"
      action="/ask"
      role={mode === "overlay" ? "dialog" : undefined}
      aria-label={mode === "overlay" ? ta.submit : undefined}
      onSubmit={e => { e.preventDefault(); submit() }}
      onKeyDown={e => {
        // Esc najprv zbalí výber zdrojov, až druhé zavrie plachtu (bod 7).
        if (e.key === "Escape" && scopeOpen && e.target !== field.current) {
          e.preventDefault()
          e.stopPropagation()
          closeScope()
        }
      }}
    >
      {/* Telefón (overlay): hlavička celej obrazovky. Na širšej sa skrýva. */}
      {mode === "overlay" && (
        <div className="ask-sheet-head">
          <button type="button" className="ask-sheet-close" aria-label={ta.sheet.close} onClick={() => onClose?.(value)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" aria-hidden="true">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
            </svg>
          </button>
          <b>{ta.heading}</b>
        </div>
      )}

      <div className="ask-sheet-scroll">
        <div className="ask-sheet-top">
          <span className="ask-sheet-mark" aria-hidden="true"><ContineoMark size={18} /></span>
          <textarea
            ref={field}
            name="q"
            className="ask-sheet-field"
            value={value}
            maxLength={QUESTION_MAX}
            rows={3}
            placeholder={t.nav.searchPlaceholder}
            aria-label={t.nav.searchLabel}
            onChange={e => { setValue(e.target.value); fit() }}
            onKeyDown={e => {
              // ↑/↓ prechádza vlastné otázky, Enter otvorí vybranú.
              if ((e.key === "ArrowDown" || e.key === "ArrowUp") && mine.length > 0) {
                e.preventDefault()
                setActive(i => (e.key === "ArrowDown" ? Math.min(mine.length - 1, i + 1) : Math.max(-1, i - 1)))
                return
              }
              // Enter odošle, Shift+Enter robí nový riadok — otázky bývajú
              // jednoriadkové a klikať na tlačidlo by bolo otravné.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                if (active >= 0 && mine[active]) openMine(mine[active])
                else submit()
              }
              if (e.key === "Escape" && scopeOpen) {
                e.preventDefault()
                closeScope()
                return
              }
              if (e.key === "Escape" && mode === "overlay") {
                e.preventDefault()
                onClose?.(value)
              }
            }}
          />
        </div>

        <div className="ask-sheet-bar">
          {/* Výber zdrojov (Q1 A): `<details>` drží len tlačidlo, riadky sú pod
              lištou a ukáže ich `:has([open])` — funguje aj bez JS (S1). */}
          {live.length > 0 && (
            <details ref={scopeRef} className="ask-scope ask-sheet-scope" open={scopeOpen} onToggle={e => setScopeOpen(e.currentTarget.open)}>
              <summary className="button button--quiet button--sm" aria-controls="ask-sheet-scope-pane">
                {`${ta.scopeButton(selected.map(sourceName).join(", "))} ▾`}
              </summary>
            </details>
          )}
          <span className="ask-sheet-hint">
            {mine.length > 0 ? ta.sheet.hintHistory : mode === "overlay" ? ta.sheet.hint : ta.sheet.hintInline}
          </span>
          {value.length >= COUNTER_FROM && (
            <span className="ask-sheet-count">{value.length}/{QUESTION_MAX}</span>
          )}
          <span className="ask-sheet-bar-button">{button}</span>
        </div>

        {live.length > 0 && (
          <fieldset className="ask-sheet-scope-pane form-group" id="ask-sheet-scope-pane">
            <legend className="form-group-head">{ta.scopeLabel}</legend>
            <div className="card form-group-body form-group-body--rows">
              <div className="form-list">
                {scopeIds.map(id => (
                  <label key={id} className="form-row select-row">
                    <input type="checkbox" name="src" value={id} checked={selected.includes(id)} onChange={() => toggle(id)} />
                    <span className="form-row-main">
                      <span>{sourceName(id)}</span>
                      <span className="form-row-sub">{id === "library" ? ta.scopeLibrarySub : id === "slov-lex" ? ta.scopeLawSub : ta.scopeLiveSub}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <p className={`form-group-foot quiet${lastWarn ? " is-warn" : ""}`} role="status">{ta.sheet.scopeFoot}</p>
          </fieldset>
        )}

        <p className="ask-sheet-info">
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
               strokeLinecap="round" aria-hidden="true">
            <circle cx="9" cy="9" r="7" /><path d="M9 8.2v4.2M9 5.6v.1" />
          </svg>
          <span><b>{ta.sheet.infoLead(from)}</b> {ta.sheet.infoRest}</span>
        </p>

        {(mine.length > 0 || removed) && (
          <div className="ask-sheet-examples ask-sheet-mine">
            <h3>
              {empty ? ta.history.recent : ta.history.matching}
              <Link href="/ask/history" onClick={() => onClose?.(value, true)}>{ta.history.all}</Link>
            </h3>
            {removed && (
              <div className="ask-sheet-removed" role="status">
                {ta.history.removed}
                <button type="button" className="ask-sheet-undo" onClick={undo}>{ta.history.undo}</button>
              </div>
            )}
            <ul role="listbox" aria-label={empty ? ta.history.recent : ta.history.matching}>
              {mine.map((item, i) => (
                <li key={item.id} role="option" aria-selected={i === active} className={i === active ? "is-active" : undefined}>
                  <Link href={`/ask/a/${encodeURIComponent(item.id)}`} className="ask-sheet-mine-open" onClick={() => onClose?.(value, true)}>
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
                         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="9" cy="9" r="6.6" /><path d="M9 5.4V9l2.4 1.6" />
                    </svg>
                    <span>{item.question}</span>
                    <time dateTime={item.createdAt}>{when(item.createdAt)}</time>
                  </Link>
                  <button type="button" className="ask-sheet-mine-hide" aria-label={ta.history.remove} title={ta.history.remove}
                          onClick={() => hide(item)}>
                    <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7"
                         strokeLinecap="round" aria-hidden="true">
                      <path d="M5 5l8 8M13 5l-8 8" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {empty && (
          <div className="ask-sheet-examples">
            <h3>{ta.examplesLabel}</h3>
            {ta.examples.map(example => (
              <button key={example} type="button" onClick={() => pick(example)}>
                <Icon name="ask" size={15} />
                <span>{example}</span>
                <i aria-hidden="true">{ta.sheet.insert}</i>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Telefón (overlay): tlačidlo dole, nad klávesnicou. */}
      {mode === "overlay" && <div className="ask-sheet-foot">{button}</div>}
    </form>
  )
}
