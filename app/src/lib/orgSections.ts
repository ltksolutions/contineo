/**
 * orgSections.ts — časti nastavenia organizácie a ich adresy.
 *
 * Každá časť má vlastnú cestu `/organisation/{section}` (2. 10. 2026,
 * rozhodnutie Jána, možnosť 1). Dovtedy bola časť v `?tab=`, takže cesta
 * pod hlavičkou nevedela, kde človek je, a `/organisation` na počítači
 * ukazovalo niečo iné než na telefóne. `/organisation` je rozcestník.
 *
 * Skupiny a poradie sú z ZAKLAD-zalozky (Q1, Q3): poradie v skupinách je
 * zároveň poradie častí.
 */

import { tabValue } from "./urlParams"

export const ORG_SECTION_GROUPS = [
  { key: "org", sections: ["general", "departments", "codelists", "ai"] },
  { key: "access", sections: ["domains", "signin"] },
  // Členenie (`chunking`) tu do 5. 10. 2026 bolo; od D160 sa nenastavuje
  // v organizácii — stará adresa vedie na rozcestník (`legacyRoutes.ts`).
  { key: "documents", sections: ["acknowledgements"] },
  { key: "oversight", sections: ["audit", "gdpr"] },
] as const

export type OrgSectionGroup = (typeof ORG_SECTION_GROUPS)[number]["key"]
export type OrgSection = (typeof ORG_SECTION_GROUPS)[number]["sections"][number]

export const ORG_SECTIONS: readonly OrgSection[] = ORG_SECTION_GROUPS.flatMap(g => g.sections)

export function isOrgSection(value: string | undefined | null): value is OrgSection {
  return ORG_SECTIONS.includes(value as OrgSection)
}

export function orgSectionHref(section: OrgSection): string {
  return `/organisation/${section}`
}

/**
 * Stará adresa `/organisation?tab=signin` (aj `?zalozka=prihlasenie`) →
 * `/organisation/signin`, ostatné parametre (`msg`, `error`, `search`) ostanú.
 * Odkazy v e-mailoch, záložkách prehliadača a v návode ukazujú na starý
 * tvar — preklad, nie premenovanie. Neznáma hodnota vedie na rozcestník.
 * `null`, keď adresa nie je stará.
 */
export function legacyOrgSection(pathname: string, search: URLSearchParams): string | null {
  if (pathname !== "/organisation") return null
  const given = search.get("tab") ?? search.get("zalozka")
  if (given === null) return null
  const rest = new URLSearchParams(search)
  rest.delete("tab")
  rest.delete("zalozka")
  const section = tabValue(given)
  const path = isOrgSection(section) ? orgSectionHref(section) : "/organisation"
  const q = rest.toString()
  return q ? `${path}?${q}` : path
}
