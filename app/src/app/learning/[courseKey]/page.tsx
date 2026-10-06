/**
 * /learning/[courseKey] — prehľad kurzu (rám `docs/design/COURSE-prehlad-kurzu.md`).
 *
 * Zapísaný človek vidí **verziu zo svojho zápisu** (D118) a postup odvodený
 * z udalostí (D119). Nezapísaný vidí otvorený zverejnený kurz so zoznamom
 * častí **bez odkazov** a so „Zapísať sa" (COURSE Q1 ✅). Kurz, ktorý nie je
 * otvorený a človek doň nie je zapísaný, neexistuje (404) — neprezrádza sa.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { learningContext } from "@/lib/learning"
import { getCourse } from "@/lib/coursesDb"
import { enrollmentFor } from "@/lib/enrollmentsDb"
import { progressFacts } from "@/lib/learningProgressDb"
import { estimatedMinutes, isArchived, publishedVersion, versionById } from "@/lib/courses"
import { courseProgress, NO_FACTS, type PartProgress, type ProgressFacts } from "@/lib/learningProgress"
import { mustWatchPercent, partSummary, unlocksAfter } from "@/lib/courseView"
import { partTestRows, type PartTestRow } from "@/lib/testAttemptsDb"
import { testRowView } from "@/lib/testView"
import { ensureCertificate } from "@/lib/certificatesDb"
import { tagId } from "@/lib/smartTags"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import AppShell from "@/components/AppShell"
import FormattedText from "@/components/FormattedText"
import Notice from "@/components/Notice"
import SubmitButton from "@/components/SubmitButton"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import { enrolAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function CoursePage({ params, searchParams }: {
  params: Promise<{ courseKey: string }>
  searchParams: Promise<RawQuery>
}) {
  const q = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const { courseKey } = await params
  const key = decodeURIComponent(courseKey)
  const companyCode = ctx.person.companyCode
  const course = await getCourse(companyCode, key)
  if (!course) notFound()

  const found = await enrollmentFor(companyCode, ctx.person.id, key)
  const enrollment = found && !found.cancelledAt ? found : null
  const published = publishedVersion(course)
  // Nezapísaný smie vidieť len otvorený zverejnený kurz.
  if (!enrollment && !(course.openEnrollment && published)) notFound()
  const version = enrollment ? versionById(course, enrollment.versionId) : published
  if (!version) notFound()

  const facts: ProgressFacts = enrollment ? await progressFacts(companyCode, enrollment.id) : NO_FACTS
  const progress = courseProgress(version, facts)
  // Dokončený kurz, ktorému certifikát ešte nikto nevydal (napr. zlyhalo
  // vydanie pri označení) — vydá sa tu; `ensureCertificate` overí dokončenie.
  const cert = enrollment && progress.done && version.issuesCertificate
    ? await ensureCertificate(enrollment, ctx.tenant).catch(() => null)
    : null
  const testRows = new Map<string, PartTestRow[]>(enrollment
    ? await Promise.all(version.parts.filter(x => x.tests.length).map(async x => [x.key, await partTestRows(enrollment, x)] as [string, PartTestRow[]]))
    : [])
  const language = ctx.person.language
  const t = dictionary(language).learning
  const tc = t.course
  const base = `/learning/${course.key}`
  const minutes = estimatedMinutes(version)
  const required = version.parts.filter(p => p.required).length
  const next = enrollment ? progress.nextPart : null
  const nextIndex = next ? version.parts.findIndex(p => p.key === next.key) + 1 : 0
  const newer = enrollment && published && published.versionId !== version.versionId && published.version > version.version ? published : null
  const archived = Boolean(enrollment) && isArchived(course)
  const percent = progress.requiredTotal ? Math.round((progress.requiredDone / progress.requiredTotal) * 100) : 0
  const languageName = dictionary(language).people.languages[course.language] ?? course.language

  const notices = (
    <>
      {enrollment && progress.done && progress.completedAt && (
        <div className="lnote"><span className="lnote-mark" aria-hidden="true">✓</span><span className="lnote-text">{tc.noticeDone(formatDate(progress.completedAt, language))}
          {cert && !cert.revokedAt && <> <code>{cert.registrationNumber}</code> — <Link href={`${base}/certificate`}>{t.cert.show}</Link>.</>}</span></div>
      )}
      {newer?.publishedAt && (
        <div className="lnote lnote--info"><span className="lnote-mark" aria-hidden="true">i</span><span className="lnote-text">{tc.noticeNewVersion(newer.version, formatDate(newer.publishedAt, language), version.version)}</span></div>
      )}
      {archived && (
        <div className="lnote lnote--info"><span className="lnote-mark" aria-hidden="true">i</span><span className="lnote-text">{tc.noticeArchived}</span></div>
      )}
    </>
  )

  const progressCard = (
    <aside className="card prog-card cp-side">
      <h2>{tc.yourProgress}</h2>
      {enrollment ? (
        <>
          <div className="prog-big"><b>{tc.countOf(progress.requiredDone, progress.requiredTotal)}</b><span>{tc.requiredParts}</span></div>
          <div className="lc-track" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
          {cert && !cert.revokedAt && <Link className="button button--quiet" href={`${base}/certificate`}>{t.cert.show}</Link>}
          {next && (
            <>
              <Link className="button" href={`${base}/${next.key}`}>{progress.started ? tc.continueHere : tc.startCourse}</Link>
              <p className="prog-next">{t.next(nextIndex, next.title)}</p>
            </>
          )}
        </>
      ) : (
        <>
          <form action={enrolAction}>
            <input type="hidden" name="courseKey" value={course.key} />
            <input type="hidden" name="back" value={base} />
            <SubmitButton className="button">{t.enrol}</SubmitButton>
          </form>
          <p className="prog-next">{tc.notEnrolledNote}</p>
        </>
      )}
      <dl className="kv">
        <dt>{tc.kvVersion}</dt><dd>{version.version}</dd>
        {enrollment && (<><dt>{tc.kvEnrolled}</dt><dd>{formatDate(enrollment.enrolledAt, language)} · {tc.enrolledVia[enrollment.source]}</dd></>)}
        <dt>{tc.kvLanguage}</dt><dd>{languageName}</dd>
        {minutes && (<><dt>{tc.kvEstimate}</dt><dd>{t.minutes(minutes)}</dd></>)}
        <dt>{tc.kvCertificate}</dt><dd>{version.issuesCertificate ? tc.yes : tc.no}</dd>
        <dt>{tc.kvOrder}</dt><dd>{version.sequential ? tc.orderSequential : tc.orderAny}</dd>
      </dl>
    </aside>
  )

  return (
    <AppShell language={language} title={version.title}>
      <div className="cp" style={tenantStyle(brandingView(ctx.tenant))}>
        <Notice language={language} message={q.msg} error={q.error === "1"} back={base} />
        <header className="ch">
          <span className="ch-topic">{course.topicLabel}</span>
          <h1 className="page-title">{version.title}</h1>
          {version.subtitle && <p className="ch-sub">{version.subtitle}</p>}
          {course.smartTags.length > 0 && (
            <div className="lc-tags">
              {course.smartTags.map(tag => {
                const at = tag.label.indexOf(":")
                return (
                  <Link key={tagId(tag)} className="stag" href={`/learning?tag=${encodeURIComponent(tagId(tag))}`}>
                    <span className="stag-k">{tag.label.slice(0, at + 1)}</span>{tag.label.slice(at + 1).trim()}
                  </Link>
                )
              })}
            </div>
          )}
          <div className="ch-facts">
            {minutes && <span>{t.minutes(minutes)}</span>}
            <span>{t.parts(version.parts.length, required)}</span>
            <span>{tc.versionN(version.version)}</span>
            {enrollment && <span>{tc.enrolledSince(formatDate(enrollment.enrolledAt, language))}</span>}
          </div>
        </header>

        <div className="cp-grid">
          <div className="cp-main">
            {notices}
            {version.description && (
              <>
                <div className="cp-desc cp-desc--wide"><FormattedText text={version.description} /></div>
                <details className="lfd cp-desc--narrow">
                  <summary>{tc.aboutCourse}</summary>
                  <div className="lfd-body cp-desc" style={{ display: "block", paddingTop: 10 }}><FormattedText text={version.description} /></div>
                </details>
              </>
            )}
            <section className="card parts">
              <div className="parts-head">
                <h2>{tc.partsHeading}</h2>
                <span className="quiet">{t.parts(version.parts.length, required)} · {version.sequential ? tc.partsNoteSequential : tc.partsNoteAny}</span>
              </div>
              <ol className="pr-list">
                {progress.parts.map((p, i) => (
                  <PartRow key={p.part.key} p={p} index={i} parts={progress.parts} facts={facts} rows={testRows.get(p.part.key) ?? []}
                           href={enrollment ? `${base}/${p.part.key}` : null}
                           isNext={Boolean(next && next.key === p.part.key)} language={language} started={progress.started} />
                ))}
              </ol>
            </section>
          </div>
          {progressCard}
        </div>
      </div>
    </AppShell>
  )
}

function PartRow({ p, index, parts, facts, rows, href, isNext, language, started }: {
  p: PartProgress
  rows: PartTestRow[]
  index: number
  parts: PartProgress[]
  facts: ProgressFacts
  /** `null` = nezapísaný alebo zamknutá — názov nie je odkaz. */
  href: string | null
  isNext: boolean
  language: UiLanguage
  started: boolean
}) {
  const t = dictionary(language).learning
  const tc = t.course
  const n = index + 1
  const locked = p.state === "locked"
  const summary = partSummary(p.part)
  const pct = p.state === "in-progress" ? mustWatchPercent(p.part, facts) : null
  const after = unlocksAfter(parts, index)
  const link = href && !locked ? href : null
  const markClass = { done: "done", "in-progress": "prog", available: "", locked: "lock" }[p.state]

  return (
    <li className={`pr${isNext ? " is-next" : ""}`}>
      <span className={`pr-mark ${markClass}`} aria-hidden="true">
        {p.state === "done" ? "✓" : locked ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="2.5" y="5.5" width="7" height="5" rx="1" /><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" />
          </svg>
        ) : n}
      </span>
      {link
        ? <Link className="pr-title" href={link}>{n}. {p.part.title}</Link>
        : <span className={`pr-title${locked ? " is-locked" : ""}`}>{n}. {p.part.title}</span>}
      <span className={`pr-state${p.state === "done" ? " okc" : ""}`}>
        {isNext && link
          ? <Link className="button" href={link}>{started ? tc.continueHere : tc.startCourse}</Link>
          : p.state === "done" && p.evaluation.doneAt
            ? tc.partDoneOn(formatDate(p.evaluation.doneAt, language))
            : locked && after ? tc.partLockedAfter(after)
            : href ? tc.partAvailable : null}
      </span>
      <div className="pr-meta">
        <span className={p.part.required ? "tag" : "tag tag--archived"}>{p.part.required ? tc.partRequired : tc.partOptional}</span>
        <span>
          {[
            tc.blocks(summary.blocks),
            summary.mustWatchMinutes ? tc.mustWatchVideo(summary.mustWatchMinutes) : null,
            summary.types.length ? summary.types.map(x => tc.blockTypes[x]).join(", ") : null,
          ].filter(Boolean).join(" · ")}
          {p.state === "in-progress" && (
            <> · <span className="pr-prog">{pct !== null ? tc.partInProgressVideo(pct) : tc.partInProgress}</span></>
          )}
        </span>
      </div>
      {p.part.tests.length > 0 && (
        <div className="pr-tests">
          {p.part.tests.map(x => {
            const row = rows.find(r => r.testKey === x.testKey)
            const view = row && href ? testRowView(row, href, { ...t.attempt, notStarted: tc.testNotStarted, start: t.part.testStart }, new Date(), d => d.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" })) : null
            return (
              <div key={x.testKey} className="pt">
                <span className="pt-name"><span className="quiet">{tc.testLabel} · </span>{row?.test?.title ?? x.testKey}</span>
                <span className="pt-req">{x.required ? tc.testRequired : tc.testOptional}</span>
                {view && <span className={`pt-res tone-${view.tone}`}>{view.state}</span>}
                {view?.action && view.tone === "warn" && <Link className="lc-link" href={view.action.href}>{view.action.label}</Link>}
              </div>
            )
          })}
        </div>
      )}
    </li>
  )
}
