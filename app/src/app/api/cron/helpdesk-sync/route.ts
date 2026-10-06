/**
 * route.ts → /api/cron/helpdesk-sync
 *
 * Synchronizácia schránok kanálov helpdesku (ADR-028, D162): každý kanál so
 * schránkou dostane jedno kolo `syncChannel()` — nové správy sa stanú
 * ticketmi (D163), značka sa uloží na kanáli. Chyba jedného kanála nezastaví
 * ostatné; zapíše sa na kanál (`lastSyncError`) a do logu.
 *
 * Rovnaká brzda ako `/api/cron/overdue`: hlavička `Authorization: Bearer
 * CRON_SECRET`, inak 401. Cesta `/api/cron/` je verejná a bez kontroly
 * hostiteľa (`publicRoutes.ts`) — organizácia je na kanáli, nie v adrese.
 *
 * Rozvrh je v `vercel.json`. Tlačidlo „Synchronizovať teraz" v nastavení
 * kanála volá to isté bez čakania na rozvrh.
 */

import { NextResponse } from "next/server"
import { channelsWithMailbox, syncChannel, type SyncReport } from "@/lib/helpdeskChannels"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const reports: (SyncReport & { companyCode: string })[] = []
  for (const channel of await channelsWithMailbox()) {
    try {
      const r = await syncChannel(channel.companyCode, channel.key)
      reports.push({ companyCode: channel.companyCode, ...r })
    } catch (e) {
      console.error(`[cron] helpdesk-sync ${channel.companyCode}/${channel.key} zlyhal:`, e)
      reports.push({ companyCode: channel.companyCode, key: channel.key, pages: 0, created: 0, appended: 0, skipped: 0, beforeStart: 0, done: false, error: "failed" })
    }
  }
  return NextResponse.json({ ok: true, channels: reports })
}
