/**
 * POST /api/widget/[channel]/ticket — eskalácia z chatu do ticketu (ADR-028, D163, D166).
 *
 * Človek napíše, čo potrebuje; k tomu ide priebeh rozhovoru (odkazy na
 * záznamy odpovedí, otázky a hodnotenia). E-mail, meno, roly a klub sú
 * z tokenu — človek nič nevypisuje. Ticket pristane vo fronte riešiteľov
 * kanála (`/helpdesk`).
 */

import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { widgetGate, corsHeaders } from "@/lib/widgetApi"
import { createChatTicket } from "@/lib/tickets"
import { getCollection } from "@/lib/mongodb"
import { RATINGS_COLLECTION, type RatingRecord } from "@/lib/ratings"
import { AppError } from "@/lib/appError"
import { errorText } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  const gate = await widgetGate(req, channel, "preflight")
  if (gate instanceof Response && gate.status !== 401) return gate
  return new Response(null, { status: 204, headers: corsHeaders((req.headers.get("origin") ?? "").replace(/\/+$/, "")) })
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  let body: { token?: string; message?: string; conversation?: { recordId?: string | null; question?: string; verdict?: unknown }[] }
  try { body = await req.json() } catch { return new Response("invalid-json", { status: 400 }) }
  const gate = await widgetGate(req, key, body.token ?? null)
  if (gate instanceof Response) return gate
  const cors = corsHeaders(gate.origin)
  const message = String(body.message ?? "").trim().slice(0, 4000)
  if (!message) return NextResponse.json({ error: "ticket.emptyQuestion" }, { status: 400, headers: cors })

  // Len vlastné záznamy (D32) — cudzí identifikátor sa ticho vynechá.
  const wanted = (body.conversation ?? []).slice(0, 20)
  const ids = wanted.map(c => c.recordId).filter((x): x is string => typeof x === "string" && ObjectId.isValid(x))
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const own = ids.length
    ? new Set((await col.find({ _id: { $in: ids.map(x => new ObjectId(x)) }, companyCode: gate.tenant.companyCode, askedBy: gate.person.id } as never, { projection: { _id: 1 } }).toArray()).map(r => String(r._id)))
    : new Set<string>()
  const conversation = wanted
    .filter(c => !c.recordId || own.has(String(c.recordId)))
    .map(c => ({ recordId: c.recordId && own.has(String(c.recordId)) ? String(c.recordId) : "", question: String(c.question ?? "").slice(0, 500), verdict: (c.verdict === 0 ? 0 : c.verdict === 1 ? 1 : null) as 0 | 1 | null }))
    .filter(c => c.question)

  try {
    const id = await createChatTicket(gate.tenant.companyCode, {
      channelKey: gate.channel.key,
      asker: { personId: gate.person.id, email: gate.identity.email, name: gate.identity.name || gate.person.fullName, roles: gate.identity.roles, club: gate.identity.club },
      message,
      conversation,
    })
    return NextResponse.json({ ok: true, id }, { headers: cors })
  } catch (e) {
    const code = e instanceof AppError ? e.code : "failed"
    return NextResponse.json({ error: code, message: errorText(e, gate.language) }, { status: 400, headers: cors })
  }
}
