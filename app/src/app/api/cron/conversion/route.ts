/**
 * route.ts → /api/cron/conversion
 *
 * Krok prevodu PDF modelom (ADR-046, D301). Volá ho spustenie prevodu,
 * predošlý krok (reťaz, `lib/backgroundKick.ts`) a cron ako poistka.
 * Odpovedá hneď 202, prácu robí v `after()`; jeden krok je jedno volanie
 * modelu, bežiace prevody idú súbežne, každý pod vlastným zámkom.
 *
 * Brzda: hlavička `Authorization: Bearer CRON_SECRET`, inak 401.
 */

import { NextResponse, after } from "next/server"
import { conversionsInProgress, continueConversion } from "@/lib/aiConversionJob"
import { kick } from "@/lib/backgroundKick"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const PATH = "/api/cron/conversion"
/** Toľko prevodov naraz v jednom kúsku — každý krok drží spojenie s modelom. */
const PARALLEL = 4

async function work(): Promise<boolean> {
  const running = (await conversionsInProgress()).slice(0, PARALLEL)
  const out = await Promise.all(running.map(async r => {
    const began = Date.now()
    try {
      const more = await continueConversion(r.companyCode, r.documentId)
      console.log(`[conversion] ${r.companyCode}/${r.documentId}: ${more ? "krok hotový, pokračuje" : "bez kroku alebo koniec"} (${Math.round((Date.now() - began) / 1000)} s)`)
      return more
    } catch (e) {
      console.error(`[conversion] ${r.companyCode}/${r.documentId}:`, e)
      return false
    }
  }))
  // Reťaz pokračuje, len keď niektorý krok prebehol a beh ešte nie je hotový.
  // Krok, ktorý narazil na zámok iného, nevolá ďalej — ten druhý zavolá sám.
  return out.some(Boolean) || (await conversionsInProgress()).length > running.length
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const origin = new URL(request.url).origin
  after(async () => {
    try {
      if (await work()) {
        console.log("[conversion] ďalší kúsok")
        await kick(origin, PATH)
      }
    } catch (e) {
      console.error("[conversion] kúsok zlyhal:", e)
    }
  })
  return NextResponse.json({ ok: true }, { status: 202 })
}
