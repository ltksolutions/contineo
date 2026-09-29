"use client"

/**
 * AppNav — navigácia aplikačného shellu (SHELL-bocny-panel, 29. 9. 2026).
 *
 * Jedno pole položiek z `navItems()`, dva tvary:
 *
 *  - **pod 640 px** pevná spodná lišta: Prehľad · Opýtať sa · Knižnica ·
 *    Úlohy · Viac. „Úlohy" zlučujú „Na potvrdenie" a „Na schválenie"
 *    (súčet v odznaku), „Viac" vedie na `/more` so zvyškom položiek.
 *    Nemení sa (NASADENIE, PR 2).
 *  - **od 640 px bočný panel** so skupinami (`navGroups()`): bez nadpisu
 *    Prehľad a Opýtať sa · Moje úlohy · Organizácia · Správa. Od 1024 px
 *    rozbalený (236 px) alebo lišta ikon (64 px) podľa cookie `nav`; na
 *    640–1023 px vždy lišta a rozbalenie **vysunie** panel 260 px nad obsah.
 *
 * **Pás `topbar` odišiel** (Q1): počítal so šiestimi položkami, dnes ich je
 * 10–14, musel byť textový (PR 7) a aj tak prepadal do „Viac N". S ním
 * odišlo meranie prepadu, `?layout=` a `normalizeLayout()`.
 *
 * **Bez JavaScriptu** všetko funguje: zbalenie je formulár so serverovou
 * akciou (`setNavStateAction`), vysunutie je `<details>`. Skript len pridá
 * okamžité prepnutie bez načítania, zatvorenie Esc a klikom mimo a návrat
 * fokusu.
 *
 * Zoznam položiek a čisté funkcie sú v `lib/appNav.ts`, nie tu: z modulu
 * s `"use client"` sa funkcia na serveri volať nedá a `/more` aj
 * `AppShell` ich potrebujú na serveri.
 */

import { useEffect, useRef, useState, type FormEvent, type FocusEvent, type MouseEvent as ReactMouseEvent } from "react"
import Link from "next/link"
import Icon from "./Icon"
import { usePathname } from "next/navigation"
import {
  navItems, navGroups, activeHref, tabbarItems, isTabActive, NAV_COOKIE, NAV_DRAWER_EVENT,
} from "@/lib/appNav"
import type { NavFlags, NavCounts, NavItem, NavState, NavGroupKey } from "@/lib/appNav"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { setNavStateAction } from "@/app/shellActions"

export default function AppNav({
  navState,
  flags,
  counts,
  language,
}: {
  /** Stav panela z cookie — prečítaný na serveri, aby panel nepreblikol. */
  navState: NavState
  flags: NavFlags
  counts?: NavCounts
  language?: UiLanguage
}) {
  const t = dictionary(language).nav
  const pathname = usePathname()
  const items = navItems(flags, counts)
  const groups = navGroups(items)
  // Jedna aktívna položka — najdlhšia zhodná adresa (`activeHref`).
  const current = activeHref(pathname, items.map(o => o.href))

  const [state, setState] = useState<NavState>(navState)
  const rail = state === "rail"
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawer = useRef<HTMLDetailsElement>(null)
  /** Kam vrátiť fokus po zavretí vysunutého panela — hamburger alebo „Rozbaliť". */
  const opener = useRef<HTMLElement | null>(null)

  const closeDrawer = () => { if (drawer.current) drawer.current.open = false }

  /*
   * Popis v lište ikon. **Jeden, s `position: fixed`**, nie pri každej ikone:
   * zoznam sa roluje (`overflow-y: auto`) a rolovací obal orezáva aj do
   * strany — popis vedľa lišty by bol vždy odseknutý. Ukáže sa len vtedy,
   * keď je text položky skrytý (lišta), pri myši aj pri fokuse z klávesnice.
   */
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null)
  const showTip = (e: ReactMouseEvent<HTMLElement> | FocusEvent<HTMLElement>, text: string) => {
    const el = e.currentTarget
    const label = el.querySelector(".app-panel-label")
    if (label && getComputedStyle(label).display !== "none") return
    const r = el.getBoundingClientRect()
    setTip({ text, top: r.top + r.height / 2, left: r.right + 10 })
  }
  const hideTip = () => setTip(null)

  // Zmena stránky zavrie vysunutý panel — inak zostane visieť nad novým
  // obsahom. Rovnaké pravidlo ako osobné menu v hlavičke.
  useEffect(() => { if (drawer.current) drawer.current.open = false }, [pathname])

  // Hamburger v hlavičke (iný strom — `layout.tsx`) posiela udalosť.
  useEffect(() => {
    const toggle = (e: Event) => {
      const d = drawer.current
      if (!d) return
      opener.current = (e as CustomEvent<HTMLElement | null>).detail ?? null
      d.open = !d.open
    }
    window.addEventListener(NAV_DRAWER_EVENT, toggle)
    return () => window.removeEventListener(NAV_DRAWER_EVENT, toggle)
  }, [])

  // Otvorený panel zavrie Esc a klik mimo neho. Hamburger a „Rozbaliť"
  // sa prepínajú samy — ich klik sa za „mimo" nepočíta.
  useEffect(() => {
    if (!drawerOpen) return
    const d = drawer.current
    if (!d) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") d.open = false }
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (d.querySelector(".app-drawer")?.contains(target)) return
      if (d.querySelector("summary")?.contains(target)) return
      if (opener.current?.contains(target)) return
      d.open = false
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
    }
  }, [drawerOpen])

  // Fokus do panela pri otvorení, späť na to, čím sa otvoril, pri zavretí.
  const onToggle = () => {
    const d = drawer.current
    if (!d) return
    setDrawerOpen(d.open)
    if (d.open) {
      if (!opener.current) opener.current = d.querySelector("summary")
      d.querySelector<HTMLAnchorElement>(".app-drawer a")?.focus()
    } else {
      opener.current?.focus()
      opener.current = null
    }
  }

  /*
   * Zbalenie s JavaScriptom: hneď, bez načítania stránky, a cookie si zapíše
   * prehliadač sám. Bez skriptu formulár odíde na `setNavStateAction`, ktorá
   * urobí to isté a vráti človeka na tú istú stránku.
   */
  const fold = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next: NavState = rail ? "wide" : "rail"
    setState(next)
    document.cookie = `${NAV_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  }

  const groupTitle: Record<NavGroupKey, string> = {
    tasks: t.groupTasks,
    organisation: t.groupOrganisation,
    management: t.groupManagement,
  }

  const link = (o: NavItem, tipOn: boolean) => {
    const active = o.href === current
    /*
     * Nula sa nekreslí vôbec. Štítok s nulou nie je informácia, je to šum —
     * a človek, ktorý nemá čo potvrdzovať, sa to má dozvedieť tým, že tam
     * nič nesvieti, nie tým, že si prečíta „0".
     */
    const n = typeof o.count === "number" && o.count > 0 ? o.count : 0
    return (
      <Link
        key={o.href}
        href={o.href}
        className={`app-panel-item${active ? " is-active" : ""}`}
        aria-current={active ? "page" : undefined}
        // V lište ikon je text skrytý — názov aj počet nesie `aria-label`.
        // Ikona nie je náhrada popisku.
        aria-label={n ? `${t[o.key]}, ${t.waiting(n)}` : t[o.key]}
        onMouseEnter={tipOn ? e => showTip(e, n ? `${t[o.key]} · ${n}` : t[o.key]) : undefined}
        onMouseLeave={tipOn ? hideTip : undefined}
        onFocus={tipOn ? e => showTip(e, n ? `${t[o.key]} · ${n}` : t[o.key]) : undefined}
        onBlur={tipOn ? hideTip : undefined}
      >
        <Icon name={o.key} size={17} />
        <span className="app-panel-label">{t[o.key]}</span>
        {n > 0 && <span className="app-nav-count" aria-hidden="true">{n}</span>}
      </Link>
    )
  }

  const list = (tipOn: boolean) => groups.map(g => (
    <div key={g.key ?? "home"} className="app-panel-group">
      {/* V lište ikon sa nadpis zmení na deliacu čiaru (CSS). */}
      {g.key && <div className="app-panel-group-title">{groupTitle[g.key]}</div>}
      {g.items.map(o => link(o, tipOn))}
    </div>
  ))

  /*
   * Spodná lišta. Ikona „Úloh" je zaškrtávacie políčko z „Na potvrdenie" —
   * v lište nie sú obe naraz, takže sa kresba nebije; na `/more` má
   * schvaľovanie svoju pečať.
   */
  const tabs = tabbarItems(items)
  const tabbar = (
    <nav className="app-nav-tabbar" aria-label={t.sections}>
      {tabs.map(tab => {
        const active = isTabActive(pathname, tab)
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`app-nav-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="app-nav-tab-icon">
              <Icon name={tab.key === "tasks" ? "toAcknowledge" : tab.key} size={21} />
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className="app-nav-count" aria-label={t.waiting(tab.count)}>
                  {tab.count}
                </span>
              )}
            </span>
            {t[tab.key]}
          </Link>
        )
      })}
    </nav>
  )

  const foldLabel = rail ? t.expand : t.collapse

  return (
    <>
      <div className={`app-panel ${rail ? "is-rail" : "is-wide"}`}>
        <nav className="app-panel-scroll" aria-label={t.sections}>{list(true)}</nav>

        <div className="app-panel-foot">
          {/* Od 1024 px: zbaliť / rozbaliť. Funguje aj bez skriptu. */}
          <form action={setNavStateAction} onSubmit={fold} className="app-panel-fold-form">
            <input type="hidden" name="nav" value={rail ? "wide" : "rail"} />
            <button type="submit" className="app-panel-fold" aria-label={foldLabel}
                    onMouseEnter={e => showTip(e, foldLabel)} onMouseLeave={hideTip}
                    onFocus={e => showTip(e, foldLabel)} onBlur={hideTip}>
              <Icon name={rail ? "unfold" : "fold"} size={17} />
              <span className="app-panel-label">{foldLabel}</span>
            </button>
          </form>

          {/*
            640–1023 px: „Rozbaliť" vysunie panel nad obsah (Q3). `<details>`,
            takže bez skriptu sa otvorí aj zavrie klikom na „Rozbaliť".
          */}
          <details ref={drawer} className="app-panel-drawer" onToggle={onToggle}>
            <summary className="app-panel-fold" aria-label={t.expand}
                     onMouseEnter={e => showTip(e, t.expand)} onMouseLeave={hideTip}
                     onFocus={e => showTip(e, t.expand)} onBlur={hideTip}>
              <Icon name="unfold" size={17} />
              <span className="app-panel-label" hidden>{t.expand}</span>
            </summary>
            <div className="app-drawer-scrim" aria-hidden="true" onClick={closeDrawer} />
            <nav className="app-drawer" aria-label={t.sections}>
              <div className="app-panel-scroll">{list(false)}</div>
            </nav>
          </details>
        </div>
      </div>

      {tip && (
        <span className="app-panel-tip" aria-hidden="true" style={{ top: tip.top, left: tip.left }}>{tip.text}</span>
      )}

      {tabbar}
    </>
  )
}
