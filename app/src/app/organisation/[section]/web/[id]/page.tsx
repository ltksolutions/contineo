/**
 * /organisation/sources/web/<id> — detail zdroja druhu Web / RSS
 * (ADR-040 Dodatok 1, D268). Dnes jediný: `slov-lex` — odber predpisov
 * z katalógu legislatívy pre Opýtať sa (ADR-039, D259).
 *
 * Staré adresy `/organisation/sources/law` a `/organisation/ai/law`
 * prekladá `legacyRoutes.ts`. Neznámy zdroj je 404.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../../page"
import { SLOV_LEX_SOURCE_ID } from "@/lib/lawCatalog"
import type { RawQuery } from "@/lib/urlParams"

export default async function WebSourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; id: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section, id } = await params
  if (section !== "sources" || id !== SLOV_LEX_SOURCE_ID) notFound()
  return OrganisationSectionPage({
    params: Promise.resolve({ section }),
    searchParams: Promise.resolve({ ...(await searchParams), view: SLOV_LEX_SOURCE_ID }),
  })
}
