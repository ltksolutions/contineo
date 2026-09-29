/**
 * SkeletonShell — obrys shellu na čas čakania (`loading.tsx`).
 *
 * Samostatný súbor, nie v `Skeleton.tsx`: číta cookie `nav` (šírka bočného
 * panela), teda `next/headers`, a `Skeleton.tsx` sa načítava aj
 * v klientskych komponentoch (`Answer.tsx`) — tam by `next/headers` zhodilo
 * build.
 */

import type { ReactNode } from "react"
import { cookies } from "next/headers"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { NAV_COOKIE, normalizeNavState } from "@/lib/appNav"
import { Skeleton } from "./Skeleton"

/**
 * Obrys `AppShell`-u pre `loading.tsx`.
 *
 * **Prečo vôbec musí existovať:** `AppShell` si vyžiada každá stránka sama,
 * nie je v `layout.tsx` (a to je zámer — viď jeho docstring). `loading.tsx`
 * nahrádza stránku, takže počas čakania zmizne aj pás odkazov. Bez obrysu by
 * obsah poskočil o jeho výšku hore a po načítaní zase dole — a práve skok je
 * to, čo na čakaní najviac vadí.
 *
 * Obe formy navigácie sú v strome naraz, rovnako ako v `AppNav`: pás pre
 * širokú obrazovku a spodná lišta pre telefón. Prepína ich to isté
 * `@media` na 640 px, takže sa geometria nemôže rozísť s hotovou stránkou.
 *
 * Šesť položiek v páse nie je náhoda — presne toľko ich pás ukáže bez
 * JavaScriptu (`STRIP_DEFAULT_VISIBLE`), zvyšok býva v „Viac". Lišta má
 * päť terčov ako skutočná — kto nemá rolu knižnice, uvidí kostru o terč
 * širšiu; opačná chyba by vyzerala ako chýbajúci odkaz.
 */
export async function SkeletonShell({
  language,
  children,
}: {
  /**
   * Jazyk vety pre čítačku. `loading.tsx` ho **nemá odkiaľ vziať** — osoba sa
   * číta z databázy a kostra sa musí vykresliť okamžite — takže zostane
   * predvolený. Je to jediné slovo na celej kostre; kvôli nemu sa oplatí
   * čakať menej než nič.
   */
  language?: UiLanguage
  children: ReactNode
}) {
  const navState = normalizeNavState((await cookies()).get(NAV_COOKIE)?.value)
  return (
    <div className="app-shell" role="status" aria-live="polite" aria-busy="true">
      <span className="skeleton-label">{dictionary(language).nav.loading}</span>

      {/* Obrys bočného panela v tej istej šírke ako skutočný (cookie `nav`),
          inak by obsah po načítaní poskočil o 172 px do strany. */}
      <div className={`app-panel ${navState === "rail" ? "is-rail" : "is-wide"} skeleton-panel`} aria-hidden="true">
        <div className="app-panel-scroll">
          {Array.from({ length: 7 }, (_, i) => (
            <div className="app-panel-item" key={i}>
              <Skeleton className="skeleton-tab-icon" width={17} />
              <span className="app-panel-label"><Skeleton className="skeleton-line" width={70 + ((i * 17) % 50)} /></span>
            </div>
          ))}
        </div>
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

      <div className="app-main" aria-hidden="true">
        {children}
      </div>
    </div>
  )
}
