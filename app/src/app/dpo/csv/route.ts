/**
 * GET /dpo/csv — výkaz právnych základov ako CSV (ADR-012, D104).
 *
 * Ten istý zoznam ako na `/dpo`, nie druhý dotaz s podobnými podmienkami.
 */

import { dpoContext } from "@/lib/dpo"
import { legalBasisRows } from "@/lib/dpoDb"
import { legalBasisCsv } from "@/lib/dpoCsv"

export const dynamic = "force-dynamic"

export async function GET() {
  const ctx = await dpoContext()
  // Prístup sa overuje aj tu — adresa exportu sa dá napísať.
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }
  const rows = await legalBasisRows(ctx.person.companyCode)
  const csv = legalBasisCsv(rows, ctx.person.language)
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pravne-zaklady-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
