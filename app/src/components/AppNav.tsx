"use client"

/**
 * AppNav — navigácia aplikačného shellu v dvoch variantoch.
 *
 * `sidebar` je bočný panel, `topbar` vodorovné záložky. Nie sú to dva
 * komponenty: rozdiel je v smere a rozostupoch, teda v CSS, a dve kópie by
 * znamenali, že sa jedna z nich raz začne správať inak.
 *
 * Položky sú **skutočné routy podmienené rolami**, nie zoznam z prototypu:
 * odkaz na obrazovku, ktorá ešte neexistuje, vedie na 404 a odkaz na sekciu,
 * do ktorej človek nesmie, mu prezrádza, čo v systéme je.
 *
 * Ikony zatiaľ nie sú. Prototyp má na ich mieste textové znaky (▦ ▤ ⌕) a tie
 * do produkcie nepatria; projekt vlastný ikonový set nemá a kresliť šesť
 * nových od ruky handoff výslovne zakazuje. Bez ikon je navigácia čitateľná,
 * s vymyslenými by bola len ozdobnejšia.
 *
 * Správcovské odkazy (nastavenie organizácie, správa tenantov) tu zámerne
 * nie sú — zostávajú pod avatarom v hlavičke, ktorý sa v shelli neskrýva.
 * Sú to veci otvárané raz za mesiac a v dennej navigácii len zaberajú miesto.
 */

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { dictionary, type UiLanguage } from "@/lib/i18n"

export type NavLayout = "sidebar" | "topbar"

/** Kľúč do `dictionary().nav` — nie hotový text, aby zostal preložiteľný. */
export type NavKey = "ask" | "toAcknowledge" | "goldenSet" | "library" | "assigned" | "people"

export interface NavItem {
  href: string
  key: NavKey
}

/**
 * Role prichádzajú zo servera, kde už prešli všetkými podmienkami. Klient
 * o nich nič neodvodzuje — rovnaký dôvod ako v `Header.tsx`.
 */
export interface NavFlags {
  isHr?: boolean
  isPeopleAdmin?: boolean
  isContentManager?: boolean
}

export function navItems(flags: NavFlags): NavItem[] {
  return [
    { href: "/", key: "ask" },
    // Odkaz vidí každý prihlásený; stránka si už poradí — kto nemá čo
    // potvrdzovať, uvidí, že nemá nič.
    { href: "/documents", key: "toAcknowledge" },
    ...(flags.isContentManager ? [{ href: "/library", key: "library" as const }] : []),
    ...(flags.isHr ? [{ href: "/hr", key: "assigned" as const }] : []),
    ...(flags.isPeopleAdmin ? [{ href: "/people", key: "people" as const }] : []),
    { href: "/golden-set", key: "goldenSet" },
  ]
}

/**
 * Variant z adresy. Čokoľvek iné než `sidebar` je `topbar` — predvolený je
 * podľa návrhu a neznáma hodnota v adrese nemá zhodiť stránku.
 */
export function normalizeLayout(value: unknown): NavLayout {
  return value === "sidebar" ? "sidebar" : "topbar"
}

/**
 * Aktívna položka. Tu sa **na prefix pozerá** (na rozdiel od `isShellRoute`):
 * kto je na `/library/new`, je stále v knižnici a má to na navigácii vidieť.
 * Domov je výnimka — inak by svietil na každej stránke.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

export default function AppNav({
  layout: layout,
  flags: flags,
  language,
}: {
  layout: NavLayout
  flags: NavFlags
  language?: UiLanguage
}) {
  const t = dictionary(language).nav
  const pathname = usePathname()
  const items = navItems(flags)
  const bar = useRef<HTMLElement>(null)

  /*
   * Na úzkej obrazovke je navigácia vodorovný pás a aktívna položka môže byť
   * mimo výrezu — človek potom nevidí, kde je, a pás vyzerá ako by sa začínal
   * inde. Posúva sa **vlastný `scrollLeft` pásu**, nie `scrollIntoView()`:
   * ten hýbe aj stránkou a pri načítaní by ju stiahol pod hlavičku.
   */
  useEffect(() => {
    const node = bar.current
    if (!node) return
    // Nič neprečnieva (široká obrazovka alebo bočný panel) — netreba nič robiť.
    if (node.scrollWidth <= node.clientWidth) return
    const active = node.querySelector<HTMLElement>(".is-active")
    if (!active) return
    node.scrollLeft = active.offsetLeft - (node.clientWidth - active.offsetWidth) / 2
  }, [pathname, layout])

  return (
    <nav ref={bar} className={`app-nav app-nav--${layout}`} aria-label={t.sections}>
      {items.map(o => {
        const active = isActive(pathname, o.href)
        return (
          <Link
            key={o.href}
            href={o.href}
            className={`app-nav-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {t[o.key]}
          </Link>
        )
      })}
    </nav>
  )
}
