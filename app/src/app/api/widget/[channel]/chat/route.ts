/**
 * POST /api/widget/[channel]/chat — otázka z widgetu (ADR-028, D166).
 *
 * Brána: pôvod, kanál, token, osoba (`widgetGate`). Potom strop otázok na
 * osobu a hodinu (D14) a ten istý postup ako `/api/chat` (`chatStream`) —
 * s úrovňou **public** a rozsahom kanála (priečinky, D161). Stream ide cez
 * transformáciu, ktorá odpoveď zapíše do `evaluations` a pošle `recorded`,
 * aby mal widget na čo hodnotiť a ticket na čo odkazovať.
 */

import { NextResponse } from "next/server"
import { widgetGate, corsHeaders, questionsLastHour, recordingTransform } from "@/lib/widgetApi"
import { chatStream } from "@/lib/chatStream"
import { connectorCallbackUrl } from "@/lib/mcp/callbackUrl"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function OPTIONS(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  const gate = await widgetGate(req, channel, "preflight")
  // Preflight nemá token — stačí, že pôvod je povolený (gate vráti 401 až za pôvodom).
  if (gate instanceof Response && gate.status !== 401) return gate
  const origin = req.headers.get("origin") ?? ""
  return new Response(null, { status: 204, headers: corsHeaders(origin.replace(/\/+$/, "")) })
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  let body: { token?: string; query?: string; language?: string }
  try { body = await req.json() } catch { return new Response("invalid-json", { status: 400 }) }
  const gate = await widgetGate(req, key, body.token ?? null)
  if (gate instanceof Response) return gate
  const cors = corsHeaders(gate.origin)
  const query = (body.query ?? "").trim()
  if (!query || query.length > 1000) return NextResponse.json({ error: "invalid-query" }, { status: 400, headers: cors })

  const asked = await questionsLastHour(gate.tenant.companyCode, gate.person.id)
  if (asked >= gate.channel.widget.rateLimitPerHour) {
    return NextResponse.json({ error: "widget.rateLimited" }, { status: 429, headers: cors })
  }

  const stream = chatStream({
    companyCode: gate.tenant.companyCode,
    query,
    language: body.language ?? gate.language,
    accessLevel: "public",
    usageActor: { companyCode: gate.tenant.companyCode, personId: gate.person.id, personName: gate.person.fullName, email: gate.person.email },
    // Rozsahy živých zdrojov kanála (ADR-029, D175); úroveň `public` pustí len verejné konektory.
    narrow: { folderIds: gate.channel.folderIds, connectorScopes: gate.channel.connectorScopes ?? [] },
    channelKey: gate.channel.key,
    callbackUrl: await connectorCallbackUrl(),
  }).pipeThrough(recordingTransform({ question: query, personId: gate.person.id, companyCode: gate.tenant.companyCode, startedAt: Date.now() }))

  return new Response(stream, {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  })
}
