/**
 * Sledovanie videa — prehrávač sem posiela pozreté úseky (modul Vzdelávanie,
 * ADR-018 D119). Je to **meranie, nie dôkaz**: server úseky zlúči, oreže
 * dĺžkou z verzie kurzu a sám vyhodnotí hranicu 90 % (`recordVideoWatch`).
 *
 * Telo je JSON aj pri `navigator.sendBeacon` (odchod zo stránky), preto sa
 * číta ako text a nie podľa `Content-Type`.
 */

import { learningContext } from "@/lib/learning"
import { enrollmentFor } from "@/lib/enrollmentsDb"
import { recordVideoWatch } from "@/lib/learningProgressDb"
import { AppError } from "@/lib/appError"
import type { WatchRange } from "@/lib/learningProgress"

export const dynamic = "force-dynamic"

/** Viac úsekov za jedno odoslanie prehrávač nepošle; viac je chyba alebo zlý úmysel. */
const MAX_RANGES = 200

export async function POST(req: Request) {
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  if (ctx.state !== "ready") return new Response(null, { status: 404 })

  let body: { courseKey?: unknown; partKey?: unknown; blockId?: unknown; ranges?: unknown; durationSec?: unknown }
  try {
    body = JSON.parse(await req.text())
  } catch {
    return new Response(null, { status: 400 })
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  const ranges = Array.isArray(body.ranges) ? body.ranges.slice(0, MAX_RANGES) : []
  const clean = ranges.filter((r): r is WatchRange =>
    Array.isArray(r) && r.length === 2 && r.every(x => typeof x === "number" && Number.isFinite(x)))
  if (!str(body.courseKey) || !str(body.partKey) || !str(body.blockId)) return new Response(null, { status: 400 })

  const enrollment = await enrollmentFor(ctx.person.companyCode, ctx.person.id, str(body.courseKey))
  if (!enrollment || enrollment.cancelledAt) return new Response(null, { status: 404 })
  try {
    const r = await recordVideoWatch({
      enrollment,
      partKey: str(body.partKey),
      blockId: str(body.blockId),
      ranges: clean,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : undefined,
    })
    return Response.json(r)
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.code }, { status: 422 })
    console.error("[learning] zápis sledovania zlyhal:", e)
    return new Response(null, { status: 500 })
  }
}
