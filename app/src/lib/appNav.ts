/**
 * Navigácia shellu — čisté funkcie a typy.
 *
 * Prečo samostatný súbor: `AppNav.tsx` je klientsky komponent (`"use client"`)
 * a **všetko, čo z takého modulu vyjde, je pre server len odkaz na klienta,
 * nie funkcia.** Kým `normalizeLayout()` bývalo vyexportované odtiaľ, volanie
 * zo serverovej `/library` prešlo vývojovým režimom aj `tsc`, ale v produkčnom
 * builde skončilo hláškou „Attempted to call normalizeLayout() from the server
 * but normalizeLayout is on the client" a stránka spadla na 500.
 *
 * Pravidlo, ktoré z toho platí: čo potrebuje server aj klient, nesmie bývať
 * v module s `"use client"`. Tu žiadna direktíva nie je zámerne — súbor je
 * obojaký a nič v ňom nesiaha na `window` ani na React.
 */

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

/**
 * Položky sú **skutočné routy podmienené rolami**, nie zoznam z prototypu:
 * odkaz na obrazovku, ktorá ešte neexistuje, vedie na 404 a odkaz na sekciu,
 * do ktorej človek nesmie, mu prezrádza, čo v systéme je.
 */
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
