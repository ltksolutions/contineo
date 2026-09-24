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
export type NavKey = "overview" | "ask" | "toAcknowledge" | "toApprove" | "library" | "assigned" | "evidence" | "people" | "directory" | "evaluation" | "dpo"

export interface NavItem {
  href: string
  key: NavKey
  /**
   * Koľko vecí pod týmto odkazom čaká na prihláseného človeka.
   *
   * `undefined` znamená **nepočítalo sa** (alebo sa to nepodarilo), `0`
   * znamená nič nečaká — ani jedno sa nekreslí. Číslo, ktoré nič nežiada,
   * je v navigácii ozdoba, takže ho dostanú len položky, pod ktorými naozaj
   * niečo leží.
   */
  count?: number
}

/** Počty podľa kľúča položky. Zisťuje ich shell, nie táto funkcia. */
export type NavCounts = Partial<Record<NavKey, number>>

/**
 * Role prichádzajú zo servera, kde už prešli všetkými podmienkami. Klient
 * o nich nič neodvodzuje — rovnaký dôvod ako v `Header.tsx`.
 */
export interface NavFlags {
  isHr?: boolean
  isPeopleAdmin?: boolean
  isContentManager?: boolean
  isEvaluator?: boolean
  isDpo?: boolean
}

/**
 * Položky sú **skutočné routy podmienené rolami**, nie zoznam z prototypu:
 * odkaz na obrazovku, ktorá ešte neexistuje, vedie na 404 a odkaz na sekciu,
 * do ktorej človek nesmie, mu prezrádza, čo v systéme je.
 */
export function navItems(flags: NavFlags, counts: NavCounts = {}): NavItem[] {
  const items: NavItem[] = [
    /*
     * Prehľad je domov (`/`) — prvá obrazovka po kliknutí na prihlasovací
     * odkaz. Hľadanie zostáva hneď pod ním a je dostupné z hlavičky na
     * celom portáli; „domov" je to, čo od človeka chceme, nie ukážka toho,
     * čo systém vie.
     */
    { href: "/", key: "overview" },
    { href: "/ask", key: "ask" },
    // Odkaz vidí každý prihlásený; stránka si už poradí — kto nemá čo
    // potvrdzovať, uvidí, že nemá nič.
    { href: "/documents", key: "toAcknowledge" },
    // Ten istý dôvod ako o riadok vyššie: schvaľovatelia sú **menovaní ľudia**
    // (D69), nie držitelia roly, takže sa to podľa roly podmieniť nedá — a
    // dávať rolu `content-admin` niekomu len preto, aby smel schváliť text,
    // by mu zároveň dovolilo normy nahrávať a publikovať. Kto nemá čo
    // schvaľovať, uvidí, že nemá nič.
    { href: "/approvals", key: "toApprove" },
    // Adresár vidí **každý prihlásený** (D87) — je to zoznam kolegov, nie
    // správa prístupov. Podmieniť ho rolou by znamenalo mať adresár, do
    // ktorého sa nepozrie ten, kto v tej organizácii pracuje.
    { href: "/directory", key: "directory" },
    ...(flags.isContentManager ? [{ href: "/library", key: "library" as const }] : []),
    ...(flags.isHr ? [{ href: "/hr", key: "assigned" as const }] : []),
    // Reťaz dôkazov je údaj o **ľuďoch**, nie o dokumentoch — vidí ju
    // personalista, nie správca obsahu (D67).
    ...(flags.isHr ? [{ href: "/hr/evidence", key: "evidence" as const }] : []),
    ...(flags.isPeopleAdmin ? [{ href: "/people", key: "people" as const }] : []),
    // Fronta hodnotiteľa. Podmienená rolou zámerne: nie je to zoznam vecí
    // na prečítanie, ale pracovný stôl s cudzími otázkami a odpoveďami.
    ...(flags.isEvaluator ? [{ href: "/evaluation", key: "evaluation" as const }] : []),
    // Ochrana údajov (ADR-012, D104) — výkaz právnych základov a námietky.
    // Len pre rolu `dpo`: námietka je osobný údaj o konkrétnom človeku.
    ...(flags.isDpo ? [{ href: "/dpo", key: "dpo" as const }] : []),
  ]

  /*
   * Počty sa priraďujú až tu. Zoznam vyššie tak zostáva jediným miestom, kde
   * sa rozhoduje **čo** človek vidí; počet je údaj navyše a nesmie sa doňho
   * miešať.
   */
  return items.map(o => (counts[o.key] === undefined ? o : { ...o, count: counts[o.key] }))
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

/* ── Tri tvary navigácie (NASADENIE, PR 2) ──────────────────────────────── */

/**
 * Kľúč položky spodnej lišty. `tasks` a `more` sú syntetické: „Úlohy"
 * zlučujú „Na potvrdenie" a „Na schválenie" (súčet v odznaku), „Viac"
 * vedie na `/more`, kde je zvyšok položiek. Nie sú v `NavKey` zámerne —
 * `navItems()` zostáva jediným miestom, kde sa rozhoduje, **čo** človek
 * vidí; lišta z hotového poľa len vyberá a skladá.
 */
export type TabKey = NavKey | "tasks" | "more"

export interface TabItem {
  href: string
  key: TabKey
  count?: number
  /** Cesty, na ktorých položka svieti — zlúčená položka ich má viac. */
  activeFor: string[]
}

/** Poradie lišty z návrhu: Prehľad · Opýtať sa · Knižnica · Úlohy · Viac. */
const TABBAR_KEYS: NavKey[] = ["overview", "ask", "library"]

/** Čo lišta pokrýva sama — zvyšok patrí na `/more`. */
const IN_TABBAR: NavKey[] = [...TABBAR_KEYS, "toAcknowledge", "toApprove"]

/**
 * Položky spodnej lišty na telefóne. Kto nemá rolu správy obsahu, nemá
 * „Knižnicu" a lišta má štyri položky — dopĺňať ju do počtu inou sekciou
 * by znamenalo, že tá istá pozícia palca vedie u dvoch ľudí inam.
 */
export function tabbarItems(items: NavItem[]): TabItem[] {
  const byKey = new Map(items.map(o => [o.key, o] as const))
  const tabs: TabItem[] = []
  for (const key of TABBAR_KEYS) {
    const o = byKey.get(key)
    if (o) tabs.push({ href: o.href, key: o.key, count: o.count, activeFor: [o.href] })
  }

  /*
   * „Úlohy" — povinnosti človeka na jednom mieste. Vedú na „Na potvrdenie"
   * (častejšia z dvoch povinností); „Na schválenie" je v zozname na `/more`,
   * inak by sa naň z telefónu nedalo dostať vôbec. Svietia na oboch cestách,
   * lebo obe sem patria.
   */
  const ack = byKey.get("toAcknowledge")
  const approve = byKey.get("toApprove")
  if (ack || approve) {
    const counted = ack?.count !== undefined || approve?.count !== undefined
    tabs.push({
      href: (ack ?? approve)!.href,
      key: "tasks",
      // `undefined` znamená nepočítalo sa — súčet by z toho spravil nulu
      // a nula tvrdí „nič nečaká", čo sa nezisťovalo.
      count: counted ? (ack?.count ?? 0) + (approve?.count ?? 0) : undefined,
      activeFor: [ack?.href, approve?.href].filter((h): h is string => typeof h === "string"),
    })
  }

  tabs.push({
    href: "/more",
    key: "more",
    // Svieti aj na sekciách, ktoré pod „Viac" bývajú — človek má na lište
    // vidieť, kade sa tam dostal. Schvaľovanie svieti na „Úlohách", nie tu.
    activeFor: ["/more", ...items.filter(o => !IN_TABBAR.includes(o.key)).map(o => o.href)],
  })
  return tabs
}

export function isTabActive(pathname: string, tab: TabItem): boolean {
  return tab.activeFor.some(href => isActive(pathname, href))
}

export type MoreGroupKey = "organisation" | "management"

/**
 * Skupiny na `/more`. Osobné veci (príručka, moje potvrdenia, odhlásenie)
 * tu zámerne nie sú — bývajú pod avatarom v hlavičke, ktorá na telefóne
 * zostáva, a dve položky s tým istým cieľom sú horšie než jedna
 * (ten istý dôvod ako v `Header.tsx`).
 */
const MORE_GROUPS: Record<MoreGroupKey, NavKey[]> = {
  organisation: ["directory", "people"],
  management: ["toApprove", "assigned", "evidence", "evaluation", "dpo"],
}

export interface MoreGroup {
  key: MoreGroupKey
  items: NavItem[]
}

/** Zvyšok `navItems()` pre `/more`, v skupinách. Prázdna skupina sa nevracia. */
export function moreGroups(items: NavItem[]): MoreGroup[] {
  const pick = (keys: NavKey[]) =>
    keys.map(k => items.find(o => o.key === k)).filter((o): o is NavItem => o !== undefined)

  const groups: MoreGroup[] = [
    { key: "organisation", items: pick(MORE_GROUPS.organisation) },
    { key: "management", items: pick(MORE_GROUPS.management) },
  ]

  /*
   * Poistka na budúce položky: kľúč, na ktorý sa pri delení zabudne, padne
   * do „Správy". Odkaz v nesprávnej skupine je nepohodlie; odkaz, ktorý sa
   * z telefónu stratí úplne, je výpadok sekcie.
   */
  const covered = new Set<NavKey>([...IN_TABBAR, ...MORE_GROUPS.organisation, ...MORE_GROUPS.management])
  groups[1].items.push(...items.filter(o => !covered.has(o.key)))

  return groups.filter(g => g.items.length > 0)
}

/** Bez JavaScriptu ukáže pás prvých 6 položiek + „Viac" — meranie ich spresní. */
export const STRIP_DEFAULT_VISIBLE = 6
