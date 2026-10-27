/**
 * POST /api/widget/[channel]/history — história otázok vo widgete
 * (ADR-042, Dodatok 2, D288), ako v plachte otázky v Contineu.
 *
 * Jedna adresa, tri úkony podľa `action` (všetky s tokenom — osoba je
 * z tokenu, nikdy z požiadavky, D32):
 *
 *  - `list` (predvolené) — posledných 5 rôznych otázok, pri `q` zúžených;
 *  - `open` — uložená odpoveď `id` (otázka, text, zdroje);
 *  - `hide` — × skryje otázku `id` z histórie (nie výmaz, H2).
 *
 * Len verejné záznamy osoby (`widgetAskerFilter`).
 */

import { NextResponse } from "next/server"
import { widgetGate, widgetPreflight, corsHeaders } from "@/lib/widgetApi"
import { widgetRecentQuestions, widgetAnswer, widgetHideQuestion } from "@/lib/askHistory"

export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  return widgetPreflight(req, channel)
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel: key } = await params
  let body: { token?: string; action?: string; id?: string; q?: string }
  try { body = await req.json() } catch { return new Response("invalid-json", { status: 400 }) }
  const gate = await widgetGate(req, key, body.token ?? null)
  if (gate instanceof Response) return gate
  const headers = { ...corsHeaders(gate.origin), "Cache-Control": "no-store" }
  const companyCode = gate.tenant.companyCode
  const personId = gate.person.id
  const id = String(body.id ?? "")

  if (body.action === "open") {
    const r = await widgetAnswer(companyCode, personId, id)
    if (!r) return NextResponse.json({ error: "not-found" }, { status: 404, headers })
    const sources = (r.sources ?? []).map(s => ({ title: s.title, articleRef: s.articleRef }))
    return NextResponse.json({ id, question: r.question, answer: r.answer, sources, createdAt: r.createdAt }, { headers })
  }
  if (body.action === "hide") {
    const ok = await widgetHideQuestion(companyCode, personId, id)
    return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers })
  }
  const q = String(body.q ?? "").slice(0, 200)
  const items = (await widgetRecentQuestions(companyCode, personId, q)).map(i => ({ id: i.id, question: i.question, createdAt: i.createdAt }))
  return NextResponse.json({ items }, { headers })
}
