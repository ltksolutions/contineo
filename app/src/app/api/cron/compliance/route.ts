/**
 * route.ts → /api/cron/compliance
 *
 * Pokračovanie kontroly súladu proti dokumentom knižnice (ADR-032). Kurátor
 * ju spustí vo fronte návrhov FAQ; dávky dopĺňa tento cron, kým beh nie je
 * hotový. Rozpočet a tvrdá hranica ako pri ťažbe FAQ (ADR-030).
 *
 * Brzda: hlavička `Authorization: Bearer CRON_SECRET`, inak 401.
 */

import { NextResponse } from "next/server"
import { reviewsInProgress, continueReview } from "@/lib/complianceCheck"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BUDGET_MS = 200_000
const HARD_MS = 260_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const running = await reviewsInProgress()
  const reports: { companyCode: string; scopeKey: string; batches: number }[] = []
  const began = Date.now()
  const share = running.length ? Math.floor(BUDGET_MS / running.length) : 0
  for (const r of running) {
    const left = HARD_MS - (Date.now() - began)
    if (left < 30_000) break
    const batches = await continueReview(r.companyCode, r.scopeKey, { budgetMs: Math.min(share, left - 60_000), hardMs: left })
    reports.push({ ...r, batches })
  }
  return NextResponse.json({ ok: true, reviews: reports })
}
