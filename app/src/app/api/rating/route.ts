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
import { getToken } from "next-auth/jwt"
import { recordAnswer, saveVerdict, saveReaderFeedback } from "@/lib/ratings"
import type { NewRating, RatingEdit, ReaderFeedback, Verdict } from "@/lib/ratings"
import { isEvaluator } from "@/lib/evaluation"
import { currentPerson } from "@/lib/session"

/**
 * Kto je na druhej strane — **`persons.id`, alebo nič** (O17).
 *
 * `personId: null` znamená „nikto prihlásený": buď verejný widget, alebo
 * platný token bez záznamu v `persons`. E-mail z tokenu sa **nezapisuje** —
 * záznam o hodnotení nie je dôkaz a nemá preto držať osobný údaj doslovne
 * (pozri `RatingRecord.reviewer`). Token sa číta už len preto, aby sa
 * rozlíšilo prihlásené volanie od úplne cudzieho.
 *
 * Záznam bez `companyCode` sa do žiadnej fronty nedostane, čo je
 * bezpečnejšie než ho pripísať naslepo.
 */
async function caller(req: NextRequest) {
  const person = await currentPerson().catch(() => null)
  if (person) return { personId: person.id, companyCode: person.companyCode, person }

  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    return { personId: null, signedIn: Boolean(token), companyCode: undefined, person: null }
  } catch {
    return { personId: null, signedIn: false, companyCode: undefined, person: null }
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

  const who = await caller(req)
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
      who.personId,
      who.companyCode
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

  const who = await caller(req)

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
      const saved = await saveReaderFeedback(body.id, feedback, who.personId)
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
  if (!isEvaluator(who.person) || !who.person) {
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
    const ok = await saveVerdict(body.id, edit, who.person.id)
    if (!ok) {
      return NextResponse.json({ error: "record-not-found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Uloženie posudku zlyhalo:", e)
    return NextResponse.json({ error: "save-failed" }, { status: 500 })
  }
}
