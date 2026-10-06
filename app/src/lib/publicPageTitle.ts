/**
 * publicPageTitle.ts — názov v karte prehliadača pre verejné stránky
 * (prihlásenie, ochrana údajov, overenie certifikátu).
 *
 * Koreňový layout skladá názov z adresy, ktorú mu posiela `proxy.ts`
 * (`PATHNAME_HEADER`). Verejné cesty ale `proxy.ts` púšťa skôr, než ju
 * nastaví — v karte potom bolo len „Intranet SFZ" (6. 10. 2026). Adresu
 * im tam neposielame zámerne: na verejnej stránke by sa podľa nej začala
 * kresliť aj cesta pod hlavičkou. Stránka preto názov nastaví sama.
 */

import type { Metadata } from "next"
import { pageTitle } from "./pageTitle"
import { dictionary } from "./i18n"
import { currentTenant } from "./session"
import { brandingView } from "./tenants"

export async function publicPageTitle(path: string): Promise<Metadata> {
  const tenant = await currentTenant().catch(() => null)
  // Bez organizácie (cudzia doména) rozhoduje koreňový layout — nič neprepisujeme.
  if (!tenant) return {}
  return { title: pageTitle(path, brandingView(tenant).displayName, dictionary(undefined)) }
}
