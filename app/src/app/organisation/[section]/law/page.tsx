/**
 * /organisation/ai/law — Legislatíva: odber predpisov zo Slov-Lexu pre
 * Opýtať sa (ADR-039, D259).
 *
 * Vlastná adresa ako Spotreba a Prehľad: časť, ktorú má cesta pomenovať,
 * nie je `?view=` (CLAUDE.md). Obsah ostáva v `../page.tsx` (zdieľa práva
 * a podmenu) — táto stránka ho len zapne. Pod inými časťami `law` nie je.
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
  if (section !== "ai") notFound()
  return OrganisationSectionPage({ params, searchParams: Promise.resolve({ ...(await searchParams), view: "law" }) })
}
