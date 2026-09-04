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
import { editQuestion } from "@/lib/goldenSet"

export async function PATCH(req: NextRequest) {
  let body: { id?: string } & Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 })
  }

  if (!body.id || typeof body.id !== "string") {
    return NextResponse.json({ error: "missing-question-id" }, { status: 400 })
  }

  const edit: Parameters<typeof editQuestion>[1] = {}
  if (typeof body.editedText === "string") edit.editedText = body.editedText
  if (typeof body.excluded === "boolean") edit.excluded = body.excluded
  if (typeof body.exclusionReason === "string") edit.exclusionReason = body.exclusionReason

  if (!Object.keys(edit).length) {
    return NextResponse.json({ error: "nothing-to-save" }, { status: 400 })
  }

  try {
    const ok = await editQuestion(body.id, edit)
    if (!ok) return NextResponse.json({ error: "question-not-found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("Úprava otázky zlyhala:", e)
    return NextResponse.json({ error: "save-failed" }, { status: 500 })
  }
}
