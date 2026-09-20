/**
 * AppShell — aplikačný obal, ktorý si stránka vyžiada sama.
 *
 * **`layout.tsx` sa zámerne nemení.** Shell si každá stránka vyžiada sama
 * a od 2026-09-08 ho majú všetky prihlásené obrazovky; výnimky menuje
 * `lib/shellRoutes.ts`. Kým je stránka mimo shellu, funguje presne ako dnes.
 *
 * Serverový komponent, nie klientsky: navigácia sa vykresľuje už na serveri,
 * takže sa pri načítaní neobjaví o zlomok sekundy neskôr než obsah.
 *
 * Role a počty pre navigáciu zisťuje `shellNavData()` (`lib/navData.ts`) —
 * tie isté funkcie, ktoré rozhodujú aj o samotných stránkach, a `cache()`,
 * takže si ich v tej istej požiadavke môže vypýtať aj stránka (`/more`)
 * bez dotazov navyše. Druhá kópia pravidla „kto smie kam" by bola horšia:
 * raz by sa rozišli a v navigácii by svietil odkaz do sekcie, do ktorej
 * stránka nepustí.
 *
 * **Dotazy navyše to nestojí.** Pôvodne tu stálo, že je to „štvrtý dotaz
 * navyše" a že sa dá ušetriť obalením `*Context()` do `cache()`. Overené
 * 2026-09-14: nie je čo ušetriť. `currentTenant()`, `currentPerson()`,
 * `requestSession()` aj `requestHostname()` **už v `cache()` sú**
 * (`lib/session.ts`) a kontexty nad nimi robia len porovnania. Štvrté
 * zavolanie kontextu teda databázu nevidí.
 */

import type { ReactNode } from "react"
import AppNav from "./AppNav"
import type { NavLayout } from "@/lib/appNav"
import { shellNavData } from "@/lib/navData"
import type { UiLanguage } from "@/lib/i18n"

export default async function AppShell({
  layout: layout = "topbar",
  language,
  children,
}: {
  /** Variant navigácie. Zatiaľ z adresy (`?layout=sidebar`), nie z profilu. */
  layout?: NavLayout
  language?: UiLanguage
  children: ReactNode
}) {
  const { flags, counts } = await shellNavData()

  return (
    <div className={`app-shell app-shell--${layout}`}>
      <AppNav layout={layout} flags={flags} counts={counts} language={language} />
      {/* `div`, nie `main`: `layout.tsx` už jeden `main` má a druhý vnútri
          neho by bol neplatné HTML — a pre čítačku obrazovky dva „hlavné
          obsahy" znamenajú, že ani jeden nie je ten hlavný. */}
      <div className="app-main">{children}</div>
    </div>
  )
}
