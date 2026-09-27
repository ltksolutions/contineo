/**
 * Export banky otázok do CSV (rám TESTS) — ten istý formát ako import
 * (TESTS Q1 ✅), takže sa súbor dá upraviť a nahrať späť cez `id`.
 * `?template=1` vráti prázdny vzor s hlavičkou a jedným príkladom.
 */

import { learningAdminContext } from "@/lib/learning"
import { listQuestions } from "@/lib/questionsDb"
import { exportQuestionsCsv } from "@/lib/questions"
import { parseSmartTag } from "@/lib/smartTags"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  if (ctx.state !== "ready") return new Response(null, { status: 404 })
  const template = new URL(req.url).searchParams.get("template") === "1"
  const questions = template
    ? [{
        companyCode: "", key: "priklad-1", type: "single" as const, text: "Kde je najbližší hasiaci prístroj?", media: [],
        answers: [{ id: "a1", text: "Na chodbe pri výťahu", correct: true }, { id: "a2", text: "V kuchynke", correct: false }],
        weight: 1, difficulty: "medium" as const, smartTags: [parseSmartTag("Bezpečnosť: Požiar")!], status: "active" as const, version: 1, createdAt: new Date(), createdBy: "",
      }]
    : await listQuestions(ctx.person.companyCode)
  return new Response(exportQuestionsCsv(questions), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template ? "vzor-otazok" : "banka-otazok"}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
