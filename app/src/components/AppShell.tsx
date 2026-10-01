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
import { headers } from "next/headers"
import AppNav from "./AppNav"
import Breadcrumbs from "./Breadcrumbs"
import { PATHNAME_HEADER, breadcrumbs, menuColumns, navItems, type NavKey } from "@/lib/appNav"
import { shellNavData } from "@/lib/navData"
import { dictionary, type UiLanguage } from "@/lib/i18n"

const ALL_KEYS: NavKey[] = [
  "overview", "ask", "toAcknowledge", "toApprove", "directory", "library", "learning",
  "assigned", "evidence", "people", "evaluation", "dpo", "learningManage", "learningTests",
]

export default async function AppShell({
  language,
  wide = false,
  title,
  trail,
  leaf,
  children,
}: {
  language?: UiLanguage
  /**
   * Širší strop obsahu (`--shell-maxw-wide`) namiesto predvolených 1240 px.
   *
   * Vypýta si ho **jediná obrazovka — knižnica**, lebo jediná má naraz
   * bočný panel filtrov a deväťstĺpcovú tabuľku. Ostatné sú text alebo
   * formuláre a tým 1240 px vyhovuje; širšie by im len rozťahovalo riadok.
   *
   * Nie je to prepínač na „plnú šírku okna": aj široký variant má strop.
   * Na 27“ monitore by riadok bez stropu mal cez 2000 px a oko stratí
   * spojitosť medzi názvom vľavo a dátumom vpravo — to je iná chyba, nie
   * oprava (rozhodnutie Jána 2026-09-22).
   */
  wide?: boolean
  /**
   * Názov tejto stránky — posledný krok cesty. Netreba ho na koreni sekcie
   * (`/hr`, `/library`), tam je názvom sekcia; treba ho na všetkom
   * hlbšom (`/hr/assign`, detail normy) a na stránkach mimo sekcií
   * (`/notifications`).
   */
  title?: string
  /**
   * Názvy rodičovských krokov podľa adresy, keď ich z adresy nevyčítať —
   * napr. `{ "/library/abc": "Pracovný poriadok" }` na `/library/abc/text`.
   */
  trail?: Record<string, string>
  /**
   * Krok za stránkou, ktorý v adrese nie je cestou, ale parametrom — časť
   * nastavenia organizácie (`?tab=signin`, ZAKLAD-zalozky Q2). Stránka sa
   * vtedy stane odkazom a posledný krok nesie názov časti.
   */
  leaf?: string
  children: ReactNode
}) {
  const { flags, counts } = await shellNavData()
  const t = dictionary(language).nav
  const items = navItems(flags, counts)

  /*
   * Cesta sa skladá z adresy. Serverový komponent ju od Nextu nedostane,
   * preto ju podáva `proxy.ts` v hlavičke požiadavky. Keď chýba (stránka,
   * pred ktorou proxy nebežal), pás sa nekreslí — radšej bez cesty než
   * s nepravdivou.
   */
  const pathname = ((await headers()).get(PATHNAME_HEADER) ?? "/").replace(/(.)\/+$/, "$1")
  const crumbs = breadcrumbs(pathname, {
    overview: t.overview,
    groups: { organisation: t.groupOrganisation, management: t.groupManagement },
    sections: Object.fromEntries(ALL_KEYS.map(k => [k, t[k]])) as Record<NavKey, string>,
    pages: { ...trail, ...(title ? { [pathname]: title } : {}) },
  })
  if (leaf && crumbs.length > 0) {
    crumbs[crumbs.length - 1] = { ...crumbs[crumbs.length - 1], href: pathname }
    crumbs.push({ label: leaf, href: null })
  }

  /*
   * Celé menu pre spodnú plachtu na telefóne („Menu" v lište). Plachta
   * v hlavičke má ten istý obsah — skladá ho `layout.tsx` tou istou funkciou.
   */
  const columns = menuColumns(items, t)
  const labels = {
    allSections: t.allSections, escCloses: t.escCloses, sheetHint: t.sheetHint,
    close: dictionary(language).ask.sheet.close,
  }

  return (
    <div className="app-shell">
      <Breadcrumbs crumbs={crumbs} label={t.breadcrumb} wide={wide} />
      {/* `div`, nie `main`: `layout.tsx` už jeden `main` má a druhý vnútri
          neho by bol neplatné HTML — a pre čítačku obrazovky dva „hlavné
          obsahy" znamenajú, že ani jeden nie je ten hlavný. */}
      <div className={wide ? "app-main app-main--wide" : "app-main"}>{children}</div>
      <AppNav flags={flags} counts={counts} language={language} columns={columns} labels={labels} />
    </div>
  )
}
