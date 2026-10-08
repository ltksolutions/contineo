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
 * Spúšťač: GitHub Actions každých 5 minút (`.github/workflows/helpdesk-sync.yml`,
 * plán Hobby na Verceli cron častejšie než raz denne nedovolí) a denný cron
 * vo `vercel.json` ako záloha. Synchronizuje sa len kanál, ktorému uplynul
 * jeho interval (`isSyncDue()`, nastavenie kanála). Tlačidlo „Synchronizovať
 * teraz" v nastavení kanála interval nepozerá.
 */

import { NextResponse } from "next/server"
import { channelsWithMailbox, syncChannel, isSyncDue, type SyncReport } from "@/lib/channels"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const reports: (SyncReport & { companyCode: string })[] = []
  const now = new Date()
  let notDue = 0
  for (const channel of await channelsWithMailbox()) {
    if (channel.mailbox && !isSyncDue(channel.mailbox, now)) { notDue += 1; continue }
    try {
      const r = await syncChannel(channel.companyCode, channel.key)
      reports.push({ companyCode: channel.companyCode, ...r })
    } catch (e) {
      console.error(`[cron] helpdesk-sync ${channel.companyCode}/${channel.key} zlyhal:`, e)
      reports.push({ companyCode: channel.companyCode, key: channel.key, pages: 0, created: 0, appended: 0, skipped: 0, beforeStart: 0, done: false, error: "failed" })
    }
  }
  return NextResponse.json({ ok: true, channels: reports, notDue })
}
