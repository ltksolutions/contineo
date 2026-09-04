/**
 * route.ts → /api/hodnotenie
 *
 * POST  — založí záznam o odpovedi (volá sa hneď po dobehnutí generovania)
 * PATCH — doplní ľudské posúdenie
 *
 * Rozdelenie na dva kroky je zámerné: automatické metriky D9 sa dajú
 * počítať aj z odpovedí, ktoré nikto neposúdil. Keby sa záznam zakladal až
 * pri kliknutí na hodnotenie, prišli by sme o dáta o latencii a retrievale
 * z každej otázky, ktorú hodnotiteľ preskočil.
 */

import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { recordAnswer, saveVerdict } from "@/lib/ratings"
import type { NewRating, RatingEdit, Verdict } from "@/lib/ratings"

/**
 * Kto hodnotí. Kým nie je prihlasovanie, ide o „anonym" — dôležité je, aby
 * sa dalo neskôr rozlíšiť, čo hodnotil kto (D9, otvorený bod E5: jeden
 * hodnotiteľ je pri 0/1 posudzovaní jediný bod zlyhania).
 */
async function reviewer(req: NextRequest): Promise<string> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    return (token?.email as string) ?? "anonym"
  } catch {
    return "anonym"
  }
}

/** Posudok smie byť len 0, 1 alebo null — nič iné sa do DB nedostane. */
function verdict(v: unknown): Verdict | undefined {
  if (v === null) return null
  if (v === 0 || v === 1) return v
  return undefined
}

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined
  return v.slice(0, max)
}

export async function POST(req: NextRequest) {
  let body: Partial<NewRating>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (!body.question?.trim() || !body.answer?.trim()) {
    return NextResponse.json(
      { error: "missing-question-or-answer" },
      { status: 400 }
    )
  }

  try {
    const id = await recordAnswer(
      {
        questionId: body.questionId,
        question: body.question,
        answer: body.answer,
        sources: body.sources ?? [],
        citations: body.citations ?? [],
        model: body.model ?? "",
        provider: body.provider ?? "",
        verifiedCitations: Boolean(body.verifiedCitations),
        ttftMs: body.ttftMs ?? null,
        totalMs: body.totalMs ?? 0,
        timings: body.timings,
        tokens: body.tokens,
        cost: body.cost,
      },
      await reviewer(req)
    )
    return NextResponse.json({ id })
  } catch (e) {
    console.error("Zápis odpovede zlyhal:", e)
    return NextResponse.json({ error: "write-failed" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  let body: { id?: string } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: "missing-id" }, { status: 400 })
  }

  const edit: RatingEdit = {}
  const s = verdict(body.correct)
  const h = verdict(body.hallucination)
  if (s !== undefined) edit.correct = s
  if (h !== undefined) edit.hallucination = h

  const verified = text(body.verifiedAnswer, 4000)
  const sources = text(body.correctSources, 500)
  const note = text(body.note, 2000)
  if (verified !== undefined) edit.verifiedAnswer = verified
  if (sources !== undefined) edit.correctSources = sources
  if (note !== undefined) edit.note = note

  if (Object.keys(edit).length === 0) {
    return NextResponse.json({ error: "nothing-to-save" }, { status: 400 })
  }

  try {
    const ok = await saveVerdict(body.id, edit, await reviewer(req))
    if (!ok) {
      return NextResponse.json({ error: "record-not-found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Uloženie posudku zlyhalo:", e)
    return NextResponse.json({ error: "save-failed" }, { status: 500 })
  }
}
