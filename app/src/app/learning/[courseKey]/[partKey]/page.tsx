/**
 * /learning/[courseKey]/[partKey] — časť kurzu (rám `docs/design/PART-cast-kurzu.md`).
 *
 * Bloky obsahu pod sebou, na desktope osnova častí vľavo. Dole pás časti
 * (`.pdock`, sticky): testy časti a „Označiť ako prejdené". Tlačidlo sa
 * vypína **len** kvôli povinnému videu (zadanie, PART Q1 ✅) — povinný test
 * je samostatná podmienka hotovej časti (D119).
 *
 * Len pre zapísaného. Zamknutá časť (postupný kurz) vráti na prehľad kurzu.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningContext } from "@/lib/learning"
import { getCourse } from "@/lib/coursesDb"
import { enrollmentFor } from "@/lib/enrollmentsDb"
import { progressFacts } from "@/lib/learningProgressDb"
import { courseDocInfo } from "@/lib/courseDocs"
import { partTestRows, type PartTestRow } from "@/lib/testAttemptsDb"
import { testRowView } from "@/lib/testView"
import { mustWatchPercent } from "@/lib/courseView"
import { versionById } from "@/lib/courses"
import { courseProgress, type PartProgress } from "@/lib/learningProgress"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import ContentBlocks from "@/components/ContentBlocks"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { completePartAction } from "../../actions"

export const dynamic = "force-dynamic"

export default async function PartPage({ params, searchParams }: {
  params: Promise<{ courseKey: string; partKey: string }>
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const p = await params
  const courseKey = decodeURIComponent(p.courseKey)
  const partKey = decodeURIComponent(p.partKey)
  const companyCode = ctx.person.companyCode
  const course = await getCourse(companyCode, courseKey)
  if (!course) notFound()
  const enrollment = await enrollmentFor(companyCode, ctx.person.id, courseKey)
  // Nezapísaný časti nevidí — na prehľade kurzu sa môže zapísať.
  if (!enrollment || enrollment.cancelledAt) redirect(`/learning/${course.key}`)
  const version = versionById(course, enrollment.versionId)
  const index = version?.parts.findIndex(x => x.key === partKey) ?? -1
  if (!version || index < 0) notFound()

  const facts = await progressFacts(companyCode, enrollment.id)
  const progress = courseProgress(version, facts)
  const current = progress.parts[index]
  if (current.state === "locked") redirect(`/learning/${course.key}`)
  const [docs, testRows] = await Promise.all([courseDocInfo(companyCode, current.part), partTestRows(enrollment, current.part)])

  const language = ctx.person.language
  const t = dictionary(language).learning
  const tp = t.part
  const base = `/learning/${course.key}`
  const self = `${base}/${current.part.key}`
  const nextPart = version.parts[index + 1] ?? null
  // V postupnom kurze je „Ďalšia" vypnutá, kým táto časť nie je hotová.
  const nextOff = !nextPart || (version.sequential && current.part.required && current.state !== "done")

  return (
    <AppShell language={language} title={current.part.title} trail={{ [base]: version.title }}>
      <div className="pp" style={tenantStyle(brandingView(ctx.tenant))}>
        <Notice language={language} message={q.msg} error={q.error === "1"} back={self} />
        {/* „← Späť na kurz" preč — kurz je v ceste pod hlavičkou
            (ZAKLAD-podmenu-a-akcie, Q2, 2. 10. 2026). */}
        <nav className="pnav">
          <span className="pos">{tp.partOf(index + 1, version.parts.length)}</span>
          {nextPart && !nextOff
            ? <Link href={`${base}/${nextPart.key}`}>{tp.nextPart} →</Link>
            : <span className="pnav-off" aria-disabled="true">{tp.nextPart} →</span>}
        </nav>

        <div className="pp-cols">
          <aside className="pp-outline" aria-label={t.course.partsHeading}>
            <h2>{t.course.partsHeading}</h2>
            {progress.parts.map((x, i) => (
              <OutlineRow key={x.part.key} p={x} n={i + 1} href={`${base}/${x.part.key}`} current={i === index} />
            ))}
          </aside>

          <div className="pp-main">
            <header className="pp-head">
              <h1 className="page-title">{current.part.title}</h1>
              <div className="ph-meta">
                <span className={current.part.required ? "tag" : "tag tag--archived"}>{current.part.required ? t.course.partRequired : t.course.partOptional}</span>
                <span>{version.title}</span>
                {current.part.estimatedMinutes && <span>{t.minutes(current.part.estimatedMinutes)}</span>}
              </div>
            </header>

            <ContentBlocks part={current.part} courseKey={course.key} facts={facts} docs={docs} recording language={language} />

            {current.part.tests.length > 0 && (
              <section id="tests" className="card ptests ptests--flow">
                <h2>{tp.testsHeading}</h2>
                <TestRows rows={testRows} base={self} language={language} />
              </section>
            )}

            <PartDock p={current} courseKey={course.key} base={self} nextHref={nextPart ? `${base}/${nextPart.key}` : null}
                      percent={mustWatchPercent(current.part, facts) ?? 0} rows={testRows} language={language} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function OutlineRow({ p, n, href, current }: { p: PartProgress; n: number; href: string; current: boolean }) {
  const mark = p.state === "done" ? "✓" : n
  const cls = `pp-orow${current ? " is-current" : ""}${p.state === "locked" ? " is-locked" : ""}`
  const body = (<><span className={`pr-mark pr-mark--sm ${p.state === "done" ? "done" : p.state === "in-progress" ? "prog" : p.state === "locked" ? "lock" : ""}`} aria-hidden="true">{mark}</span><span>{p.part.title}</span></>)
  return p.state === "locked"
    ? <span className={cls}>{body}</span>
    : <Link className={cls} href={href} aria-current={current ? "page" : undefined}>{body}</Link>
}

function TestRows({ rows, base, language }: { rows: PartTestRow[]; base: string; language: UiLanguage }) {
  const d = dictionary(language).learning
  const now = new Date()
  const time = (x: Date) => x.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
  return (
    <>
      {rows.map(r => {
        const v = testRowView(r, base, { ...d.attempt, notStarted: d.course.testNotStarted, start: d.part.testStart }, now, time)
        return (
          <div key={r.testKey} className="ptr">
            <span className="ptr-name"><span>{d.course.testLabel}: </span><b>{r.test?.title ?? r.testKey}</b> <span>· {r.required ? d.course.testRequired : d.course.testOptional}</span></span>
            <span className={`ptr-res tone-${v.tone}`}>{v.state}</span>
            {v.resultHref && <Link className="lc-link" href={v.resultHref}>{d.attempt.result}</Link>}
            {/* Plné je „Označiť ako prejdené" v doku; akcia testu tichá (jedno plné). */}
            {v.action && <Link className="button button--quiet" href={v.action.href}>{v.action.label}</Link>}
          </div>
        )
      })}
    </>
  )
}

function PartDock({ p, courseKey, base, nextHref, percent, rows, language }: {
  p: PartProgress
  courseKey: string
  base: string
  nextHref: string | null
  percent: number
  rows: PartTestRow[]
  language: UiLanguage
}) {
  const t = dictionary(language).learning
  const tp = t.part
  const e = p.evaluation
  const now = new Date()
  const time = (x: Date) => x.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })
  const view = (r: PartTestRow) => testRowView(r, base, { ...t.attempt, notStarted: t.course.testNotStarted, start: tp.testStart }, now, time)
  const optionalOpen = rows.some(r => !r.required && !r.availability.lastPassed)
  const firstRequired = rows.find(r => r.required)
  const summary = firstRequired ? tp.requiredTestSummary(view(firstRequired).state) : null

  return (
    <div className="pdock">
      {p.part.tests.length > 0 && (
        <div className="pdock-tests"><TestRows rows={rows} base={base} language={language} /></div>
      )}
      {summary && (
        <p className="pdock-summary">{summary} · <a href="#tests">{tp.testsJump}</a></p>
      )}
      <div className="pdock-mark">
        {!e.completedAt && e.videosMissing.length > 0 && (
          <>
            <button type="button" className="button" disabled aria-disabled="true">{tp.markDone}</button>
            <span className="pdock-note">{tp.markDisabledVideo(percent)}</span>
          </>
        )}
        {!e.completedAt && e.videosMissing.length === 0 && (
          <form action={completePartAction} className="pdock-form">
            <input type="hidden" name="courseKey" value={courseKey} />
            <input type="hidden" name="partKey" value={p.part.key} />
            <SubmitButton className="button">{tp.markDone}</SubmitButton>
            <span className="pdock-note">{tp.markReady}</span>
          </form>
        )}
        {e.completedAt && !e.done && (
          <p className="pdock-state is-warn"><span className="pdock-ico" aria-hidden="true">!</span>{tp.markedWaitingTest(formatDate(e.completedAt, language))}</p>
        )}
        {e.done && e.doneAt && (
          <p className="pdock-state is-ok">
            <span className="pdock-ico" aria-hidden="true">✓</span>
            <span>{tp.partDone(formatDate(e.doneAt, language))}{optionalOpen && <> · {tp.optionalTestNote}</>}</span>
            {nextHref && <Link className="lc-link" href={nextHref}>{tp.nextPartLink}</Link>}
          </p>
        )}
      </div>
    </div>
  )
}
