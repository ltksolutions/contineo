/**
 * Export zapísaných do kurzu (MANAGE-COURSE, „Export CSV") — len lektor.
 * Stav bez skóre (D121); CSV s BOM a bodkočiarkou pre Excel (`toCsv`).
 */

import { learningAdminContext } from "@/lib/learning"
import { getCourse } from "@/lib/coursesDb"
import { courseRoster } from "@/lib/learningStats"
import { toCsv } from "@/lib/csv"
import { dictionary, formatDate } from "@/lib/i18n"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ courseKey: string }> }) {
  const ctx = await learningAdminContext()
  if (ctx.state === "not-signed-in") return new Response(null, { status: 401 })
  if (ctx.state !== "ready") return new Response(null, { status: 404 })
  const key = decodeURIComponent((await params).courseKey)
  const course = await getCourse(ctx.person.companyCode, key)
  if (!course) return new Response(null, { status: 404 })
  const language = ctx.person.language
  const d = dictionary(language)
  const tp = d.learning.people
  const rows = await courseRoster(ctx.person.companyCode, course)
  const state = { "not-started": tp.notStarted, "in-progress": tp.inProgress, done: tp.done }
  const csv = toCsv(rows, [
    { label: tp.colName, value: r => r.enrollment.fullName },
    { label: tp.colEmail, value: r => r.enrollment.email },
    { label: tp.colDepartment, value: r => r.department ?? "" },
    { label: tp.colEnrollment, value: r => d.learning.course.enrolledVia[r.enrollment.source] },
    { label: tp.colState, value: r => state[r.state] },
    { label: d.learning.course.requiredParts, value: r => `${r.requiredDone}/${r.requiredTotal}` },
    { label: tp.done, value: r => (r.completedAt ? formatDate(r.completedAt, language) : "") },
    { label: tp.colActivity, value: r => formatDate(r.lastActivity, language) },
  ])
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${course.key}-zapisani.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
