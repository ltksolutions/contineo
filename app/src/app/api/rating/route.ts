/**
 * route.ts → /api/rating
 *
 * POST  — založí záznam o odpovedi (volá sa hneď po dobehnutí generovania)
 * PATCH — doplní, čo povedal čitateľ, **alebo** posudok hodnotiteľa
 *
 * Rozdelenie na dva kroky je zámerné: automatické metriky sa dajú počítať aj
 * z odpovedí, ktoré nikto neposúdil. Keby sa záznam zakladal až pri kliknutí
 * na hodnotenie, prišli by sme o dáta o latencii a retrievale z každej
 * otázky, ktorú nikto nehodnotil.
 *
 * **PATCH má dve vetvy a nie je to kozmetika.** Čitateľ píše do vlastných
 * polí a smie to každý prihlásený; posudok píše **len držiteľ roly
 * `evaluator`**. Do 2026-09-15 mohol posudok zapísať ktokoľvek a v databáze
 * sa nedalo rozlíšiť, čí je — presne to tu končí.
 */

import { NextRequest, NextResponse } from "next/server"
import { recordAnswer, saveVerdict, saveReaderFeedback } from "@/lib/ratings"
import type { NewRating, RatingEdit, ReaderFeedback, Verdict } from "@/lib/ratings"
import { isEvaluator } from "@/lib/evaluation"
import { onboardingContext } from "@/lib/session"
import { sameOrigin } from "@/lib/sameOrigin"

/**
 * Kto je na druhej strane — **osoba organizácie domény, alebo odmietnutie**
 * (D29, D90).
 *
 * Do 2026-09-17 sa osoba skladala z relácie bez ohľadu na doménu a záznam bez
 * osoby dostal `companyCode: undefined`. Posudok a spätná väzba sa potom
 * zapisovali podľa `_id` bez organizácie, takže sa dalo písať do záznamu inej
 * organizácie. Teraz platí to isté ako v `/api/chat`: organizácia je daná
 * doménou a prihlásenou osobou, a každý zápis ju má v podmienke.
 *
 * Neprihlásený sem nepríde vôbec — proxy `/api/rating` bez prihlásenia nepustí.
 * Verejný widget, keď vznikne, bude mať vlastnú cestu s tou istou organizáciou.
 */
async function caller() {
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") return { error: new Response(null, { status: 404 }) } as const
  if (ctx.state === "not-signed-in") {
    return { error: NextResponse.json({ error: "not-signed-in" }, { status: 401 }) } as const
  }
  if (ctx.state !== "ready") {
    return { error: NextResponse.json({ error: "not-in-tenant" }, { status: 403 }) } as const
  }
  return { person: ctx.person, companyCode: ctx.tenant.companyCode } as const
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
  // Pôvod pred čímkoľvek iným (CSRF): hodnotenie sa zapisuje v mene
  // prihláseného a cudzia stránka ho nemá vedieť podstrčiť. Viď `lib/sameOrigin.ts`.
  if (!sameOrigin(req.headers)) return new Response(null, { status: 403 })

  const who = await caller()
  if ("error" in who) return who.error

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
      who.person.id,
      who.companyCode
    )
    return NextResponse.json({ id })
  } catch (e) {
    console.error("Zápis odpovede zlyhal:", e)
    return NextResponse.json({ error: "write-failed" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  // To isté ako pri `POST` — úprava hodnotenia je tiež zápis v jeho mene.
  if (!sameOrigin(req.headers)) return new Response(null, { status: 403 })

  const who = await caller()
  if ("error" in who) return who.error

  let body: { id?: string } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: "missing-id" }, { status: 400 })
  }

  /*
   * Vetva čitateľa: „sedí / nesedí" a čo bolo zle.
   *
   * Píše do vlastných polí, nepodpisuje sa ako hodnotiteľ a nehýbe časom
   * poslednej zmeny. Keby to bol ďalší kľúč v `edit`, `saveVerdict()` by to
   * zliala s posudkom a záznam by tvrdil, že odpoveď posúdil ten, kto ju len
   * nahlásil.
   */
  const readerVerdict = verdict(body.readerVerdict)
  const readerNote = typeof body.readerNote === "string" ? body.readerNote : undefined
  if (readerVerdict !== undefined || readerNote !== undefined) {
    const feedback: ReaderFeedback = {}
    if (readerVerdict !== undefined) feedback.verdict = readerVerdict
    if (readerNote !== undefined) feedback.note = readerNote

    try {
      const saved = await saveReaderFeedback(body.id, feedback, who.person.id, who.companyCode)
      if (!saved) {
        return NextResponse.json({ error: "nothing-to-save" }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    } catch (e) {
      console.error("Uloženie spätnej väzby zlyhalo:", e)
      return NextResponse.json({ error: "save-failed" }, { status: 500 })
    }
  }

  /*
   * Vetva hodnotiteľa. **Rolová brána je tu, nie v `saveVerdict()`** — je to
   * rozhodnutie o prístupe a to patrí na hranicu systému, kde je známa
   * prihlásená osoba. Skladá sa zo session, nikdy z tela požiadavky (D32).
   */
  if (!isEvaluator(who.person)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
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
    const ok = await saveVerdict(body.id, edit, who.person.id, who.companyCode)
    if (!ok) {
      return NextResponse.json({ error: "record-not-found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Uloženie posudku zlyhalo:", e)
    return NextResponse.json({ error: "save-failed" }, { status: 500 })
  }
}
