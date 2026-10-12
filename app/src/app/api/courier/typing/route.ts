/**
 * „Píše…" (ADR-033, D210): klient pošle, kým človek píše; server zapíše
 * `typingAt` na účastníka a živé spojenie to roznesie. Platí 5 s, nič sa
 * nemaže. Zápis = kontrola pôvodu (CSRF, `lib/sameOrigin.ts`).
 */

import type { NextRequest } from "next/server"
import { onboardingContext } from "@/lib/session"
import { sameOrigin } from "@/lib/sameOrigin"
import { setTyping } from "@/lib/courier"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return new Response(null, { status: 403 })
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") return new Response(null, { status: 401 })
  const body = await req.json().catch(() => null) as { thread?: unknown } | null
  const thread = typeof body?.thread === "string" ? body.thread : ""
  if (!thread) return new Response(null, { status: 400 })
  await setTyping(ctx.person.companyCode, thread, ctx.person.id)
  return new Response(null, { status: 204 })
}
