/**
 * GET /api/ai-usage?format=csv|xlsx&from=&to=&person=&purpose= — export
 * spotreby AI (ADR-026, D158).
 *
 * **Tie isté filtre ako obrazovka** (`usageFilterFromQuery`) — výkaz, ktorý
 * sa nezhoduje s tým, čo človek videl, je horší než žiadny. Obrazovka
 * ukazuje najnovších 500 riadkov, export **celé obdobie**.
 */

import { orgContext } from "@/lib/orgSettings"
import { usageRows, usageFilterFromQuery } from "@/lib/aiUsage"
import { usageAoa, usageExportColumns } from "@/lib/aiUsageExport"
import { toCsv } from "@/lib/csv"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  // Prístup sa overuje aj tu — odkaz visí na chránenej stránke, ale adresa
  // sa dá napísať. Spotrebu vidí len správca organizácie, ako nastavenie AI.
  const ctx = await orgContext()
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }

  const url = new URL(request.url)
  const q = Object.fromEntries(url.searchParams) as Record<string, string>
  const filter = usageFilterFromQuery(q)
  const rows = await usageRows(ctx.tenant.companyCode, filter)
  const language = ctx.person.language
  const name = `spotreba-ai-${filter.fromText}-${filter.toText}`

  if (q.format === "xlsx") {
    const XLSX = await import("xlsx")
    const sheet = XLSX.utils.aoa_to_sheet(usageAoa(rows, language), { cellDates: true })
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "Spotreba")
    const data = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      },
    })
  }

  // CSV: čas ako ISO, inak by sa miestny formát v Exceli a v skripte čítal inak.
  const columns = usageExportColumns(language).map(c => ({
    label: c.label,
    value: (r: (typeof rows)[number]) => {
      const v = c.value(r)
      return v instanceof Date ? v.toISOString() : v
    },
  }))
  return new Response(toCsv(rows, columns), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}.csv"`,
    },
  })
}
