/**
 * AppShell — aplikačný obal, ktorý si stránka vyžiada sama.
 *
 * **`layout.tsx` sa zámerne nemení.** Obaľuje `.obal` s max. 900 px všetky
 * stránky — `/documents`, `/hr`, `/people`, `/admin`, `/golden-set` — a tie sú
 * na tú šírku postavené. Globálna zmena by ich rozbila všetky naraz, a to za
 * jediný deň práce na knižnici. Preto je shell opt-in: prvá a zatiaľ jediná
 * stránka v ňom je `/library`, kde sa overí na skutočnom obsahu. Ostatné sa
 * presúvajú po jednej. Kým je stránka mimo shellu, funguje presne ako dnes.
 *
 * Serverový komponent, nie klientsky: navigácia sa vykresľuje už na serveri,
 * takže sa pri načítaní neobjaví o zlomok sekundy neskôr než obsah.
 *
 * Role si zisťuje sám cez tie isté funkcie, ktoré rozhodujú aj o samotných
 * stránkach. Je to štvrtý dotaz navyše — ale druhá kópia pravidla „kto smie
 * kam" je horšia než štyri dotazy: raz by sa rozišli a v navigácii by svietil
 * odkaz do sekcie, do ktorej stránka nepustí. (Ušetriť sa dá inde: obaliť
 * `*Context()` do `cache()` z Reactu, aby sa v rámci jednej požiadavky
 * nepočítali dvakrát. To je samostatná zmena a týka sa aj `layout.tsx`.)
 */

import type { ReactNode } from "react"
import AppNav, { type NavLayout } from "./AppNav"
import { hrContext } from "@/lib/hr"
import { peopleContext } from "@/lib/people"
import { libraryContext } from "@/lib/library"
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
  // Zlyhanie sa berie ako „neukazovať" — rovnako ako v `layout.tsx`. Odkaz,
  // ktorý sa neukázal, je nepohodlie; odkaz, ktorý sa ukázal omylom, je únik.
  let isHr = false
  let isPeopleAdmin = false
  let isContentManager = false
  try {
    isHr = (await hrContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu HR sa nepodarilo overiť:", e)
  }
  try {
    isPeopleAdmin = (await peopleContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu správy osôb sa nepodarilo overiť:", e)
  }
  try {
    isContentManager = (await libraryContext()).state === "ready"
  } catch (e) {
    console.error("[shell] rolu správy obsahu sa nepodarilo overiť:", e)
  }

  return (
    <div className={`app-shell app-shell--${layout}`}>
      <AppNav
        layout={layout}
        flags={{ isHr: isHr, isPeopleAdmin: isPeopleAdmin, isContentManager: isContentManager }}
        language={language}
      />
      {/* `div`, nie `main`: `layout.tsx` už jeden `main` má a druhý vnútri
          neho by bol neplatné HTML — a pre čítačku obrazovky dva „hlavné
          obsahy" znamenajú, že ani jeden nie je ten hlavný. */}
      <div className="app-main">{children}</div>
    </div>
  )
}
