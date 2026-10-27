/**
 * GET /channels/[key]/preview/token — nový token pre náhľad widgetu
 * (ADR-042, Dodatok 1, D284). To isté, čo u cudzieho systému robí
 * `data-token-url`: widget sa sem obráti, keď token po 15 minútach vyprší.
 *
 * Len správca organizácie; čistý text, `no-store`.
 */

import { orgContext } from "@/lib/orgSettings"
import { channelByKey } from "@/lib/channels"
import { previewToken } from "@/lib/widgetPreview"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await orgContext()
  if (ctx.state !== "ready") return new Response(null, { status: 401 })
  const { key } = await params
  const channel = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!channel || channel.kind !== "widget") return new Response(null, { status: 404 })
  const result = previewToken(channel, ctx.person)
  if (!("token" in result)) return new Response(null, { status: 409 })
  return new Response(result.token, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
}
