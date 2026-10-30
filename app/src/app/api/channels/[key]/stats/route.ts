/**
 * GET /api/channels/[key]/stats?period=&at= — štatistika kanála do Excelu
 * pre board (KANAL-statistika, Q5). To isté obdobie ako obrazovka
 * a 12 predchádzajúcich; prístup a cena rovnako ako na obrazovke (Q3).
 */

import { channelsContext } from "@/lib/helpdeskAgents"
import { loadChannelStats, statPeriod, statRange } from "@/lib/channelStats"
import { rangeHistory } from "@/lib/channelStatsView"
import { channelStatsSheets, EXPORT_HISTORY } from "@/lib/channelStatsExport"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  // Adresa sa dá napísať aj mimo stránky — brána ako na obrazovke.
  const ctx = await channelsContext()
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  }
  const key = decodeURIComponent((await params).key)
  const channel = ctx.visible.find(c => c.key === key)
  if (!channel || channel.kind !== "widget") return new Response(null, { status: 404 })

  const url = new URL(request.url)
  const range = statRange(statPeriod(url.searchParams.get("period") ?? undefined), url.searchParams.get("at") ?? undefined)
  const ranges = rangeHistory(range, EXPORT_HISTORY)
  const withCost = ctx.isAdmin
  const data = await loadChannelStats(ctx.tenant.companyCode, key, ranges[0].start, range.end, { withCost })
  const sheets = channelStatsSheets(data, ranges, { withCost, language: ctx.person.language })

  const XLSX = await import("xlsx")
  const book = XLSX.utils.book_new()
  for (const [name, aoa] of sheets) XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), name.slice(0, 31))
  const out = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="statistika-${encodeURIComponent(key)}-${range.period}-${range.at}.xlsx"`,
    },
  })
}
