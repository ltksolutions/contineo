/**
 * urlParams.ts — preklad starých kľúčov a hodnôt v adrese.
 *
 * Kľúče v adrese sú zmluva navonok: sú v záložkách prehliadača, v odkazoch
 * v e-mailoch a vo formulároch, ktoré si prehliadač vykreslil ešte pred
 * nasadením. Premenovať ich a staré zahodiť by tie odkazy potichu rozbilo —
 * stránka by sa otvorila, len by nič nenašla. Preto sa **prekladajú**.
 *
 * Je to jedna tabuľka na jednom mieste: preklad potrebuje aj stránka pri
 * čítaní adresy, aj serverová akcia pri návrate. Dve kópie by sa rozišli
 * presne vtedy, keď pribudne ďalšie premenovanie.
 *
 * Zmizne, keď staré odkazy prestanú chodiť.
 */

/** Staré slovenské kľúče → nové anglické. */
export const LEGACY_QUERY_KEYS: Record<string, string> = {
  sprava: "msg",
  chyba: "error",
  zalozka: "tab",
  hladat: "search",
  stav: "status",
  priecinok: "folder",
  dokument: "document",
  publikum: "audience",
  odoslane: "sent",
}

/** Staré hodnoty záložky v nastavení organizácie → nové. */
export const LEGACY_TAB_VALUES: Record<string, string> = {
  utvary: "departments",
  oddelenia: "departments",
  vzhlad: "general",
  // „Vzhľad a jazyky" → „Všeobecné" (3. 10. 2026): odkazy a formuláre so
  // starým kľúčom vedú na novú časť.
  branding: "general",
  domeny: "domains",
  prihlasenie: "signin",
  ciselniky: "codelists",
  clenenie: "chunking",
}

export type RawQuery = Record<string, string | string[] | undefined>

/**
 * Prepíše staré kľúče na nové. Keď v adrese sedí oboje, vyhráva nový —
 * inak by starý odkaz prebil to, čo stránka vykreslila teraz.
 */
export function normalizeQuery<T extends object>(sp: RawQuery): T {
  const out: RawQuery = { ...sp }
  for (const [old, now] of Object.entries(LEGACY_QUERY_KEYS)) {
    if (out[old] !== undefined) {
      if (out[now] === undefined) out[now] = out[old]
      delete out[old]
    }
  }
  return out as T
}

/** Preloží hodnotu záložky; neznámu nechá tak, ako prišla. */
export function tabValue(value: string | undefined): string | undefined {
  if (!value) return undefined
  return LEGACY_TAB_VALUES[value] ?? value
}

/**
 * Tá istá adresa bez vybraných kľúčov — kam vedie potvrdenie oznamu
 * (`Notice`). Vyplnené hodnoty formulára, ktoré akcia vrátila v adrese,
 * ostanú; zmizne len správa, inak by sa oznam po potvrdení ukázal znova.
 */
export function hrefWithout(path: string, sp: RawQuery, drop: string[]): string {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined || drop.includes(key)) continue
    for (const v of Array.isArray(value) ? value : [value]) out.append(key, v)
  }
  const qs = out.toString()
  return qs ? `${path}?${qs}` : path
}
