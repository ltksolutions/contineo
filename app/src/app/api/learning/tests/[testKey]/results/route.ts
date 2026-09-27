/**
 * Export výsledkov testu do CSV (rám TESTS, záložka Výsledky) — **len
 * zodpovedná osoba testu** (D121). Lektor ani HR samy osebe nie.
 */

import { learningContext } from "@/lib/learning"
import { testsResponsibleFor } from "@/lib/testsDb"
import { attemptsOfTest } from "@/lib/testAttemptsDb"
import { toCsv } from "@/lib/csv"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ testKey: string }> }) {
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  if (ctx.state !== "ready") return new Response(null, { status: 404 })
  const key = decodeURIComponent((await params).testKey)
  const test = (await testsResponsibleFor(ctx.person.companyCode, ctx.person.id)).find(t => t.key === key)
  if (!test) return new Response(null, { status: 404 })
  const language = ctx.person.language
  const d = dictionary(language).learning
  const tr = d.results
  const rows = await attemptsOfTest(ctx.person.companyCode, key)
  const result = (a: (typeof rows)[number]) => a.resetAt ? tr.resetState : !a.submittedAt ? tr.openState : a.passed ? d.attempt.passedWord : d.attempt.failedWord
  const csv = toCsv(rows, [
    { label: tr.colPerson, value: a => a.fullName },
    { label: d.people.colEmail, value: a => a.email },
    { label: tr.colContext, value: a => `${a.context.courseKey} · ${a.context.partKey}` },
    { label: tr.colDate, value: a => formatDate(a.submittedAt ?? a.startedAt, language) },
    { label: tr.colAttempt, value: a => a.attemptNumber },
    { label: tr.colScore, value: a => (a.submittedAt ? `${a.percent ?? 0} %` : "") },
    { label: tr.colResult, value: result },
    { label: tr.reason, value: a => a.resetReason ?? "" },
  ])
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${key}-vysledky.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
