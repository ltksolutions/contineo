/**
 * HrTabs — podmenu sekcie Pridelené dokumenty (ZAKLAD-podmenu-a-akcie,
 * 2. 10. 2026): Pridelenia · Výkaz potvrdení · Pripomienky · Trasy ·
 * Reťaz dôkazov (Q1, Q4). Len na týchto piatich stránkach — hlbšie
 * (`/hr/[id]`, `assign`, `tracks/[key]`, `notify`, `revoke`) majú cestu.
 *
 * Trasy smie spravovať aj správca obsahu bez roly personalistu
 * (`trackManagerContext`). Ten by z podmenu videl len odkazy, ktoré mu
 * vrátia 404 — jedna položka nie je menu, takže sa nekreslí vôbec.
 */

import SectionTabs from "./SectionTabs"
import { isHr } from "@/lib/hr"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import type { Person } from "@/lib/persons"

export const HR_TAB_HREFS = {
  assignments: "/hr",
  report: "/hr/overview",
  reminders: "/hr/reminders",
  tracks: "/hr/tracks",
  evidence: "/hr/evidence",
} as const

export default function HrTabs({
  current,
  person,
  language,
}: {
  current: string
  person: Person
  language?: UiLanguage
}) {
  if (!isHr(person)) return null
  const t = dictionary(language).hr
  const tabs = (Object.keys(HR_TAB_HREFS) as (keyof typeof HR_TAB_HREFS)[])
    .map(k => ({ href: HR_TAB_HREFS[k], label: t.tabs[k] }))
  return <SectionTabs tabs={tabs} current={current} label={t.tabsLabel} />
}
