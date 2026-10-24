/**
 * GET /api/ask/sources — živé zdroje a skratka organizácie pre plachtu otázky
 * v hlavičke (ASK-zdroje-v-plachte). Plachta ich načíta pri otvorení, aby
 * layout nemusel pýtať konektory na každej stránke. Vložená plachta na `/ask`
 * ich dostane priamo zo servera.
 */

import { NextResponse } from "next/server"
import { onboardingContext } from "@/lib/session"
import { brandingView } from "@/lib/tenants"
import { askLiveSources } from "@/lib/askSources"

export const dynamic = "force-dynamic"

export async function GET() {
  const ctx = await onboardingContext()
  if (ctx.state !== "ready") return new Response(null, { status: 401 })
  const branding = brandingView(ctx.tenant)
  return NextResponse.json(
    { live: await askLiveSources(ctx), organisation: branding.shortName?.trim() || branding.displayName },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
