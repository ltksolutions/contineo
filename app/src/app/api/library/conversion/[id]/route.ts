/**
 * Stav prevodu modelom pre priebežný oznam v editore (ADR-046).
 *
 * Neverejné ako všetko v knižnici: prihlásenie, rola správcu obsahu a
 * organizácia v podmienke dotazu (D32). Vracia len vetu o kroku — nie
 * analýzu ani text dokumentu.
 *
 * **Postrčí pretrhnutú reťaz.** Medzi krokmi je zámok voľný len na okamih;
 * voľný zámok pri bežiacom behu teda znamená, že ďalší krok nezačal
 * (3. 11. 2026: rozpis ÚLK stál po 3. časti tri minúty, kým ho zdvihol
 * cron). Kým má niekto editor otvorený, beh sa tak pohne do pár sekúnd;
 * súbežné postrčenia sú neškodné, krok si zámok berie sám.
 */

import { NextResponse, after } from "next/server"
import { kick } from "@/lib/backgroundKick"
import { libraryContext } from "@/lib/library"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { conversionNote } from "@/lib/conversionNote"
import type { AiConversion } from "@/lib/aiConversionJob"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    return new Response(null, { status: ctx.state === "not-signed-in" ? 401 : 403 })
  }
  const { id } = await params
  const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne(
    { companyCode: ctx.tenant.companyCode, documentId: decodeURIComponent(id) },
    { projection: { aiConversion: 1 } },
  ) as { aiConversion?: AiConversion | null } | null
  if (!doc) return new Response(null, { status: 404 })
  const job = doc.aiConversion
  const note = job ? conversionNote(job, ctx.person.language) : null
  if (job && note?.running && (!job.leaseUntil || new Date(job.leaseUntil) < new Date())) {
    const origin = new URL(req.url).origin
    after(() => kick(origin, "/api/cron/conversion"))
  }
  return NextResponse.json({ running: note?.running ?? false, note }, { headers: { "Cache-Control": "no-store" } })
}
