/**
 * route.ts → /api/cron/helpdesk-harvest
 *
 * Pokračovanie ťažby FAQ z histórie schránky (ADR-030, D183–D185). Správca
 * ju spustí na stránke analýzy kanála; mesiace triedenia, zlúčenie tém
 * a návrhy za tému dopĺňa tento cron po kúskoch, kým beh nie je hotový.
 * Rozpočet a tvrdá hranica ako pri `/api/cron/helpdesk-history`.
 *
 * Brzda: hlavička `Authorization: Bearer CRON_SECRET`, inak 401.
 */

import { NextResponse } from "next/server"
import { harvestsInProgress, continueHarvest } from "@/lib/faqHarvest"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const BUDGET_MS = 200_000
const HARD_MS = 260_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const running = await harvestsInProgress()
  const reports: { companyCode: string; channelKey: string; steps: number }[] = []
  const began = Date.now()
  const share = running.length ? Math.floor(BUDGET_MS / running.length) : 0
  for (const h of running) {
    const left = HARD_MS - (Date.now() - began)
    if (left < 30_000) break
    const steps = await continueHarvest(h.companyCode, h.channelKey, { budgetMs: Math.min(share, left - 60_000), hardMs: left })
    reports.push({ ...h, steps })
  }
  return NextResponse.json({ ok: true, harvests: reports })
}
