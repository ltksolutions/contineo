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
import { widgetGate, widgetPreflight, corsHeaders, questionsLastHour, recordingTransform, widgetLanguage } from "@/lib/widgetApi"
import { chatStream } from "@/lib/chatStream"
import { parseHistory } from "@/lib/conversationContext"
import { connectorCallbackUrl } from "@/lib/mcp/callbackUrl"
import { widgetSources, pickWidgetSources, searchedScopeOf } from "@/lib/widgetSources"
import { answerKicker, answerFrom } from "@/lib/answerKicker"
import { brandingView } from "@/lib/tenants"
import { dictionary } from "@/lib/i18n"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function OPTIONS(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  return widgetPreflight(req, channel)
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  let body: { token?: string; query?: string; language?: string; sources?: unknown; history?: unknown }
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

  /*
   * Výber zdrojov z widgetu (KANAL-widget-zdroje): len podmnožina povolených,
   * prázdny alebo neznámy = všetky povolené (Q3; starý skript nič neposiela).
   * Hlavička odpovede sa skladá tu — skloňovanie a jazyk sú v i18n servera,
   * nie v skripte widgetu.
   */
  // Jazyk z výberu vo widgete (D290), len jazyk kanála.
  const language = widgetLanguage(gate, body.language)
  const allowed = await widgetSources(gate.tenant.companyCode, gate.channel, language, dictionary(language).widget.scopeLibrary)
  const picked = pickWidgetSources(body.sources, allowed)
  const searchedScope = searchedScopeOf(picked)
  const branding = brandingView(gate.tenant)
  const org = branding.shortName?.trim() || branding.displayName
  const scopeEvent = {
    type: "scope", ids: picked.map(s => s.id),
    kicker: answerKicker(searchedScope, org, language), from: answerFrom(searchedScope, org, language),
  }

  const stream = chatStream({
    companyCode: gate.tenant.companyCode,
    query,
    language,
    accessLevel: "public",
    usageActor: { companyCode: gate.tenant.companyCode, personId: gate.person.id, personName: gate.person.fullName, email: gate.person.email, channelKey: gate.channel.key },
    // Rozsahy živých zdrojov kanála (ADR-029, D175); úroveň `public` pustí len verejné konektory.
    narrow: { folderIds: gate.channel.folderIds, connectorScopes: gate.channel.connectorScopes ?? [] },
    only: picked.map(s => s.id),
    channelKey: gate.channel.key,
    // Predchádzajúce kolá z toho istého okna widgetu; starý skript ich neposiela.
    history: parseHistory(body.history),
    callbackUrl: await connectorCallbackUrl(),
  }).pipeThrough(recordingTransform({ question: query, personId: gate.person.id, companyCode: gate.tenant.companyCode, startedAt: Date.now(), searchedScope, channelName: gate.channel.name, scopeEvent }))

  return new Response(stream, {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  })
}
