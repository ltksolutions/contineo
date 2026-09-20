"use client"

/**
 * AppNav — navigácia aplikačného shellu v troch tvaroch (NASADENIE, PR 2).
 *
 * Jedno pole položiek z `navItems()`, tri podoby:
 *
 *  - **pod 640 px** pevná spodná lišta: Prehľad · Opýtať sa · Knižnica ·
 *    Úlohy · Viac. „Úlohy" zlučujú „Na potvrdenie" a „Na schválenie"
 *    (súčet v odznaku), „Viac" vedie na `/more` so zvyškom položiek.
 *    Nahradila `<details>` zásuvku: lišta je vždy na obrazovke a palec na
 *    ňu dosiahne, zásuvku bolo treba najprv nájsť a otvoriť.
 *  - **640–1023 px** vodorovný pás pod hlavičkou. Pás sa **nikdy neroluje
 *    vodorovne** — skrytá položka, ktorú treba najprv nájsť posunutím, je
 *    pre väčšinu ľudí stratená položka. Čo sa nezmestí, spadne do „Viac N"
 *    na konci pásu (`<details>` s ponukou ukotvenou vpravo).
 *  - **≥ 1024 px** ten istý pás, o dva pixely nižší; všetkých desať
 *    položiek sa zmestí a „Viac" sa nekreslí.
 *
 * Meranie prepadu: skrytý dvojník pásu so všetkými položkami
 * (`.app-nav--measure`) dá šírky a `ResizeObserver` na páse ich pri každej
 * zmene šírky prepočíta. **Bez JavaScriptu** sa vykreslí prvých
 * `STRIP_DEFAULT_VISIBLE` položiek + „Viac" so zvyškom — serverové HTML je
 * presne tento stav a skript ho len spresňuje. Dvojník meria položky
 * v aktívnom reze (650, nie 500) — aktívna položka je širšia a merať tenšiu
 * by znamenalo, že pás pretečie práve na stránke, ktorá je otvorená.
 *
 * Variant `sidebar` zostáva: bočný panel od 640 px, pod 640 px aj on
 * ustupuje spodnej lište.
 *
 * Ikony sú vlastné (rozhodnutie Jána Letka 2026-09-14,
 * `docs/O6_rozhodovaci_harok.md` bod 1) — pravidlá v `Icon.tsx`.
 *
 * Zoznam položiek a čisté funkcie sú v `lib/appNav.ts`, nie tu: z modulu
 * s `"use client"` sa funkcia na serveri volať nedá a `/more` aj `/library`
 * ich potrebujú na serveri.
 */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Icon from "./Icon"
import { usePathname } from "next/navigation"
import { navItems, isActive, tabbarItems, isTabActive, STRIP_DEFAULT_VISIBLE } from "@/lib/appNav"
import type { NavLayout, NavFlags, NavCounts, NavItem } from "@/lib/appNav"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export default function AppNav({
  layout: layout,
  flags: flags,
  counts: counts,
  language,
}: {
  layout: NavLayout
  flags: NavFlags
  counts?: NavCounts
  language?: UiLanguage
}) {
  const t = dictionary(language).nav
  const pathname = usePathname()
  const items = navItems(flags, counts)

  /** Koľko položiek je v páse; zvyšok je v ponuke „Viac". */
  const [visible, setVisible] = useState(STRIP_DEFAULT_VISIBLE)
  const strip = useRef<HTMLElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const morePopup = useRef<HTMLDetailsElement>(null)

  // Zmena stránky zatvorí ponuku „Viac" — inak zostane otvorená nad novým
  // obsahom. Rovnaké pravidlo ako osobné menu v hlavičke.
  useEffect(() => {
    if (morePopup.current) morePopup.current.open = false
  }, [pathname])

  /*
   * Šírky sa čítajú z dvojníka, nie z pásu samotného: pás má položky, ktoré
   * práve mení, a meranie počas prekresľovania by sa naháňalo s výsledkom.
   * Závislosť je odtlačok obsahu — šírka položky sa mení s jazykom aj
   * s číslom v odznaku, nie len s počtom položiek.
   */
  const fingerprint = items.map(o => `${o.key}:${o.count ?? ""}`).join("|") + "|" + (language ?? "")
  useEffect(() => {
    const bar = strip.current
    const twin = measure.current
    if (!bar || !twin) return

    const fit = () => {
      const style = getComputedStyle(bar)
      const gap = parseFloat(style.columnGap) || 0
      const avail = bar.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      if (avail <= 0) return // pás je skrytý (telefón) — nie je čo merať
      const nodes = Array.from(twin.children) as HTMLElement[]
      const toggle = nodes[nodes.length - 1]
      const widths = nodes.slice(0, -1).map(n => n.offsetWidth)

      const all = widths.reduce((a, w) => a + w, 0) + gap * Math.max(0, widths.length - 1)
      if (all <= avail) {
        setVisible(widths.length)
        return
      }

      // „Viac" bude potrebné — jeho šírka sa rezervuje vopred, inak by
      // posledná položka preblikávala medzi pásom a ponukou.
      const reserve = toggle.offsetWidth + gap
      let used = 0
      let n = 0
      for (const w of widths) {
        const next = used + (n > 0 ? gap : 0) + w
        if (next + reserve > avail) break
        used = next
        n += 1
      }
      setVisible(n)
    }

    fit()
    const watcher = new ResizeObserver(fit)
    watcher.observe(bar)
    watcher.observe(twin)
    return () => watcher.disconnect()
  }, [fingerprint, layout])

  const link = (o: NavItem) => {
    const active = isActive(pathname, o.href)
    return (
      <Link
        key={o.href}
        href={o.href}
        className={`app-nav-item${active ? " is-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {/*
          Ikona je **ozdoba, nie náhrada popisku**: `aria-hidden`, text zostáva.
          Ikonová navigácia bez slov je hádanka, ktorú sa človek musí naučiť —
          a pri položkách ako „Na potvrdenie" verzus „Na schválenie" by ju
          neuhádol ani po týždni.
        */}
        <Icon name={o.key} size={16} />
        {t[o.key]}
        {/*
          Nula sa nekreslí vôbec. Štítok s nulou nie je informácia, je to šum —
          a človek, ktorý nemá čo potvrdzovať, sa to má dozvedieť tým, že tam
          nič nesvieti, nie tým, že si prečíta „0".
        */}
        {typeof o.count === "number" && o.count > 0 && (
          <span className="app-nav-count" aria-label={t.waiting(o.count)}>
            {o.count}
          </span>
        )}
      </Link>
    )
  }

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

  if (layout === "sidebar") {
    // Bočný panel je zvislý — miesto má, prepad nepotrebuje.
    return (
      <>
        <nav className={`app-nav app-nav--${layout}`} aria-label={t.sections}>
          {items.map(link)}
        </nav>
        {tabbar}
      </>
    )
  }

  const shown = items.slice(0, visible)
  const overflow = items.slice(visible)

  return (
    <>
      <nav ref={strip} className="app-nav app-nav--topbar" aria-label={t.sections}>
        {shown.map(link)}
        <details ref={morePopup} className="app-nav-more" hidden={overflow.length === 0}>
          <summary className="app-nav-item app-nav-more-toggle">
            {t.more} {overflow.length}
          </summary>
          <div className="app-nav-more-menu">{overflow.map(link)}</div>
        </details>
      </nav>

      {/*
        Dvojník na meranie. `visibility: hidden` (v CSS), nie `display: none`:
        meranie potrebuje rozloženie — a takto skrytý nie je v strome
        prístupnosti ani sa naň nedá dostať klávesnicou, preto `<span>`,
        nie druhá kópia odkazov.
      */}
      <div ref={measure} className="app-nav app-nav--topbar app-nav--measure" aria-hidden="true">
        {items.map(o => (
          <span key={o.href} className="app-nav-item is-active">
            <Icon name={o.key} size={16} />
            {t[o.key]}
            {typeof o.count === "number" && o.count > 0 && <span className="app-nav-count">{o.count}</span>}
          </span>
        ))}
        <span className="app-nav-item app-nav-more-toggle">
          {t.more} {items.length}
        </span>
      </div>

      {tabbar}
    </>
  )
}
