/**
 * GET /api/ask/history — vlastné otázky pre plachtu otázky
 * (ASK-historia-otazok): `?q=` zúži, `?limit=` (najviac 20) obmedzí.
 * Stránka `/ask/history` API nepotrebuje, číta na serveri.
 */

import { NextRequest, NextResponse } from "next/server"
import { recentQuestions } from "@/lib/askHistory"
import { historyCaller } from "@/lib/askHistoryApi"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const who = await historyCaller()
  if ("error" in who) return who.error
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 200)
  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 5))
  const items = await recentQuestions(who.companyCode, who.personId, q, limit)
  return NextResponse.json(
    { items: items.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })) },
    // Osobný zoznam — nikde po ceste sa nemá odložiť.
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
