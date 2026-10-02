/**
 * OrgNav — zoznam častí nastavenia organizácie v skupinách (ZAKLAD-zalozky).
 *
 * Ten istý zoznam je rozcestníkom na `/organisation` a stĺpcom vľavo na
 * stránke časti (od 1024 px). Položky sú `TabLink`, takže pri prechode
 * ukážu, že sa načítava.
 */

import TabLink from "./TabLink"
import { ORG_SECTION_GROUPS, orgSectionHref, type OrgSection } from "@/lib/orgSections"

export default function OrgNav({
  current,
  label,
  groups,
  sections,
  className = "org-nav",
}: {
  /** Otvorená časť; na rozcestníku žiadna. */
  current?: OrgSection
  label: string
  groups: Record<string, string>
  sections: Record<string, string>
  className?: string
}) {
  return (
    <nav className={className} aria-label={label}>
      {ORG_SECTION_GROUPS.map(g => (
        <div key={g.key} className="org-nav-group">
          <h2 className="org-nav-title">{groups[g.key]}</h2>
          <div className="org-nav-list">
            {g.sections.map(k => (
              <TabLink key={k} className="org-nav-item" href={orgSectionHref(k)} active={k === current}>
                {sections[k] ?? k}
              </TabLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
