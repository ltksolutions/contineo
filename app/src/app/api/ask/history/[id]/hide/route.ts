/**
 * POST /api/ask/history/{id}/hide — × v plachte otázky: skryje vlastnú otázku z histórie (H2 — nie výmaz).
 */

import { NextRequest, NextResponse } from "next/server"
import { hideQuestion } from "@/lib/askHistory"
import { historyCaller } from "@/lib/askHistoryApi"
import { sameOrigin } from "@/lib/sameOrigin"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req.headers)) return new Response(null, { status: 403 })
  const who = await historyCaller()
  if ("error" in who) return who.error
  const { id } = await params
  const ok = await hideQuestion(who.companyCode, who.personId, id)
  return ok ? NextResponse.json({ ok: true }) : new Response(null, { status: 404 })
}
