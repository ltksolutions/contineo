/**
 * Počty zapísaných a dokončených na kurz (rám MANAGE) — **počty, nie skóre**
 * (D121). Dokončenie sa odvodzuje z udalostí rovnako ako u študenta (D119).
 */

import { getCollection } from "./mongodb"
import { versionById, type Course } from "./courses"
import { ENROLLMENTS_COLLECTION, type Enrollment } from "./enrollments"
import { courseProgress } from "./learningProgress"
import { progressFactsMany } from "./learningProgressDb"

export interface CourseStats { enrolled: number; completed: number }

export async function courseStats(companyCode: string, courses: Course[]): Promise<Map<string, CourseStats>> {
  const enrollments = await (await getCollection<Enrollment>(ENROLLMENTS_COLLECTION))
    .find({ companyCode, cancelledAt: null }, { projection: { _id: 0 } }).toArray()
  const facts = await progressFactsMany(companyCode, enrollments.map(e => e.id))
  const byKey = new Map(courses.map(c => [c.key, c]))
  const out = new Map<string, CourseStats>(courses.map(c => [c.key, { enrolled: 0, completed: 0 }]))
  for (const e of enrollments) {
    const c = byKey.get(e.courseKey)
    const s = out.get(e.courseKey)
    if (!c || !s) continue
    s.enrolled++
    const v = versionById(c, e.versionId)
    if (v && courseProgress(v, facts.get(e.id) ?? { completions: [], watches: [], passedTests: [] }).done) s.completed++
  }
  return out
}
