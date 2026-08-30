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
    return NextResponse.json({ chyba: "Neplatný JSON" }, { status: 400 })
  }

  if (!body.otazka?.trim() || !body.odpoved?.trim()) {
    return NextResponse.json(
      { chyba: "Chýba otázka alebo odpoveď" },
      { status: 400 }
    )
  }

  try {
    const id = await recordAnswer(
      {
        otazkaId: body.otazkaId,
        otazka: body.otazka,
        odpoved: body.odpoved,
        zdroje: body.zdroje ?? [],
        citacie: body.citacie ?? [],
        model: body.model ?? "",
        provider: body.provider ?? "",
        overeneCitacie: Boolean(body.overeneCitacie),
        ttftMs: body.ttftMs ?? null,
        celkovoMs: body.celkovoMs ?? 0,
        casy: body.casy,
        tokeny: body.tokeny,
        naklad: body.naklad,
      },
      await reviewer(req)
    )
    return NextResponse.json({ id })
  } catch (e) {
    console.error("Zápis odpovede zlyhal:", e)
    return NextResponse.json({ chyba: "Zápis zlyhal" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  let body: { id?: string } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ chyba: "Neplatný JSON" }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ chyba: "Chýba id" }, { status: 400 })
  }

  const edit: RatingEdit = {}
  const s = verdict(body.spravna)
  const h = verdict(body.halucinacia)
  if (s !== undefined) edit.spravna = s
  if (h !== undefined) edit.halucinacia = h

  const verified = text(body.overenaOdpoved, 4000)
  const sources = text(body.spravneZdroje, 500)
  const note = text(body.poznamka, 2000)
  if (verified !== undefined) edit.overenaOdpoved = verified
  if (sources !== undefined) edit.spravneZdroje = sources
  if (note !== undefined) edit.poznamka = note

  if (Object.keys(edit).length === 0) {
    return NextResponse.json({ chyba: "Nič na uloženie" }, { status: 400 })
  }

  try {
    const ok = await saveVerdict(body.id, edit, await reviewer(req))
    if (!ok) {
      return NextResponse.json({ chyba: "Záznam sa nenašiel" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Uloženie posudku zlyhalo:", e)
    return NextResponse.json({ chyba: "Uloženie zlyhalo" }, { status: 500 })
  }
}
