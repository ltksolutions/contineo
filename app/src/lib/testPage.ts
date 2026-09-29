/**
 * Spoločné načítanie pre stránky testu v kurze (úvod, pokus, výsledok):
 * brána modulu, zápis, časť, test v časti a jeho stav. Jedno miesto
 * pravidiel „kto sa k testu dostane" — zamknutá časť alebo nezapísaný
 * človek sa vráti na prehľad kurzu (ako pri časti).
 */

import { learningContext } from "./learning"
import { getCourse } from "./coursesDb"
import { enrollmentFor } from "./enrollmentsDb"
import { progressFacts } from "./learningProgressDb"
import { versionById, type Part } from "./courses"
import { courseProgress } from "./learningProgress"
import { partTestRows, type PartTestRow } from "./testAttemptsDb"
import type { Enrollment } from "./enrollments"
import type { UiLanguage } from "./i18n"

export type TestContext =
  | { state: "not-signed-in" }
  | { state: "not-found" }
  | { state: "back"; to: string }
  | {
      state: "ready"
      companyCode: string
      personId: string
      language: UiLanguage
      courseKey: string
      partKey: string
      part: Part
      enrollment: Enrollment
      row: PartTestRow
      base: string
      partHref: string
      /** Názvy krokov cesty nad testom — kurz, časť, test (SHELL-rozcestnik). */
      trail: Record<string, string>
    }

export async function loadTestContext(p: { courseKey: string; partKey: string; testKey: string }): Promise<TestContext> {
  const ctx = await learningContext()
  if (ctx.state === "not-signed-in") return { state: "not-signed-in" }
  if (ctx.state !== "ready") return { state: "not-found" }
  const courseKey = decodeURIComponent(p.courseKey), partKey = decodeURIComponent(p.partKey), testKey = decodeURIComponent(p.testKey)
  const companyCode = ctx.person.companyCode
  const course = await getCourse(companyCode, courseKey)
  if (!course) return { state: "not-found" }
  const enrollment = await enrollmentFor(companyCode, ctx.person.id, courseKey)
  if (!enrollment || enrollment.cancelledAt) return { state: "back", to: `/learning/${course.key}` }
  const version = versionById(course, enrollment.versionId)
  const part = version?.parts.find(x => x.key === partKey)
  if (!version || !part || !part.tests.some(t => t.testKey === testKey)) return { state: "not-found" }
  const state = courseProgress(version, await progressFacts(companyCode, enrollment.id)).parts.find(x => x.part.key === partKey)?.state
  if (state === "locked") return { state: "back", to: `/learning/${course.key}` }
  const row = (await partTestRows(enrollment, { key: part.key, tests: part.tests.filter(t => t.testKey === testKey) }))[0]
  if (!row.test || !row.rules) return { state: "not-found" }
  const partHref = `/learning/${course.key}/${part.key}`
  return {
    state: "ready", companyCode, personId: ctx.person.id, language: ctx.person.language, courseKey: course.key, partKey: part.key, part,
    enrollment, row, base: `${partHref}/test/${testKey}`, partHref,
    trail: {
      [`/learning/${course.key}`]: version.title,
      [partHref]: part.title,
      [`${partHref}/test/${testKey}`]: row.test.title ?? testKey,
    },
  }
}
