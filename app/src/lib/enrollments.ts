/**
 * Zápis do kurzu (ADR-018, D118, D122) — typy a rozdelenie „Moje kurzy".
 *
 * Zápis je udalosť, nie stav: vzniká **pridelením** adresátom (ako norma)
 * alebo **samozápisom** pri otvorenom kurze a nesie `versionId` v čase
 * zápisu — človek dokončuje to, do čoho sa zapísal. Nová verzia kurzu sa
 * mu potichu neponúkne. Zrušenie je `cancelledAt`, nie zmazanie (D24).
 */

import type { Audience } from "./assignments"
import { isArchived, publishedVersion, versionById, type Course, type CourseVersion } from "./courses"
import { courseProgress, type CourseProgress, type ProgressFacts } from "./learningProgress"
import { matchesSmartFilter, type SmartTag } from "./smartTags"

export const ENROLLMENTS_COLLECTION = "enrollments"

export type EnrollmentSource = "assignment" | "self"

export interface Enrollment {
  id: string
  companyCode: string
  personId: string
  email: string
  /** Kópia mena v čase zápisu. */
  fullName: string
  courseKey: string
  /** Verzia v čase zápisu (D118). */
  versionId: string
  /** Kópia názvu verzie — o rok čitateľné, do čoho sa zapísal. */
  courseTitle: string
  enrolledAt: Date
  source: EnrollmentSource
  /** Kto pridelil (rám LEARNING: „Pridelené 22. 9. · {kto}"). Len pri `assignment`. */
  assignedBy?: { email: string; fullName: string }
  /** Publikum, cez ktoré pridelenie prišlo. */
  audience?: Audience
  cancelledAt?: Date | null
  cancelledBy?: string
  cancellationReason?: string
}

export function isActiveEnrollment(e: Pick<Enrollment, "cancelledAt">): boolean {
  return !e.cancelledAt
}

/* ── „Moje kurzy" (rám LEARNING) ───────────────────────────────────────── */

export interface MyCourse {
  course: Course
  /** Verzia, ktorú človek vidí: zo zápisu, inak zverejnená. */
  version: CourseVersion
  enrollment: Enrollment | null
  progress: CourseProgress | null
  /** Kurz bol medzitým archivovaný — dokončiť sa dá (Q2 ✅). */
  archived: boolean
}

export interface MyCourses {
  inProgress: MyCourse[]
  /** Najprv pridelené nezačaté, potom otvorené, do ktorých zapísaný nie je. */
  toEnroll: MyCourse[]
  /** Najnovšie dokončené prvé. */
  done: MyCourse[]
}

/**
 * Rozdelenie kurzov na tri skupiny obrazovky `/learning` (D119: všetko
 * odvodené). `factsByEnrollment` sú udalosti postupu podľa `enrollment.id`.
 * `filter` sa uplatní na všetky skupiny (téma + smart:tagy, D117).
 */
export function groupMyCourses(input: {
  courses: Course[]
  enrollments: Enrollment[]
  factsByEnrollment: ReadonlyMap<string, ProgressFacts>
  filter?: { topicKey?: string; tags?: Pick<SmartTag, "key" | "value">[] }
}): MyCourses {
  const out: MyCourses = { inProgress: [], toEnroll: [], done: [] }
  const byKey = new Map(input.courses.map(c => [c.key, c]))
  const enrolled = new Set<string>()
  const passes = (c: Course) =>
    (!input.filter?.topicKey || c.topicKey === input.filter.topicKey) &&
    matchesSmartFilter(c.smartTags, input.filter?.tags ?? [])

  const assignedNew: MyCourse[] = []
  for (const e of input.enrollments.filter(isActiveEnrollment)) {
    const course = byKey.get(e.courseKey)
    if (!course) continue
    enrolled.add(course.key)
    const version = versionById(course, e.versionId)
    if (!version || !passes(course)) continue
    const progress = courseProgress(version, input.factsByEnrollment.get(e.id) ?? { completions: [], watches: [], passedTests: [] })
    const row: MyCourse = { course, version, enrollment: e, progress, archived: isArchived(course) }
    if (progress.done) out.done.push(row)
    else if (progress.started) out.inProgress.push(row)
    else assignedNew.push(row)
  }

  // Otvorený kurz sa ponúkne len zverejnený — archivovaný sa v „Na zápis"
  // neponúka (Q2 ✅), rozpracovaný archivovaný zostáva vyššie.
  const open: MyCourse[] = input.courses
    .filter(c => c.openEnrollment && !enrolled.has(c.key) && passes(c))
    .flatMap(c => {
      const version = publishedVersion(c)
      return version ? [{ course: c, version, enrollment: null, progress: null, archived: false }] : []
    })

  out.toEnroll = [
    ...assignedNew.sort((a, b) => b.enrollment!.enrolledAt.getTime() - a.enrollment!.enrolledAt.getTime()),
    ...open.sort((a, b) => a.course.title.localeCompare(b.course.title, "sk")),
  ]
  out.inProgress.sort((a, b) => a.course.title.localeCompare(b.course.title, "sk"))
  out.done.sort((a, b) => b.progress!.completedAt!.getTime() - a.progress!.completedAt!.getTime())
  return out
}
