/**
 * /organisation/ai/overview — Prehľad spotreby AI po mesiacoch (návrh
 * ORG-ai-prehlad, 24. 10. 2026; ADR-026).
 *
 * Obsah je v `../page.tsx` (zdieľa práva, podmenu a obdobie so Spotrebou) —
 * táto stránka ho len zapne, rovnako ako `usage/page.tsx`. Pohľad je
 * `?by=people|purposes|models`; `view` je obsadené výberom časti.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function AiOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section } = await params
  if (section !== "ai") notFound()
  return OrganisationSectionPage({ params, searchParams: Promise.resolve({ ...(await searchParams), view: "overview" }) })
}
