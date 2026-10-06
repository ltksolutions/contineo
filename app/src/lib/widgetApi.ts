/**
 * widgetApi.ts — brána a spoločné kusy pre `/api/widget/*` (ADR-028, D166).
 *
 * Widget beží na cudzej doméne (issf.futbalsfz.sk) a volá doménu organizácie.
 * Preto tu je to, čo bežné route nepotrebujú:
 *
 *   • **pôvod**: `Origin` musí byť medzi povolenými pôvodmi kanála, inak 403
 *     ešte pred čítaním tela; odpoveď nesie CORS hlavičky len pre ten pôvod;
 *   • **token** namiesto prihlásenia (`verifyWidgetToken`) a z neho osoba
 *     (`ensureWidgetPerson`);
 *   • **strop** požiadaviek na osobu a hodinu — počíta sa zo záznamov
 *     odpovedí (`evaluations`), bez ďalšej kolekcie;
 *   • **zápis odpovede**: prehliadač v intranete po streame volá
 *     `/api/rating`; widget to nerobí — stream sa tu prepustí cez
 *     transformáciu, ktorá odpoveď zapíše sama a pridá udalosť `recorded`.
 */

import { NextResponse } from "next/server"
import { getCollection } from "./mongodb"
import { currentTenant } from "./session"
import { channelByKey, widgetSecret, type HelpdeskChannel } from "./channels"
import { verifyWidgetToken, type WidgetIdentity } from "./widgetToken"
import { ensureWidgetPerson } from "./widgetPersons"
import { recordAnswer, RATINGS_COLLECTION, type RatingRecord } from "./ratings"
import { AppError } from "./appError"
import { errorText, type UiLanguage } from "./i18n"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export class WidgetError extends AppError {}

/** Pôvod požiadavky bez koncovej lomky; `null`, keď hlavička chýba. */
export function requestOrigin(headers: Headers): string | null {
  const o = headers.get("origin")
  return o ? o.replace(/\/+$/, "") : null
}

export function originAllowed(channel: Pick<HelpdeskChannel, "widget">, origin: string | null): boolean {
  if (!origin) return false
  return channel.widget.origins.some(o => o.replace(/\/+$/, "") === origin)
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  }
}

export interface WidgetGate {
  tenant: Tenant
  channel: HelpdeskChannel
  identity: WidgetIdentity
  person: Person
  origin: string
  language: UiLanguage
}

/**
 * Overí pôvod, kanál, token a nájde osobu. Vracia buď bránu, alebo hotovú
 * odpoveď s chybou (už s CORS hlavičkami, keď pôvod prešiel).
 */
export async function widgetGate(req: Request, channelKey: string, token: string | null): Promise<WidgetGate | Response> {
  const tenant = await currentTenant().catch(() => null)
  if (!tenant) return new Response(null, { status: 404 })
  const channel = await channelByKey(tenant.companyCode, channelKey)
  // Portál widget nemá (D169) — pre API je to, ako keby kanál neexistoval.
  if (!channel || channel.kind !== "widget") return new Response(null, { status: 404 })
  const origin = requestOrigin(req.headers)
  if (!originAllowed(channel, origin)) return new Response(null, { status: 403 })
  const cors = corsHeaders(origin!)
  const language = channel.languages[0] ?? tenant.defaultLanguage
  const secret = widgetSecret(channel)
  if (!secret) return NextResponse.json({ error: "widget.noSecret" }, { status: 503, headers: cors })
  if (!token) return NextResponse.json({ error: "widget.tokenShape" }, { status: 401, headers: cors })
  let identity: WidgetIdentity
  try {
    identity = verifyWidgetToken(token, { key: channel.key, secret, origins: channel.widget.origins })
  } catch (e) {
    const code = e instanceof AppError ? e.code : "widget.tokenShape"
    return NextResponse.json({ error: code, message: errorText(e, language) }, { status: 401, headers: cors })
  }
  const person = await ensureWidgetPerson(tenant.companyCode, channel.key, identity, language)
  return { tenant, channel, identity, person, origin: origin!, language: identity.language ?? person.language ?? language }
}

/** Koľko otázok osoba položila za poslednú hodinu — proti stropu kanála (D14). */
export async function questionsLastHour(companyCode: string, personId: string): Promise<number> {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  return col.countDocuments({ companyCode, askedBy: personId, createdAt: { $gt: new Date(Date.now() - 3600_000) } } as never)
}

/**
 * Prepustí SSE stream a po udalosti `done` zapíše odpoveď (`recordAnswer`),
 * potom pošle `{type:"recorded", id}`. Odpoveď bez textu a zdrojov sa
 * nezapisuje — nie je čo hodnotiť; widget vtedy ponúkne helpdesk rovno.
 */
export function recordingTransform(input: {
  question: string
  personId: string
  companyCode: string
  startedAt: number
}): TransformStream<Uint8Array, Uint8Array> {
  const dec = new TextDecoder()
  const enc = new TextEncoder()
  let text = ""
  let buffer = ""
  const citations: unknown[] = []
  let firstTokenAt: number | null = null
  const handle = async (raw: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    let ev: Record<string, unknown>
    try { ev = JSON.parse(raw) } catch { return }
    if (ev.type === "token") { text += String(ev.token ?? ""); firstTokenAt ??= Date.now() }
    else if (ev.type === "citation") citations.push(ev.citation)
    else if (ev.type === "done") {
      const sources = Array.isArray(ev.sources) ? ev.sources : []
      if (!text.trim() || !sources.length) return
      try {
        const id = await recordAnswer({
          question: input.question, answer: text, sources: sources as never, citations: citations as never,
          model: String(ev.model ?? ""), provider: String(ev.provider ?? ""), verifiedCitations: Boolean(ev.verifiedCitations),
          ttftMs: firstTokenAt ? firstTokenAt - input.startedAt : null, totalMs: Date.now() - input.startedAt,
          timings: ev.timings as never, tokens: ev.tokens as never, cost: ev.cost as never, time: ev.time as never,
        }, input.personId, input.companyCode, "public")
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "recorded", id })}\n\n`))
      } catch (e) {
        console.error("[widget] zápis odpovede zlyhal:", e)
      }
    }
  }
  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      controller.enqueue(chunk)
      buffer += dec.decode(chunk, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() ?? ""
      for (const part of parts) {
        const line = part.split("\n").find(l => l.startsWith("data: "))
        if (line) await handle(line.slice(6), controller)
      }
    },
  })
}
