/**
 * route.ts → /api/cron/helpdesk-history
 *
 * Pokračovanie analýzy histórie schránky (ADR-030, D180). Správca ju spustí
 * v nastavení kanála a prvé mesiace spracuje akcia; zvyšok dopĺňa tento
 * cron po mesiacoch, kým `pending` nie je prázdne. Mesiac sa po spracovaní
 * hneď uloží, takže časový limit funkcie neprerobí nič, čo je hotové.
 *
 * Rovnaká brzda ako `/api/cron/helpdesk-sync`: hlavička `Authorization:
 * Bearer CRON_SECRET`, inak 401. Spúšťač: Vercel cron každých 5 minút.
 */

import { NextResponse } from "next/server"
import { analysesInProgress, continueAnalysis } from "@/lib/historyAnalysis"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Rezerva pod `maxDuration` na posledné volanie Graphu a zápis. */
const BUDGET_MS = 35_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const running = await analysesInProgress()
  const reports: { companyCode: string; channelKey: string; months: number }[] = []
  // Čas sa delí medzi rozbehnuté analýzy; zvyčajne je jedna.
  const budget = running.length ? Math.max(5_000, Math.floor(BUDGET_MS / running.length)) : 0
  for (const a of running) {
    const months = await continueAnalysis(a.companyCode, a.channelKey, budget)
    reports.push({ ...a, months })
  }
  return NextResponse.json({ ok: true, analyses: reports })
}
