/**
 * SectionTabs — podmenu sekcie, „kam idem" (ZAKLAD-podmenu-a-akcie,
 * 2. 10. 2026). Pod nadpisom sekcie, na všetkých jej stránkach rovnaké;
 * vzhľad je pás z ZAKLAD-podmenu-tabview.
 *
 * Vybraná je položka s **najdlhšou zhodou cesty** (`activeHref()`), takže
 * `/hr/overview` neoznačí aj Pridelenia (`/hr`). Položky sú `TabLink` —
 * pri prechode ukážu, že sa načítava.
 */

import TabLink from "./TabLink"
import TabsBar from "./TabsBar"
import { activeHref } from "@/lib/appNav"

export default function SectionTabs({
  tabs,
  current,
  label,
}: {
  tabs: { href: string; label: string }[]
  /** Cesta stránky, na ktorej podmenu stojí. */
  current: string
  label: string
}) {
  const active = activeHref(current, tabs.map(t => t.href))
  return (
    <nav className="tabs" aria-label={label}>
      <TabsBar>
        {tabs.map(t => (
          <TabLink key={t.href} href={t.href} active={t.href === active}>{t.label}</TabLink>
        ))}
      </TabsBar>
    </nav>
  )
}
