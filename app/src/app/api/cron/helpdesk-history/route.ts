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
// Plán Pro dovolí 300 s. Pri 60 s sa za kolo stihol jeden mesiac (~40 s)
// a väčší mesiac by sa nestihol vôbec (8. 10. 2026).
export const maxDuration = 300

/** Nový mesiac sa začne do 200 s; rozčítaný sa preruší najneskôr v 260 s. */
const BUDGET_MS = 200_000
const HARD_MS = 260_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const running = await analysesInProgress()
  const reports: { companyCode: string; channelKey: string; months: number }[] = []
  // Čas sa delí medzi rozbehnuté analýzy; zvyčajne je jedna.
  const began = Date.now()
  const share = running.length ? Math.floor(BUDGET_MS / running.length) : 0
  for (const a of running) {
    const left = HARD_MS - (Date.now() - began)
    if (left < 30_000) break
    const months = await continueAnalysis(a.companyCode, a.channelKey, { budgetMs: Math.min(share, left - 60_000), hardMs: left })
    reports.push({ ...a, months })
  }
  return NextResponse.json({ ok: true, analyses: reports })
}
