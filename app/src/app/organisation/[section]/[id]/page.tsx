/**
 * /organisation/connectors/<id> — detail konektora (návrh ORG-konektory,
 * 9. 10. 2026, Q2).
 *
 * Detail má vlastnú cestu, lebo ho cesta pod hlavičkou pomenúva
 * (CLAUDE.md: „Časť, ktorú má cesta pomenovať, má vlastnú adresu").
 * Obsah ostáva v `../page.tsx` — zdieľa práva, zoznam častí a hlásenia;
 * táto stránka ho len zapne, ako `usage/page.tsx` Spotrebu. Pod inými
 * časťami organizácie nič také nie je.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function ConnectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; id: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section, id } = await params
  if (section !== "connectors") notFound()
  return OrganisationSectionPage({
    params: Promise.resolve({ section }),
    searchParams: Promise.resolve({ ...(await searchParams), connector: id }),
  })
}
