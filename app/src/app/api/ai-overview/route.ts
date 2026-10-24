/**
 * GET /api/ai-overview?format=xlsx&from=&to=&by= — Prehľad spotreby AI ako
 * matica do Excelu (návrh ORG-ai-prehlad, 24. 10. 2026).
 *
 * **To isté obdobie a pohľad ako obrazovka** (`usageFilterFromQuery`,
 * `overviewGroup`). Jednotlivé volania dáva export Spotreby (`/api/ai-usage`).
 */

import { orgContext } from "@/lib/orgSettings"
import { usageFilterFromQuery } from "@/lib/aiUsage"
import { overviewAoa, overviewGroup, usageOverview } from "@/lib/aiOverview"
import { AI_MODELS } from "@/lib/aiSettings"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  // Prístup ako pri Spotrebe — adresa sa dá napísať aj mimo stránky.
  const ctx = await orgContext()
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }

  const url = new URL(request.url)
  const q = Object.fromEntries(url.searchParams) as Record<string, string>
  const filter = usageFilterFromQuery({ from: q.from, to: q.to })
  const by = overviewGroup(q.by)
  const overview = await usageOverview(ctx.tenant.companyCode, filter, by)
  const tu = dictionary(ctx.person.language).org.aiUsage
  const modelName = (id: string) => Object.values(AI_MODELS).flat().find(m => m.id === id)?.label ?? id
  const aoa = overviewAoa(overview, it => by === "purposes"
    ? tu.purposes[it.key as keyof typeof tu.purposes]?.label ?? it.key
    : by === "models" ? modelName(it.key) : it.name)

  const XLSX = await import("xlsx")
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), tu.tabOverview)
  const data = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="prehlad-ai-${by}-${filter.fromText}-${filter.toText}.xlsx"`,
    },
  })
}
