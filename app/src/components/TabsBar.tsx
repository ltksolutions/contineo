"use client"

/**
 * TabsBar — kapsula podmenu sekcie (ZAKLAD-podmenu-tabview, 2. 10. 2026).
 *
 * Na úzkej obrazovke sa pás posúva do strán a päť položiek HR sa na 390 px
 * nezmestí. Po načítaní sa pás posunie tak, aby bola vybraná položka
 * vidieť (ZAKLAD-podmenu-a-akcie, Q3) — inak by na Výkaze bolo vidieť
 * Pridelenia a Pripomienky a človek by nevedel, kde je.
 *
 * `scrollLeft` na páse, **nie `scrollIntoView`**: ten posúva aj celú
 * stránku, takže by človeka po načítaní zhodil z nadpisu. Bez skriptu pás
 * funguje, len začína zľava.
 */

import { useEffect, useRef, type ReactNode } from "react"

export default function TabsBar({ children }: { children: ReactNode }) {
  const bar = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = bar.current
    const active = el?.querySelector<HTMLElement>(".is-active")
    if (!el || !active || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft = active.offsetLeft - 14
  }, [])
  return <span className="tabs-bar" ref={bar}>{children}</span>
}
