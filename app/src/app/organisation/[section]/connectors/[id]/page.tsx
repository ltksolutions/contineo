/**
 * /organisation/sources/connectors/<id> — detail konektora (návrh
 * ORG-konektory, 9. 10. 2026, Q2; v Zdrojoch od ADR-040 krok 2).
 *
 * Detail má vlastnú cestu, lebo ho cesta pod hlavičkou pomenúva
 * (CLAUDE.md: „Časť, ktorú má cesta pomenovať, má vlastnú adresu").
 * Obsah ostáva v `../../page.tsx`; táto stránka ho len zapne. Starú adresu
 * `/organisation/connectors/<id>` prekladá `legacyRoutes.ts`.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function ConnectorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; id: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section, id } = await params
  if (section !== "sources") notFound()
  return OrganisationSectionPage({
    params: Promise.resolve({ section }),
    searchParams: Promise.resolve({ ...(await searchParams), view: "connectors", connector: id }),
  })
}
