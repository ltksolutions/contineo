/**
 * POST /api/widget/[channel]/feedback — palec hore/dole z widgetu (ADR-028, D166).
 *
 * Zapíše `readerVerdict` k záznamu odpovede — len k vlastnému (`askedBy`
 * je osoba z tokenu; podmienka v dotaze, D32). Dve negatívne v rozhovore
 * sú na strane widgetu dôvod ponúknuť ticket.
 */

import { NextResponse } from "next/server"
import { widgetGate, corsHeaders } from "@/lib/widgetApi"
import { getCollection } from "@/lib/mongodb"
import { RATINGS_COLLECTION, saveReaderFeedback, type RatingRecord } from "@/lib/ratings"
import { ObjectId } from "mongodb"

export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  const gate = await widgetGate(req, channel, "preflight")
  if (gate instanceof Response && gate.status !== 401) return gate
  return new Response(null, { status: 204, headers: corsHeaders((req.headers.get("origin") ?? "").replace(/\/+$/, "")) })
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  let body: { token?: string; id?: string; verdict?: unknown }
  try { body = await req.json() } catch { return new Response("invalid-json", { status: 400 }) }
  const gate = await widgetGate(req, key, body.token ?? null)
  if (gate instanceof Response) return gate
  const cors = corsHeaders(gate.origin)
  const id = String(body.id ?? "")
  const verdict = body.verdict === 1 ? 1 : body.verdict === 0 ? 0 : null
  if (!ObjectId.isValid(id) || verdict === null) return NextResponse.json({ error: "invalid" }, { status: 400, headers: cors })
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const own = await col.countDocuments({ _id: new ObjectId(id), companyCode: gate.tenant.companyCode, askedBy: gate.person.id } as never, { limit: 1 })
  if (!own) return NextResponse.json({ error: "not-found" }, { status: 404, headers: cors })
  const ok = await saveReaderFeedback(id, { verdict }, gate.person.id, gate.tenant.companyCode)
  return NextResponse.json({ ok }, { headers: cors })
}
