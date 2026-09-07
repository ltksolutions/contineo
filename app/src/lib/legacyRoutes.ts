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

/**
 * Predpony, nie celé cesty. `/kniznica/abc/text` má prejsť na
 * `/library/abc/text` bez toho, aby sa každá podstránka vypisovala zvlášť.
 *
 * Poradie je podstatné — dlhšie prv. Inak by `/kniznica/trasy` spadlo pod
 * `/kniznica` a skončilo ako `/library/trasy`.
 */
const PREFIXES: [string, string][] = [
  ["/kniznica/trasy", "/library/tracks"],
  ["/kniznica/nova", "/library/new"],
  ["/kniznica", "/library"],
  ["/dokumenty", "/documents"],
  ["/osoby/pozvat", "/people/invite"],
  ["/osoby/nova", "/people/new"],
  ["/osoby", "/people"],
  ["/organizacia", "/organisation"],
  ["/prihlasenie", "/sign-in"],
  ["/sada", "/golden-set"],
  ["/hr/pridelit", "/hr/assign"],
  ["/admin/tenanti", "/admin/tenants"],
  ["/admin/novy", "/admin/new"],
  ["/api/kniznica/subor", "/api/library/file"],
  ["/api/kniznica", "/api/library"],
  ["/api/sada", "/api/golden-set"],
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
