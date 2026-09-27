/**
 * Počty zapísaných a dokončených na kurz (rám MANAGE) — **počty, nie skóre**
 * (D121). Dokončenie sa odvodzuje z udalostí rovnako ako u študenta (D119).
 */

import { getCollection } from "./mongodb"
import { versionById, type Course } from "./courses"
import { ENROLLMENTS_COLLECTION, type Enrollment } from "./enrollments"
import { courseProgress } from "./learningProgress"
import { progressFactsMany } from "./learningProgressDb"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { allDepartments } from "./departments"

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

export type RosterState = "not-started" | "in-progress" | "done"

export interface RosterRow {
  enrollment: Enrollment
  department: string | null
  state: RosterState
  requiredDone: number
  requiredTotal: number
  completedAt: Date | null
  /** Posledná udalosť: dokončenie časti, sledovanie videa alebo zápis. */
  lastActivity: Date
}

/**
 * Zapísaní do kurzu (MANAGE-COURSE, `?tab=people`) — stav odvodený ako
 * u študenta (D119), **bez skóre** (D121). Oddelenie z `departmentId`
 * osoby, inak jej pôvodný textový zápis.
 */
export async function courseRoster(companyCode: string, course: Course): Promise<RosterRow[]> {
  const enrollments = await (await getCollection<Enrollment>(ENROLLMENTS_COLLECTION))
    .find({ companyCode, courseKey: course.key, cancelledAt: null }, { projection: { _id: 0 } }).toArray()
  const facts = await progressFactsMany(companyCode, enrollments.map(e => e.id))
  const people = await (await getCollection<Pick<Person, "id" | "departmentId" | "department">>(PERSONS_COLLECTION))
    .find({ companyCode, id: { $in: enrollments.map(e => e.personId) } }, { projection: { _id: 0, id: 1, departmentId: 1, department: 1 } }).toArray()
  const deps = new Map((await allDepartments(companyCode)).map(d => [d.id, d.name]))
  return enrollments.map((e): RosterRow => {
    const f = facts.get(e.id) ?? { completions: [], watches: [], passedTests: [] }
    const v = versionById(course, e.versionId)
    const p = v ? courseProgress(v, f) : null
    const person = people.find(x => x.id === e.personId)
    const times = [e.enrolledAt, ...f.completions.map(c => c.at), ...f.watches.map(w => w.updatedAt)].map(d => d.getTime())
    return {
      enrollment: e,
      department: (person?.departmentId && deps.get(person.departmentId)) || person?.department || null,
      state: p?.done ? "done" : p?.started ? "in-progress" : "not-started",
      requiredDone: p?.requiredDone ?? 0,
      requiredTotal: p?.requiredTotal ?? 0,
      completedAt: p?.completedAt ?? null,
      lastActivity: new Date(Math.max(...times)),
    }
  }).sort((a, b) => a.enrollment.fullName.localeCompare(b.enrollment.fullName, "sk"))
}
