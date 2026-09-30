/**
 * Breadcrumbs — pás cesty pod hlavičkou (SHELL-rozcestnik, bod 4).
 *
 * Prehľad › Skupina › Sekcia › … › Aktuálna, na každej stránke v shelli
 * okrem Prehľadu. Skladá ho `breadcrumbs()` z adresy, nie z histórie
 * prehliadača — rovnaký je aj po otvorení odkazu z e-mailu. Posledný krok
 * je aktuálna stránka, nie odkaz.
 *
 * Serverový komponent: cesta sú obyčajné odkazy a funguje bez skriptu.
 * Plachta všetkých sekcií bola do 30. 9. 2026 na začiatku pásu; odvtedy je
 * v hlavičke, aby bola aj na Prehľade (SHELL-menu-v-hlavicke, Q1).
 */

import Link from "next/link"
import type { Crumb } from "@/lib/appNav"

export default function Breadcrumbs({
  crumbs,
  label,
  wide = false,
}: {
  crumbs: Crumb[]
  /** `aria-label` navigácie — „Cesta". */
  label: string
  /** Rovnaký strop ako obsah (`AppShell` s `wide`) — cesta lícuje s ním. */
  wide?: boolean
}) {
  if (crumbs.length === 0) return null
  return (
    <div className="app-path">
      <div className={wide ? "app-path-row app-path-row--wide" : "app-path-row"}>
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
