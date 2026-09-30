/**
 * pageTitle.ts — názov v záložke prehliadača (ASK-otazka-z-hlavicky, Q4).
 *
 * „{stránka} · {organizácia}", napr. „Opýtať sa · Intranet SFZ". Dovtedy
 * bol v záložke všade „Contineo — testovacie rozhranie" — aj na
 * `intranet.futbalsfz.sk`, kde človek potvrdzuje záväzné predpisy.
 *
 * Stránka je posledný krok cesty pod hlavičkou (`breadcrumbs()`), teda
 * sekcia alebo známa podstránka; Prehľad pre `/`. Názov detailu (napr.
 * normy) do záložky nejde — pozná ho až stránka, nie obal, a sekcia
 * v záložke stačí na to, aby sa medzi desiatimi kartami dala nájsť.
 * Bez adresy (stránka mimo prihlásenia) je v záložke len organizácia.
 */

import { breadcrumbs, type NavKey } from "./appNav"
import type { dictionary } from "./i18n"

type Dictionary = ReturnType<typeof dictionary>

const SECTION_KEYS: NavKey[] = [
  "overview", "ask", "toAcknowledge", "toApprove", "directory", "library", "learning",
  "assigned", "evidence", "people", "evaluation", "dpo", "learningManage", "learningTests",
]

export function pageTitle(pathname: string | null | undefined, organisation: string, t: Dictionary): string {
  if (!pathname) return organisation
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  const crumbs = breadcrumbs(path, {
    overview: t.nav.overview,
    groups: { organisation: t.nav.groupOrganisation, management: t.nav.groupManagement },
    sections: Object.fromEntries(SECTION_KEYS.map(k => [k, t.nav[k]])) as Record<NavKey, string>,
    pages: { "/more": t.nav.more },
  })
  // Z cesty stačí posledný krok; skupina (Organizácia, Správa) nie je stránka.
  const page = path === "/" ? t.nav.overview : crumbs.length > 1 ? crumbs[crumbs.length - 1].label : null
  return page ? `${page} · ${organisation}` : organisation
}
