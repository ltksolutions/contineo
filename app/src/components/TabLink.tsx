"use client"

/**
 * TabLink — záložka, ktorá ukáže, že sa načítava.
 *
 * Záložky nastavenia organizácie sú **tá istá stránka s iným `?tab=`**.
 * `loading.tsx` sa pri tom neukáže (mení sa len adresa, nie úsek cesty)
 * a Next podrží starý obsah, kým nepríde nový — kliknutie tak vyzeralo, že
 * sa nestalo nič (Ján, 25. 9. 2026). `useLinkStatus()` povie, že sa na
 * tento odkaz čaká; záložka dostane `is-pending` a CSS stlmí obsah pod
 * záložkami a ukáže pruh.
 */

import Link, { useLinkStatus } from "next/link"
import type { ReactNode } from "react"

function Pending() {
  const { pending } = useLinkStatus()
  return <span className={`tab-pending${pending ? " is-on" : ""}`} aria-hidden="true" />
}

export default function TabLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: ReactNode
}) {
  return (
    <Link href={href} className={`tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
      {children}
      <Pending />
    </Link>
  )
}
