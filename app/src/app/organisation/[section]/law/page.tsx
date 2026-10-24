/**
 * /organisation/sources/law — Legislatíva: odber predpisov zo Slov-Lexu pre
 * Opýtať sa (ADR-039, D259) ako podstránka Zdrojov (ADR-040, D265).
 *
 * Vlastná adresa: časť, ktorú má cesta pomenovať, nie je `?view=`
 * (CLAUDE.md). Obsah ostáva v `../page.tsx` (zdieľa práva a podmenu) —
 * táto stránka ho len zapne. Starú adresu `/organisation/ai/law` prekladá
 * `legacyRoutes.ts`. Pod inými časťami `law` nie je.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function AiLawPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section } = await params
  if (section !== "sources") notFound()
  return OrganisationSectionPage({ params, searchParams: Promise.resolve({ ...(await searchParams), view: "law" }) })
}
