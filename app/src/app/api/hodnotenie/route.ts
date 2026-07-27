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
import { zapisOdpoved, ulozPosudok } from "@/lib/hodnotenia"
import type { NovyZaznam, UpravaHodnotenia, Posudok } from "@/lib/hodnotenia"

/**
 * Kto hodnotí. Kým nie je prihlasovanie, ide o „anonym" — dôležité je, aby
 * sa dalo neskôr rozlíšiť, čo hodnotil kto (D9, otvorený bod E5: jeden
 * hodnotiteľ je pri 0/1 posudzovaní jediný bod zlyhania).
 */
async function ktoHodnoti(req: NextRequest): Promise<string> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    return (token?.email as string) ?? "anonym"
  } catch {
    return "anonym"
  }
}

/** Posudok smie byť len 0, 1 alebo null — nič iné sa do DB nedostane. */
function posudok(v: unknown): Posudok | undefined {
  if (v === null) return null
  if (v === 0 || v === 1) return v
  return undefined
}

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined
  return v.slice(0, max)
}

export async function POST(req: NextRequest) {
  let telo: Partial<NovyZaznam>
  try {
    telo = await req.json()
  } catch {
    return NextResponse.json({ chyba: "Neplatný JSON" }, { status: 400 })
  }

  if (!telo.otazka?.trim() || !telo.odpoved?.trim()) {
    return NextResponse.json(
      { chyba: "Chýba otázka alebo odpoveď" },
      { status: 400 }
    )
  }

  try {
    const id = await zapisOdpoved(
      {
        otazkaId: telo.otazkaId,
        otazka: telo.otazka,
        odpoved: telo.odpoved,
        zdroje: telo.zdroje ?? [],
        citacie: telo.citacie ?? [],
        model: telo.model ?? "",
        provider: telo.provider ?? "",
        overeneCitacie: Boolean(telo.overeneCitacie),
        ttftMs: telo.ttftMs ?? null,
        celkovoMs: telo.celkovoMs ?? 0,
        casy: telo.casy,
      },
      await ktoHodnoti(req)
    )
    return NextResponse.json({ id })
  } catch (e) {
    console.error("Zápis odpovede zlyhal:", e)
    return NextResponse.json({ chyba: "Zápis zlyhal" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  let telo: { id?: string } & Record<string, unknown>
  try {
    telo = await req.json()
  } catch {
    return NextResponse.json({ chyba: "Neplatný JSON" }, { status: 400 })
  }

  if (!telo.id) {
    return NextResponse.json({ chyba: "Chýba id" }, { status: 400 })
  }

  const uprava: UpravaHodnotenia = {}
  const s = posudok(telo.spravna)
  const h = posudok(telo.halucinacia)
  if (s !== undefined) uprava.spravna = s
  if (h !== undefined) uprava.halucinacia = h

  const overena = text(telo.overenaOdpoved, 4000)
  const zdroje = text(telo.spravneZdroje, 500)
  const poznamka = text(telo.poznamka, 2000)
  if (overena !== undefined) uprava.overenaOdpoved = overena
  if (zdroje !== undefined) uprava.spravneZdroje = zdroje
  if (poznamka !== undefined) uprava.poznamka = poznamka

  if (Object.keys(uprava).length === 0) {
    return NextResponse.json({ chyba: "Nič na uloženie" }, { status: 400 })
  }

  try {
    const ok = await ulozPosudok(telo.id, uprava, await ktoHodnoti(req))
    if (!ok) {
      return NextResponse.json({ chyba: "Záznam sa nenašiel" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Uloženie posudku zlyhalo:", e)
    return NextResponse.json({ chyba: "Uloženie zlyhalo" }, { status: 500 })
  }
}
