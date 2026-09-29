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
 *
 * Od 29. 9. 2026 nemá desktop stále menu vôbec (SHELL-rozcestnik, Q1):
 * sekcie sú dlaždice na Prehľade (`sectionGroups()`), na podstránke je pod
 * hlavičkou cesta (`breadcrumbs()`) a plachta všetkých sekcií. Pás
 * `topbar`, bočný panel, `?layout=` ani `normalizeLayout()` už nie sú.
 */

/** Kľúč do `dictionary().nav` — nie hotový text, aby zostal preložiteľný. */
export type NavKey = "overview" | "ask" | "toAcknowledge" | "toApprove" | "library" | "assigned" | "evidence" | "people" | "directory" | "evaluation" | "dpo" | "learning" | "learningManage" | "learningTests"

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
  /** Organizácia má zapnutý modul Vzdelávanie a človek je prihlásený (ADR-018). */
  learning?: boolean
  /** Rola `learning-admin` — má zmysel len spolu s `learning`. */
  isLearningAdmin?: boolean
  /** Zodpovedá aspoň za jeden test — vidí jeho výsledky (D121), aj bez roly. */
  isTestResponsible?: boolean
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
    // Vzdelávanie (ADR-018, D123) — len pri zapnutom module. Moje kurzy pre
    // každého, správa a testy pre lektora. Rola bez zapnutého modulu nič
    // neotvára: routy by aj tak odpovedali 404.
    ...(flags.learning ? [{ href: "/learning", key: "learning" as const }] : []),
    ...(flags.learning && flags.isLearningAdmin ? [{ href: "/learning/manage", key: "learningManage" as const }] : []),
    // Testy: lektor celú obrazovku, zodpovedná osoba testu len svoje výsledky.
    ...(flags.learning && (flags.isLearningAdmin || flags.isTestResponsible)
      ? [{ href: flags.isLearningAdmin ? "/learning/tests" : "/learning/tests?tab=results", key: "learningTests" as const }]
      : []),
  ]

  /*
   * Počty sa priraďujú až tu. Zoznam vyššie tak zostáva jediným miestom, kde
   * sa rozhoduje **čo** človek vidí; počet je údaj navyše a nesmie sa doňho
   * miešať.
   */
  return items.map(o => (counts[o.key] === undefined ? o : { ...o, count: counts[o.key] }))
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

/**
 * Aktívna je **najdlhšia** zhodná položka, nie každá zhodná. Na
 * `/hr/evidence` by inak svietili „Pridelené normy" (`/hr`) aj „Reťaz
 * dôkazov" (`/hr/evidence`) — rám HR-pravny-zaklad, bod 8.
 */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null
  for (const h of hrefs) {
    if (isActive(pathname, h) && (!best || h.length > best.length)) best = h
  }
  return best
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

/**
 * Tretia pozícia lišty. Kto má Knižnicu, má ju tam; kto nie a má zapnuté
 * Vzdelávanie, dostane tam Vzdelávanie (rám LEARNING, Q1 ✅ 27. 9.).
 * U správcu obsahu je Vzdelávanie pod „Viac" — lišta sa nepredlžuje.
 */
function tabbarKeys(items: NavItem[]): NavKey[] {
  const has = (k: NavKey) => items.some(o => o.key === k)
  return has("library") || !has("learning") ? TABBAR_KEYS : ["overview", "ask", "learning"]
}

/** Čo lišta pokrýva sama — zvyšok patrí na `/more`. */
function inTabbar(items: NavItem[]): NavKey[] {
  return [...tabbarKeys(items), "toAcknowledge", "toApprove"]
}

/**
 * Položky spodnej lišty na telefóne. Kto nemá rolu správy obsahu, nemá
 * „Knižnicu" a lišta má štyri položky — dopĺňať ju do počtu inou sekciou
 * by znamenalo, že tá istá pozícia palca vedie u dvoch ľudí inam.
 */
export function tabbarItems(items: NavItem[]): TabItem[] {
  const byKey = new Map(items.map(o => [o.key, o] as const))
  const tabs: TabItem[] = []
  for (const key of tabbarKeys(items)) {
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
    activeFor: ["/more", ...items.filter(o => !inTabbar(items).includes(o.key)).map(o => o.href)],
  })
  return tabs
}

export function isTabActive(pathname: string, tab: TabItem): boolean {
  return tab.activeFor.some(href => isActive(pathname, href))
}


/* ── Rozcestník: dlaždice sekcií (SHELL-rozcestnik) ─────────────────────── */

export type SectionGroupKey = "organisation" | "management"

/**
 * Hlavné položky — nie sú dlaždice. Prehľad je stránka s dlaždicami sama,
 * Opýtať sa je pole v hlavičke a povinnosti človeka sú KPI nad dlaždicami.
 * V plachte všetkých sekcií tvoria prvý stĺpec „Hlavné".
 */
export const MAIN_KEYS: NavKey[] = ["overview", "ask", "toAcknowledge", "toApprove"]

/**
 * Skupiny dlaždíc. Rovnaké na Prehľade, na `/more` aj v plachte — tá istá
 * sekcia nemá byť raz v „Organizácii" a inde v „Správe" (Q4). Osoby sú
 * v Správe: je to správa ľudí, nie adresár kolegov (ten je D87 pre
 * každého).
 */
const SECTION_GROUPS: { key: SectionGroupKey; keys: NavKey[] }[] = [
  { key: "organisation", keys: ["directory", "library", "learning"] },
  { key: "management", keys: ["assigned", "evidence", "people", "evaluation", "dpo", "learningManage", "learningTests"] },
]

export interface SectionGroup {
  key: SectionGroupKey
  items: NavItem[]
}

/**
 * `navItems()` ako dlaždice v skupinách. Roly rozhodol už `navItems()` —
 * tu sa len delí. Prázdna skupina sa nevracia: bežná osoba nemá vidieť
 * nadpis „Správa" nad ničím. Kľúč, na ktorý sa pri delení zabudne, padne
 * do „Správy": dlaždica v nesprávnej skupine je nepohodlie, stratená
 * dlaždica je sekcia, na ktorú sa už nedá dostať.
 */
export function sectionGroups(items: NavItem[]): SectionGroup[] {
  const pick = (keys: NavKey[]) =>
    keys.map(k => items.find(o => o.key === k)).filter((o): o is NavItem => o !== undefined)
  const groups = SECTION_GROUPS.map(g => ({ key: g.key, items: pick(g.keys) }))
  const covered = new Set<NavKey>([...MAIN_KEYS, ...SECTION_GROUPS.flatMap(g => g.keys)])
  groups.find(g => g.key === "management")!.items.push(...items.filter(o => !covered.has(o.key)))
  return groups.filter(g => g.items.length > 0)
}

/** Skupina sekcie — pre cestu (Prehľad › Skupina › Sekcia). */
function groupOf(key: NavKey): SectionGroupKey | null {
  if (MAIN_KEYS.includes(key)) return null
  return SECTION_GROUPS.find(g => g.keys.includes(key))?.key ?? "management"
}

export type MoreGroupKey = "tasks" | SectionGroupKey

export interface MoreGroup {
  key: MoreGroupKey
  items: NavItem[]
}

/**
 * `/more` na telefóne — tie isté dlaždice ako Prehľad (Q4), bez sekcií,
 * ktoré už sú na spodnej lište. Nad nimi „Moje úlohy" so schvaľovaním:
 * lišta ho nesie len v súčte „Úloh", ktoré vedú na potvrdenia, a bez tohto
 * riadku by sa naň z telefónu nedalo dostať. Schvaľovatelia sú menovaní
 * ľudia (D69), nie rola — preto k úlohám, nie k správe.
 *
 * Osobné veci (príručka, moje potvrdenia, odhlásenie) tu zámerne nie sú —
 * bývajú pod avatarom v hlavičke, ktorá na telefóne zostáva, a dve položky
 * s tým istým cieľom sú horšie než jedna (ten istý dôvod ako v `Header.tsx`).
 */
export function moreGroups(items: NavItem[]): MoreGroup[] {
  const onBar = new Set(tabbarKeys(items))
  const rest = items.filter(o => !onBar.has(o.key))
  const tasks = rest.filter(o => o.key === "toApprove")
  return [
    ...(tasks.length > 0 ? [{ key: "tasks" as const, items: tasks }] : []),
    ...sectionGroups(rest),
  ]
}

/* ── Cesta pod hlavičkou (SHELL-rozcestnik, bod 4) ──────────────────────── */

/**
 * Kde sekcia býva — **bez ohľadu na rolu**. Cesta sa skladá z adresy, nie
 * z toho, čo človek smie: kto na stránku prišiel, tomu ju stránka pustila
 * a jej sekcia je jej sekcia. Testy majú pre zodpovednú osobu inú adresu
 * v `navItems()` (`?tab=results`), cesta ukazuje koreň sekcie.
 */
const SECTION_HREF: Record<NavKey, string> = {
  overview: "/",
  ask: "/ask",
  toAcknowledge: "/documents",
  toApprove: "/approvals",
  directory: "/directory",
  library: "/library",
  learning: "/learning",
  assigned: "/hr",
  evidence: "/hr/evidence",
  people: "/people",
  evaluation: "/evaluation",
  dpo: "/dpo",
  learningManage: "/learning/manage",
  learningTests: "/learning/tests",
}

/**
 * Hlavička požiadavky, v ktorej `proxy.ts` podáva adresu stránky
 * `AppShell`-u. Serverový komponent ju od Nextu inak nedostane a cesta sa
 * z nej skladá.
 */
export const PATHNAME_HEADER = "x-contineo-pathname"

export interface Crumb {
  label: string
  /** `null` = aktuálna stránka — nie je odkaz (`aria-current="page"`). */
  href: string | null
}

export interface CrumbNames {
  overview: string
  groups: Record<SectionGroupKey, string>
  sections: Record<NavKey, string>
  /**
   * Názvy ďalších krokov podľa cesty (`/hr/assign` → „Prideliť normu",
   * `/library/abc` → názov normy). Dodáva ich stránka — vie, ako sa volá
   * ona aj jej rodič; z adresy sa to vyčítať nedá.
   */
  pages?: Record<string, string>
}

/** Cesta s dekódovanými úsekmi. Chybné kódovanie úseku ho nechá tak. */
function decodePath(path: string): string {
  return path.split("/").map(segment => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  }).join("/")
}

/**
 * Cesta od Prehľadu k aktuálnej stránke: Prehľad › Skupina › Sekcia › … ›
 * Aktuálna. Z adresy, nie z histórie prehliadača — rovnaká aj po otvorení
 * odkazu z e-mailu.
 *
 * - Na Prehľade (`/`) je prázdna — pás sa nekreslí.
 * - Skupina vedie na svoje dlaždice na Prehľade (`/#management`).
 * - Hlavné položky (Opýtať sa, Na potvrdenie…) skupinu nemajú.
 * - Medzikrok, ktorému stránka nedala názov, sa vynechá: `/learning/x/y/test`
 *   nie je stránka, len úsek adresy, a krok bez názvu by bol holý kľúč.
 * - Neznáma cesta mimo sekcií: Prehľad › aktuálna.
 * - Posledný krok je aktuálny, len keď je to naozaj táto adresa. Keď názov
 *   aktuálnej stránky chýba, ostanú všetky kroky odkazmi — tvrdiť o rodičovi,
 *   že je aktuálny, by bola nepravda.
 */
export function breadcrumbs(pathname: string, names: CrumbNames): Crumb[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  if (path === "/" || path === "") return []

  /*
   * Kľúče názvov sa porovnávajú **dekódované**: stránka pozná parameter už
   * dekódovaný (`sfz:stanovy`), adresa ho môže niesť aj kódovaný
   * (`sfz%3Astanovy`) — podľa toho, kto odkaz poskladal.
   */
  const pages = new Map(Object.entries(names.pages ?? {}).map(([k, v]) => [decodePath(k), v]))
  const crumbs: { label: string; href: string }[] = [{ label: names.overview, href: "/" }]

  const sectionHref = activeHref(path, Object.values(SECTION_HREF).filter(h => h !== "/"))
  let start = ""
  if (sectionHref) {
    const key = (Object.keys(SECTION_HREF) as NavKey[]).find(k => SECTION_HREF[k] === sectionHref)!
    const group = groupOf(key)
    if (group) crumbs.push({ label: names.groups[group], href: `/#${group}` })
    crumbs.push({ label: names.sections[key], href: sectionHref })
    start = sectionHref
  }

  const rest = path.slice(start.length).split("/").filter(Boolean)
  let prefix = start
  for (const segment of rest) {
    prefix = `${prefix}/${segment}`
    const label = pages.get(decodePath(prefix))
    if (label) crumbs.push({ label, href: prefix })
  }

  return crumbs.map(c => ({ label: c.label, href: c.href === path ? null : c.href }))
}

