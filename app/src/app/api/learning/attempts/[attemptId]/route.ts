/**
 * Priebežné ukladanie odpovede (rám TEST-ATTEMPT, každých 30 s). Telo je
 * formulár pokusu (`FormData`) — to isté číta serverová akcia, jedno
 * pravidlo (`answerFromForm`). Limit času stráži server (`saveAnswers`).
 */

import { learningContext } from "@/lib/learning"
import { getAttempt, saveAnswers } from "@/lib/testAttemptsDb"
import { answerFromForm } from "@/lib/testAttempts"
import { sameOrigin } from "@/lib/sameOrigin"

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  if (!sameOrigin(req.headers)) return Response.json({ error: "forbidden" }, { status: 403 })
  const ctx = await learningContext()
  if (ctx.state !== "ready") return Response.json({ error: "forbidden" }, { status: ctx.state === "not-signed-in" ? 401 : 404 })
  const id = decodeURIComponent((await params).attemptId)
  const a = await getAttempt(ctx.person.companyCode, id)
  if (!a || a.personId !== ctx.person.id) return Response.json({ error: "not-found" }, { status: 404 })
  if (a.submittedAt) return Response.json({ closed: true }, { status: 409 })
  const fd = await req.formData()
  const q = a.questions[Number(fd.get("index") ?? -1)]
  if (!q) return Response.json({ error: "question" }, { status: 400 })
  const value = answerFromForm(q, fd.getAll("a").map(String))
  if (!value) return Response.json({ savedAt: null })
  try {
    const r = await saveAnswers(ctx.person.companyCode, id, ctx.person.id, { [q.questionKey]: value })
    return Response.json({ savedAt: r.savedAt })
  } catch {
    return Response.json({ closed: true }, { status: 409 })
  }
}
