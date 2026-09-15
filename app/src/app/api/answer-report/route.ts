/**
 * POST /api/answer-report — nahlásenie nepresnej odpovede.
 *
 * **Prečo cesta a nie serverová akcia.** Obrazovka s odpoveďou je klientska
 * a odpoveď sa streamuje; serverová akcia s presmerovaním by po odoslaní
 * hlásenia zmazala to, na čo sa človek sťažuje. Takto zostane odpoveď na
 * obrazovke a formulár len povie „ďakujeme".
 *
 * **Identita nikdy z tela požiadavky** (D32): organizácia aj osoba sa berú
 * z prihlásenia. Z tela prichádza len to, čo mal človek na obrazovke — a to
 * sa berie ako jeho tvrdenie, nie ako záznam systému.
 */

import { onboardingContext } from "@/lib/session"
import { saveReport } from "@/lib/answerReports"
import { AppError } from "@/lib/appError"
import { errorText } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const ctx = await onboardingContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  if (ctx.state !== "ready") return new Response(null, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 })
  }

  try {
    await saveReport({
      companyCode: ctx.person.companyCode,
      personId: ctx.person.id,
      email: ctx.person.email,
      fullName: ctx.person.fullName ?? ctx.person.email,
      question: body.question,
      answer: body.answer,
      note: body.note,
      sources: body.sources,
    })
    return Response.json({ ok: true })
  } catch (e) {
    // Chýbajúci popis je chyba človeka, nie servera — 400, nie 500, a veta
    // v jeho jazyku, aby ju formulár mohol ukázať tak, ako prišla.
    const status = e instanceof AppError ? 400 : 500
    if (status === 500) console.error("[answer-report] zapis zlyhal:", e)
    return Response.json({ ok: false, error: errorText(e, ctx.person.language) }, { status })
  }
}
