/**
 * Prečítanie z otvoreného vlákna (ADR-033, D210): keď správa príde živým
 * spojením a človek ju má pred sebou, klient to ohlási a vlákno vypadne
 * z neprečítaných — ako keby ho otvoril. Pôvod sa kontroluje (zápis).
 */

import type { NextRequest } from "next/server"
import { onboardingContext } from "@/lib/session"
import { sameOrigin } from "@/lib/sameOrigin"
import { markThreadRead } from "@/lib/courier"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return new Response(null, { status: 403 })
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") return new Response(null, { status: 401 })
  const body = await req.json().catch(() => null) as { thread?: unknown } | null
  const thread = typeof body?.thread === "string" ? body.thread : ""
  if (!thread) return new Response(null, { status: 400 })
  await markThreadRead(ctx.person.companyCode, thread, ctx.person.id)
  return new Response(null, { status: 204 })
}
