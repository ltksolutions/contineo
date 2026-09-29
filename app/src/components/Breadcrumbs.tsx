/**
 * Breadcrumbs — pás cesty pod hlavičkou (SHELL-rozcestnik, bod 4).
 *
 * Prehľad › Skupina › Sekcia › … › Aktuálna, na každej stránke v shelli
 * okrem Prehľadu. Skladá ho `breadcrumbs()` z adresy, nie z histórie
 * prehliadača — rovnaký je aj po otvorení odkazu z e-mailu. Posledný krok
 * je aktuálna stránka, nie odkaz.
 *
 * Serverový komponent: cesta sú obyčajné odkazy a funguje bez skriptu.
 * Klientska je len plachta sekcií na začiatku pásu (`SectionsSheet`).
 */

import type { ReactNode } from "react"
import Link from "next/link"
import type { Crumb } from "@/lib/appNav"

export default function Breadcrumbs({
  crumbs,
  label,
  sheet,
  wide = false,
}: {
  crumbs: Crumb[]
  /** `aria-label` navigácie — „Cesta". */
  label: string
  /** Tlačidlo plachty všetkých sekcií. */
  sheet: ReactNode
  /** Rovnaký strop ako obsah (`AppShell` s `wide`) — cesta lícuje s ním. */
  wide?: boolean
}) {
  if (crumbs.length === 0) return null
  return (
    <div className="app-path">
      <div className={wide ? "app-path-row app-path-row--wide" : "app-path-row"}>
        {sheet}
        <span className="app-path-sep" aria-hidden="true" />
        <nav aria-label={label}>
          <ol className="app-path-list">
            {crumbs.map((c, i) => (
              <li key={`${i}-${c.href ?? "current"}`}>
                {c.href === null
                  ? <span aria-current="page">{c.label}</span>
                  : <Link href={c.href}>{c.label}</Link>}
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  )
}
