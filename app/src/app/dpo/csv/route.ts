/**
 * GET /dpo/csv — výkaz právnych základov ako CSV (ADR-012, D104).
 *
 * Ten istý zoznam ako na `/dpo`, nie druhý dotaz s podobnými podmienkami.
 */

import { dpoContext } from "@/lib/dpo"
import { legalBasisRows } from "@/lib/dpoDb"
import { toCsv } from "@/lib/csv"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function GET() {
  const ctx = await dpoContext()
  // Prístup sa overuje aj tu — adresa exportu sa dá napísať.
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }
  const t = dictionary(ctx.person.language).dpo
  const rows = await legalBasisRows(ctx.person.companyCode)
  const csv = toCsv(rows, [
    { label: "documentId", value: r => r.documentId },
    { label: "title", value: r => r.title },
    { label: "versionId", value: r => r.versionId },
    { label: "versionLabel", value: r => r.versionLabel },
    { label: "effectiveFrom", value: r => (r.effectiveFrom ? r.effectiveFrom.toISOString().slice(0, 10) : "") },
    { label: "legalBasis", value: r => r.legalBasis ?? "" },
    { label: "basisLabel", value: r => r.basisLabel ?? "" },
    { label: "reference", value: r => r.reference ?? "" },
    { label: "responsibleName", value: r => r.responsible?.fullName ?? "" },
    { label: "responsibleEmail", value: r => r.responsible?.email ?? "" },
    { label: "problems", value: r => r.problems.map(p => t.problems[p]).join("; ") },
  ])
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pravne-zaklady-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
