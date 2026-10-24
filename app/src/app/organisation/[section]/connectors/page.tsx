/**
 * /organisation/sources/connectors — konektory ako podstránka Zdrojov
 * (ADR-040, D267 krok 2; návrh ORG-konektory, 9. 10. 2026).
 *
 * Obsah ostáva v `../page.tsx` (zdieľa práva, podmenu a hlásenia) — táto
 * stránka ho len zapne. Starú sekciu `/organisation/connectors` prekladá
 * `legacyRoutes.ts`. Pod inými časťami `connectors` nie je.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function ConnectorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section } = await params
  if (section !== "sources") notFound()
  return OrganisationSectionPage({ params, searchParams: Promise.resolve({ ...(await searchParams), view: "connectors" }) })
}
