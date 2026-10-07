/**
 * legacyRoutes.ts — staré slovenské adresy na nové anglické.
 *
 * Cesty sa **preložili, nie premenovali** — rovnaká zásada ako pri kľúčoch
 * v adrese (`urlParams.ts`) a pri premennej `POVOLENE_EMAILY`. Záložka
 * v prehliadači, odkaz v e-maile spred mesiaca a `callbackUrl` uložený
 * v relácii ukazujú na staré cesty a musia fungovať ďalej.
 *
 * **Prečo v middleware, a nie v `next.config`.** Presmerovanie z konfigurácie
 * a brána prihlásenia sú dve vrstvy, ktorých poradie závisí od verzie Nextu;
 * keby sa raz prehodilo, neprihlásený človek na starej adrese by skončil na
 * prihlásení s `callbackUrl` na neexistujúcu cestu. Tu je poradie napísané
 * a dá sa otestovať.
 *
 * **307, nie 308.** Dočasné presmerovanie si prehliadač nezapamätá natrvalo.
 * Keby sa niektorá cesta ukázala ako chyba, stačí zmeniť kód — pri 308 by
 * záznam zostal v prehliadačoch ľudí a odvolať sa nedá.
 */

import {
  coursePath, importPath, MANAGE_PATH, managePath, NEW_QUESTION_PATH, partPath, questionPath,
  RESERVED_COURSE_KEYS, TESTS_PATH, testsPath,
} from "./learningPaths"

/**
 * Predpony, nie celé cesty. `/kniznica/abc/text` má prejsť na
 * `/library/abc/text` bez toho, aby sa každá podstránka vypisovala zvlášť.
 *
 * Poradie je podstatné — dlhšie prv. Inak by `/kniznica/trasy` spadlo pod
 * `/kniznica` a skončilo ako `/library/trasy`.
 */
const PREFIXES: [string, string][] = [
  // Trasy prešli z knižnice do Pridelených dokumentov (2. 10. 2026).
  // „Vzhľad a jazyky" → „Všeobecné" (3. 10. 2026).
  ["/organisation/branding", "/organisation/general"],
  // Členenie sa od 5. 10. 2026 v organizácii nenastavuje (D160) — rozcestník.
  ["/organisation/chunking", "/organisation"],
  // Helpdesk prešiel pod Kanály (D170, 7. 10. 2026): fronta aj ticket.
  ["/helpdesk", "/channels/tickets"],
  ["/kniznica/trasy", "/hr/tracks"],
  ["/library/tracks", "/hr/tracks"],
  ["/kniznica/nova", "/library/new"],
  ["/kniznica", "/library"],
  ["/dokumenty", "/documents"],
  ["/osoby/pozvat", "/people/invite"],
  ["/osoby/nova", "/people/new"],
  ["/osoby", "/people"],
  ["/organizacia", "/organisation"],
  ["/prihlasenie", "/sign-in"],
  ["/hr/pridelit", "/hr/assign"],
  ["/admin/tenanti", "/admin/tenants"],
  ["/admin/novy", "/admin/new"],
  ["/api/kniznica/subor", "/api/library/file"],
  ["/api/kniznica", "/api/library"],
  ["/api/znacka", "/api/brand"],
  ["/api/fotka", "/api/photo"],
  ["/api/hodnotenie", "/api/rating"],
]

/**
 * `/hr/{id}/oznamit` — segment v strede, na predponu sa nechytá.
 * Je to jediný taký prípad; všeobecný prepis segmentov by kvôli nemu
 * riskoval, že sa raz prepíše aj kus identifikátora.
 */
const MIDDLE = /^\/hr\/([^/]+)\/oznamit$/

/** Nová cesta, alebo `null`, keď je adresa už v poriadku. */
export function legacyRoute(pathname: string): string | null {
  const middle = MIDDLE.exec(pathname)
  if (middle) return `/hr/${middle[1]}/notify`

  for (const [from, to] of PREFIXES) {
    if (pathname === from) return to
    if (pathname.startsWith(`${from}/`)) return to + pathname.slice(from.length)
  }
  return null
}

/**
 * Časť obrazovky, ktorú mala adresa v parametri a ktorá dostala vlastnú
 * cestu (DESIGN_ODCHYLKY R4, 6. 10. 2026) — „časť, ktorú má cesta
 * pomenovať, má vlastnú adresu". Ostatné parametre idú so sebou.
 *
 * - `/library/<id>?edit=document` → `/library/<id>/edit`
 * - `/organisation/ai?view=usage` → `/organisation/ai/usage` (R5; ADR-026
 *   zapísal `?view=`, poznámka o zmene je v ňom)
 * - Vzdelávanie (R3, 7. 10. 2026): `/learning/manage?tab=topics|tags`,
 *   `/learning/manage/<kurz>?tab=settings|people` a `?part=<časť>`,
 *   `/learning/tests?tab=questions` (aj `&q=`, `&new=1`, `&import=`)
 *   a `?tab=results` — viď `learningQueryRoute`.
 */
export function legacyQueryRoute(pathname: string, search: URLSearchParams): string | null {
  const learning = learningQueryRoute(pathname, search)
  if (learning) return learning
  const doc = /^\/library\/([^/]+)$/.exec(pathname)
  if (doc && search.get("edit") === "document" && doc[1] !== "new") {
    const rest = new URLSearchParams(search)
    rest.delete("edit")
    const q = rest.toString()
    return `/library/${doc[1]}/edit${q ? `?${q}` : ""}`
  }
  if (pathname === "/organisation/ai" && search.get("view") === "usage") {
    const rest = new URLSearchParams(search)
    rest.delete("view")
    const q = rest.toString()
    return `/organisation/ai/usage${q ? `?${q}` : ""}`
  }
  return null
}

/** Cesta s ostatnými parametrami bez tých, ktoré sa stali úsekom cesty. */
function withRest(path: string, search: URLSearchParams, consumed: string[]): string {
  const rest = new URLSearchParams(search)
  for (const k of consumed) rest.delete(k)
  const q = rest.toString()
  return `${path}${q ? `?${q}` : ""}`
}

/**
 * Staré tvary Vzdelávania (DESIGN_ODCHYLKY R3). `?tab=` so základnou časťou
 * (`courses`, `parts`, `tests`) len zmizne; neznáma hodnota ostane — stránka
 * ju aj doteraz ignorovala.
 */
function learningQueryRoute(pathname: string, search: URLSearchParams): string | null {
  const tab = search.get("tab")
  if (pathname === MANAGE_PATH) {
    if (tab === "topics" || tab === "tags") return withRest(managePath(tab), search, ["tab"])
    if (tab === "courses") return withRest(MANAGE_PATH, search, ["tab"])
    return null
  }
  const course = /^\/learning\/manage\/([^/]+)$/.exec(pathname)
  if (course && !RESERVED_COURSE_KEYS.includes(course[1])) {
    const key = decodeURIComponent(course[1])
    const part = search.get("part")
    if (part && (!tab || tab === "parts")) return withRest(partPath(key, part), search, ["tab", "part"])
    if (tab === "settings" || tab === "people") return withRest(coursePath(key, tab), search, ["tab", "part"])
    if (tab === "parts") return withRest(coursePath(key), search, ["tab"])
    return null
  }
  if (pathname === TESTS_PATH) {
    if (tab === "results") return withRest(testsPath("results"), search, ["tab"])
    if (tab === "tests") return withRest(TESTS_PATH, search, ["tab"])
    if (tab !== "questions") return null
    const imp = search.get("import")
    if (imp) return withRest(imp === "1" ? importPath() : importPath(imp), search, ["tab", "import", "q", "new"])
    if (search.get("new") === "1") return withRest(NEW_QUESTION_PATH, search, ["tab", "new", "q"])
    const q = search.get("q")
    if (q) return withRest(questionPath(q), search, ["tab", "q"])
    return withRest(testsPath("questions"), search, ["tab"])
  }
  return null
}
