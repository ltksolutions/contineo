/**
 * SkeletonShell — obrys shellu na čas čakania (`loading.tsx`).
 *
 * **Prečo vôbec musí existovať:** `AppShell` si vyžiada každá stránka sama,
 * nie je v `layout.tsx` (a to je zámer — viď jeho docstring). `loading.tsx`
 * nahrádza stránku, takže počas čakania zmizne aj pás cesty a spodná lišta.
 * Bez obrysu by obsah poskočil o ich výšku hore a po načítaní zase dole —
 * a práve skok je to, čo na čakaní najviac vadí.
 *
 * Pás cesty má každá stránka okrem Prehľadu (SHELL-rozcestnik), preto ho
 * kostra kreslí predvolene a Prehľad si ho vypne (`path={false}`). Spodnú
 * lištu prepína to isté `@media` na 640 px ako skutočnú, takže sa geometria
 * nemôže rozísť s hotovou stránkou. Lišta má päť terčov ako skutočná — kto
 * nemá rolu knižnice, uvidí kostru o terč širšiu; opačná chyba by vyzerala
 * ako chýbajúci odkaz.
 *
 * Samostatný súbor, nie v `Skeleton.tsx`, len z histórie (kým čítal cookie
 * bočného panela); presúvať ho späť by znamenalo meniť 40 `loading.tsx`.
 */

import type { ReactNode } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { Skeleton } from "./Skeleton"

export function SkeletonShell({
  language,
  path = true,
  children,
}: {
  /**
   * Jazyk vety pre čítačku. `loading.tsx` ho **nemá odkiaľ vziať** — osoba sa
   * číta z databázy a kostra sa musí vykresliť okamžite — takže zostane
   * predvolený. Je to jediné slovo na celej kostre; kvôli nemu sa oplatí
   * čakať menej než nič.
   */
  language?: UiLanguage
  /** Pás cesty pod hlavičkou — všade okrem Prehľadu. */
  path?: boolean
  children: ReactNode
}) {
  return (
    <div className="app-shell" role="status" aria-live="polite" aria-busy="true">
      <span className="skeleton-label">{dictionary(language).nav.loading}</span>

      {path && (
        <div className="app-path" aria-hidden="true">
          <div className="app-path-row">
            <Skeleton className="skeleton-line" width={18} />
            <span className="app-path-sep" />
            <Skeleton className="skeleton-line" width={220} />
          </div>
        </div>
      )}

      <div className="app-main" aria-hidden="true">
        {children}
      </div>

      {/* Telefón: na mieste spodnej lišty. Triedy skutočnej lišty držia
          presne jej geometriu — kliknúť sa na kostru nedá a ani nemá,
          kostra nie je ovládací prvok. */}
      <div className="app-nav-tabbar" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="app-nav-tab" key={i}>
            <Skeleton className="skeleton-tab-icon" width={21} />
            <Skeleton className="skeleton-line" width={34} />
          </div>
        ))}
      </div>
    </div>
  )
}
