/**
 * Karta kurzu (rám LEARNING-moje-kurzy) — nový komponent modulu Vzdelávanie.
 *
 * Serverový komponent: všetko, čo ukazuje, je odvodené (D119) — postup,
 * „Ďalej: …", stav zápisu. Zapísanie je `<form method="post">`, funguje
 * bez JavaScriptu.
 */

import Link from "next/link"
import { estimatedMinutes, requiredParts } from "@/lib/courses"
import type { MyCourse } from "@/lib/enrollments"
import { learningHref, type LearningFilter } from "@/lib/learningFilters"
import { tagId } from "@/lib/smartTags"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import SubmitButton from "./SubmitButton"

export type CourseCardKind = "in-progress" | "assigned" | "open" | "done"

export default function CourseCard({
  item, kind, filter, language, enrolAction, certificateNumber,
}: {
  item: MyCourse
  kind: CourseCardKind
  filter: LearningFilter
  language: UiLanguage
  enrolAction: (form: FormData) => Promise<void>
  /** Číslo platného certifikátu, ak bol vydaný (rám LEARNING). */
  certificateNumber?: string | null
}) {
  const t = dictionary(language).learning
  const { course, version, enrollment, progress } = item
  const href = `/learning/${course.key}`
  const minutes = estimatedMinutes(version)
  const required = requiredParts(version).length
  const selected = new Set(filter.tags.map(tagId))
  const status = {
    "in-progress": ["tag tag--review", t.statusInProgress],
    assigned: ["tag tag--draft", t.statusAssigned],
    open: ["tag", t.statusOpen],
    done: ["tag tag--published", t.statusDone],
  }[kind]
  const next = progress?.nextPart
  const nextIndex = next ? version.parts.findIndex(p => p.key === next.key) + 1 : 0

  return (
    <article className={`card lc${kind === "done" ? " lc--done" : ""}`}>
      <div className="lc-top">
        <span className="lc-topic">{course.topicLabel}</span>
        <span className={status[0]}>{status[1]}</span>
      </div>
      <Link href={href} className="lc-title">{version.title}</Link>
      {course.smartTags.length > 0 && (
        <div className="lc-tags">
          {course.smartTags.map(tag => {
            const at = tag.label.indexOf(":")
            return (
              <Link key={tagId(tag)} href={learningHref(filter, { toggleTag: tag })}
                    className={`stag${selected.has(tagId(tag)) ? " is-on" : ""}`}>
                <span className="stag-k">{tag.label.slice(0, at + 1)}</span>{tag.label.slice(at + 1).trim()}
              </Link>
            )
          })}
        </div>
      )}
      <div className="lc-meta">
        {minutes && <span>{t.minutes(minutes)}</span>}
        <span>{t.parts(version.parts.length, required)}</span>
        {version.issuesCertificate && <span>{t.issuesCertificate}</span>}
      </div>
      {item.archived && <p className="lc-next" style={{ margin: 0 }}>{t.archivedNote}</p>}
      {kind === "in-progress" && progress && (
        <div className="lc-prog">
          <div className="lc-prog-row"><span>{t.progress(progress.requiredDone, progress.requiredTotal)}</span></div>
          <div className="lc-track" aria-hidden="true">
            <span style={{ width: `${progress.requiredTotal ? Math.round((progress.requiredDone / progress.requiredTotal) * 100) : 0}%` }} />
          </div>
        </div>
      )}
      <div className="lc-act">
        {kind === "in-progress" && (
          <>
            {/* Karty v zozname majú tiché tlačidlá (rozhodnutie R1, 6. 10. 2026). */}
            <Link href={next ? `${href}/${next.key}` : href} className="button button--quiet">{t.continue}</Link>
            {next && <span className="lc-next">{t.next(nextIndex, next.title)}</span>}
          </>
        )}
        {kind === "assigned" && enrollment && (
          <>
            <Link href={href} className="button button--quiet">{t.start}</Link>
            <span className="lc-next">
              {enrollment.assignedBy
                ? t.assignedOn(formatDate(enrollment.enrolledAt, language), enrollment.assignedBy.fullName)
                : t.assignedOnNoWho(formatDate(enrollment.enrolledAt, language))}
            </span>
          </>
        )}
        {kind === "open" && (
          <>
            <form action={enrolAction}>
              <input type="hidden" name="courseKey" value={course.key} />
              <SubmitButton className="button button--quiet">{t.enrol}</SubmitButton>
            </form>
            <span className="lc-next">{t.openNote}</span>
          </>
        )}
        {kind === "done" && (
          <>
            {certificateNumber
              ? <Link href={`${href}/certificate`} className="lc-link">{t.certificate}</Link>
              : <Link href={href} className="lc-link">{t.openCourse}</Link>}
            <span className="lc-next">
              {progress?.completedAt ? t.doneOn(formatDate(progress.completedAt, language)) : ""}
              {certificateNumber && <> · <code>{certificateNumber}</code></>}
              {!version.issuesCertificate && <> · {t.noCertificate}</>}
            </span>
          </>
        )}
      </div>
    </article>
  )
}
