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
 * Stránky mimo sekcií menu (Upozornenia, Organizácia, Ochrana údajov…)
 * majú názov v `pages`; bez adresy je v záložke len organizácia.
 */

import { breadcrumbs, type NavKey } from "./appNav"
import type { dictionary } from "./i18n"
import { ORG_SECTIONS } from "./orgSections"

type Dictionary = ReturnType<typeof dictionary>

const SECTION_KEYS: NavKey[] = [
  "overview", "ask", "toAcknowledge", "toApprove", "directory", "library", "learning",
  "assigned", "evidence", "people", "evaluation", "dpo", "helpdesk", "learningManage", "learningTests",
]

export function pageTitle(pathname: string | null | undefined, organisation: string, t: Dictionary): string {
  if (!pathname) return organisation
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  const crumbs = breadcrumbs(path, {
    overview: t.nav.overview,
    groups: { organisation: t.nav.groupOrganisation, management: t.nav.groupManagement },
    sections: Object.fromEntries(SECTION_KEYS.map(k => [k, t.nav[k]])) as Record<NavKey, string>,
    pages: {
      "/more": t.nav.menu,
      // Záložky sekcie Pridelené dokumenty — karta prehliadača má povedať,
      // na ktorej je človek (ZAKLAD-podmenu-a-akcie, 2. 10. 2026).
      "/hr/overview": t.hr.tabs.report,
      "/hr/reminders": t.hr.tabs.reminders,
      "/hr/tracks": t.hr.tabs.tracks,
      // Stránky mimo sekcií menu — bez nich bola v karte len organizácia
      // (6. 10. 2026, napr. „Intranet SFZ" na Upozorneniach).
      "/notifications": t.notifications.title,
      "/acknowledgements": t.myAcknowledgements.heading,
      "/guide": t.guide.heading,
      "/privacy": t.privacy.title,
      "/sign-in": t.signIn.heading,
      "/verify": t.learning.cert.vTitle,
      "/organisation": t.org.heading,
      ...Object.fromEntries(ORG_SECTIONS.map(s => [`/organisation/${s}`, t.org.tabs[s] ?? t.org.heading])),
      "/admin": t.admin.list.heading,
      "/admin/new": t.admin.create.heading,
    },
  })
  // Z cesty stačí posledný krok; skupina (Organizácia, Správa) nie je stránka.
  const page = path === "/" ? t.nav.overview : crumbs.length > 1 ? crumbs[crumbs.length - 1].label : null
  return page ? `${page} · ${organisation}` : organisation
}
