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
export type NavKey = "overview" | "ask" | "toAcknowledge" | "toApprove" | "goldenSet" | "library" | "assigned" | "evidence" | "people"

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
    /*
     * Prehľad je prvý, lebo je to obrazovka, na ktorú sa človek vracia —
     * nie tá, na ktorej začne. Adresa je `/prehlad`, nie `/`: presunúť
     * front door je zmena prevádzky a patrí rozhodnutiu, nie commitu.
     */
    { href: "/prehlad", key: "overview" },
    { href: "/", key: "ask" },
    // Odkaz vidí každý prihlásený; stránka si už poradí — kto nemá čo
    // potvrdzovať, uvidí, že nemá nič.
    { href: "/documents", key: "toAcknowledge" },
    // Ten istý dôvod ako o riadok vyššie: schvaľovatelia sú **menovaní ľudia**
    // (D69), nie držitelia roly, takže sa to podľa roly podmieniť nedá — a
    // dávať rolu `spravca-obsahu` niekomu len preto, aby smel schváliť text,
    // by mu zároveň dovolilo normy nahrávať a publikovať. Kto nemá čo
    // schvaľovať, uvidí, že nemá nič.
    { href: "/approvals", key: "toApprove" },
    ...(flags.isContentManager ? [{ href: "/library", key: "library" as const }] : []),
    ...(flags.isHr ? [{ href: "/hr", key: "assigned" as const }] : []),
    // Reťaz dôkazov je údaj o **ľuďoch**, nie o dokumentoch — vidí ju
    // personalista, nie správca obsahu (D67).
    ...(flags.isHr ? [{ href: "/hr/evidence", key: "evidence" as const }] : []),
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
