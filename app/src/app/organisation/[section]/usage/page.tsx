/**
 * /organisation/ai/usage — spotreba umelej inteligencie (ADR-026).
 *
 * Do 6. 10. 2026 to bol parameter `?view=usage` na `/organisation/ai`;
 * Spotreba je ale iná obrazovka a cesta ju má pomenovať (CLAUDE.md,
 * rozhodnutie R5 v `docs/DESIGN_ODCHYLKY.md`). Starý tvar presmeruje
 * `proxy.ts` (`legacyQueryRoute`).
 *
 * Obsah ostáva v `../page.tsx` (zdieľa práva, podmenu a filter) — táto
 * stránka ho len zapne. Pod inými časťami organizácie `usage` nie je.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function AiUsagePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section } = await params
  if (section !== "ai") notFound()
  return OrganisationSectionPage({ params, searchParams: Promise.resolve({ ...(await searchParams), view: "usage" }) })
}
