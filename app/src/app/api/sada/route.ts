/**
 * route.ts → /api/sada
 *
 * PATCH — úprava znenia otázky alebo jej vyradenie.
 *
 * D9 pripúšťa, že otázky sú návrhy a smú sa preformulovať. Pôvodné znenie
 * sa ale nikdy neprepisuje — ukladá sa vedľa. Bez toho by regresné merania
 * porovnávali dva behy ako rovnaké, hoci by sa otázka medzitým zmenila.
 */

import { NextRequest, NextResponse } from "next/server"
import { upravOtazku } from "@/lib/goldenSet"

export async function PATCH(req: NextRequest) {
  let telo: { id?: string } & Record<string, unknown>
  try {
    telo = await req.json()
  } catch {
    return NextResponse.json({ chyba: "Neplatný JSON" }, { status: 400 })
  }

  if (!telo.id || typeof telo.id !== "string") {
    return NextResponse.json({ chyba: "Chýba id otázky" }, { status: 400 })
  }

  const uprava: Parameters<typeof upravOtazku>[1] = {}
  if (typeof telo.upraveneZnenie === "string") uprava.upraveneZnenie = telo.upraveneZnenie
  if (typeof telo.vyradena === "boolean") uprava.vyradena = telo.vyradena
  if (typeof telo.dovodVyradenia === "string") uprava.dovodVyradenia = telo.dovodVyradenia

  if (!Object.keys(uprava).length) {
    return NextResponse.json({ chyba: "Nič na uloženie" }, { status: 400 })
  }

  try {
    const ok = await upravOtazku(telo.id, uprava)
    if (!ok) return NextResponse.json({ chyba: "Otázka sa nenašla" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Úprava otázky zlyhala:", e)
    return NextResponse.json({ chyba: "Uloženie zlyhalo" }, { status: 500 })
  }
}
