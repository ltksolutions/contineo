/**
 * /organisation/sources/web — zdroje druhu Web / RSS (ADR-040 Dodatok 1, D268).
 *
 * Druh je zoznam, zdroj je detail — ako pri konektoroch. Dnes je jediný
 * zdroj Slov-Lex (`web/slov-lex`); český adaptér alebo RSS vestníka
 * pribudnú ako ďalšie riadky. Obsah ostáva v `../page.tsx`; táto stránka ho
 * len zapne. Pod inými časťami `web` nie je.
 */
import { notFound } from "next/navigation"
import OrganisationSectionPage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function WebSourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<RawQuery>
}) {
  const { section } = await params
  if (section !== "sources") notFound()
  return OrganisationSectionPage({ params, searchParams: Promise.resolve({ ...(await searchParams), view: "web" }) })
}
