/**
 * route.ts → /api/cron/compliance
 *
 * Kúsok kontroly súladu proti dokumentom knižnice (ADR-032). Volá ho spustenie
 * kontroly, predošlý kúsok (reťaz, `lib/backgroundKick.ts`) a cron ako
 * poistka. Odpovedá hneď 202, prácu robí v `after()`; keď ostane čo robiť,
 * zavolá sám seba. Rozpočet a tvrdá hranica ako pri ťažbe FAQ (ADR-030).
 *
 * Brzda: hlavička `Authorization: Bearer CRON_SECRET`, inak 401.
 */

import { NextResponse, after } from "next/server"
import { reviewsInProgress, continueReview } from "@/lib/complianceCheck"
import { kick } from "@/lib/backgroundKick"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const PATH = "/api/cron/compliance"
const BUDGET_MS = 200_000
const HARD_MS = 260_000

async function work(): Promise<boolean> {
  const running = await reviewsInProgress()
  const began = Date.now()
  const share = running.length ? Math.floor(BUDGET_MS / running.length) : 0
  let progressed = false
  for (const r of running) {
    const left = HARD_MS - (Date.now() - began)
    if (left < 30_000) break
    const batches = await continueReview(r.companyCode, r.scopeKey, { budgetMs: Math.min(share, left - 60_000), hardMs: left })
    console.log(`[compliance] ${r.companyCode}/${r.scopeKey}: ${batches} kúskov`)
    if (batches > 0) progressed = true
  }
  // Reťaz pokračuje, len keď tento kúsok niečo urobil a ešte je čo robiť.
  // Kúsok, ktorý narazil na zámok iného, nevolá ďalej — ten druhý zavolá sám.
  return progressed && (await reviewsInProgress()).length > 0
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const origin = new URL(request.url).origin
  after(async () => {
    try {
      if (await work()) await kick(origin, PATH)
    } catch (e) {
      console.error("[compliance] kúsok zlyhal:", e)
    }
  })
  return NextResponse.json({ ok: true }, { status: 202 })
}
