/**
 * /library/[id]/edit — úprava dokumentu (názov, kategória, priečinok…).
 *
 * Do 6. 10. 2026 to bol parameter `?edit=document` na detaile; časť, ktorú
 * má cesta pomenovať, má ale vlastnú adresu (CLAUDE.md, rozhodnutie R4
 * v `docs/DESIGN_ODCHYLKY.md`). Starý tvar presmeruje `proxy.ts`
 * (`legacyQueryRoute`).
 *
 * Formulár ostáva v `../page.tsx` — zdieľa s detailom načítanie dokumentu,
 * práva aj akcie, a druhá kópia by sa rozišla. Táto stránka ho len zapne.
 */
import DocumentPage from "../page"
import type { RawQuery } from "@/lib/urlParams"

export default async function EditDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<RawQuery>
}) {
  return DocumentPage({ params, searchParams: Promise.resolve({ ...(await searchParams), edit: "document" }) })
}
