/**
 * Kurzy v databáze (ADR-018, D118) — založenie, koncept, zverejnenie,
 * nová verzia, archív. Pravidlá sú v `courses.ts`, tu je len zápis.
 *
 * Každý dotaz nesie `companyCode` v podmienke (D32). Zverejnená verzia sa
 * nemení: zápis do konceptu má v podmienke `versions.state: "draft"`, takže
 * aj súbežné zverejnenie nemôže skončiť úpravou toho, čo už ľudia vidia.
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import {
  COURSES_COLLECTION, COURSE_KEY, draftFrom, draftVersion, nextVersionNumber, publishedVersion, publishProblems,
  type Course, type CourseVersion, type PublishProblem,
} from "./courses"
import type { SmartTag } from "./smartTags"

export class CourseError extends AppError {}

async function courses() {
  return getCollection<Course>(COURSES_COLLECTION)
}

export async function getCourse(companyCode: string, key: string): Promise<Course | null> {
  return (await courses()).findOne({ companyCode, key }, { projection: { _id: 0 } })
}

/** Všetky kurzy organizácie, zoradené podľa názvu. */
export async function listCourses(companyCode: string): Promise<Course[]> {
  const list = await (await courses()).find({ companyCode }, { projection: { _id: 0 } }).toArray()
  return list.sort((a, b) => a.title.localeCompare(b.title, "sk"))
}

export interface NewCourse {
  companyCode: string
  key: string
  title: string
  topicKey: string
  topicLabel: string
  language: string
  actor: string
}

/** Založí kurz s prázdnym konceptom verzie 1. */
export async function createCourse(input: NewCourse): Promise<Course> {
  const key = input.key.trim().toLowerCase()
  if (!COURSE_KEY.test(key)) {
    throw new CourseError("learning.courseKeyShape", `Kľúč kurzu „${key}" nemá správny tvar.`, { key })
  }
  const title = input.title.trim()
  if (!title) throw new CourseError("learning.titleRequired", "Názov kurzu je povinný.")

  const at = new Date()
  const course: Course = {
    companyCode: input.companyCode,
    key,
    title,
    topicKey: input.topicKey,
    topicLabel: input.topicLabel,
    smartTags: [],
    language: input.language,
    openEnrollment: false,
    versions: [{
      versionId: crypto.randomUUID(),
      version: 1,
      state: "draft",
      title,
      sequential: false,
      parts: [],
      issuesCertificate: false,
      createdAt: at,
      createdBy: input.actor,
    }],
    createdAt: at,
    createdBy: input.actor,
  }
  try {
    await (await courses()).insertOne({ ...course })
  } catch (e) {
    // Unikátny index (companyCode, key) — súbežné založenie toho istého kľúča.
    if ((e as { code?: number }).code === 11000) {
      throw new CourseError("learning.courseKeyTaken", `Kurz s kľúčom „${key}" už existuje.`, { key })
    }
    throw e
  }
  await writeAudit({ companyCode: input.companyCode, subject: "course", action: "created", actor: input.actor, targetId: key, targetLabel: title })
  return course
}

/** Čo sa dá meniť na koncepte. Stav, číslo a údaje o zverejnení nie. */
export type DraftPatch = Partial<Pick<CourseVersion,
  "title" | "subtitle" | "description" | "estimatedMinutes" | "sequential" | "parts" |
  "issuesCertificate" | "issuer" | "legalBasisKey" | "legalBasisLabel" | "changeNote">>

export async function saveDraft(companyCode: string, key: string, patch: DraftPatch, actor: string): Promise<void> {
  const set: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(patch)) {
    if (value !== undefined) set[`versions.$[d].${field}`] = value
  }
  if (Object.keys(set).length === 0) return
  const at = new Date()
  set["versions.$[d].updatedAt"] = at
  set["versions.$[d].updatedBy"] = actor
  set.updatedAt = at
  const r = await (await courses()).updateOne(
    { companyCode, key, "versions.state": "draft" },
    { $set: set },
    { arrayFilters: [{ "d.state": "draft" }] },
  )
  if (r.matchedCount === 0) {
    throw new CourseError("learning.noDraft", `Kurz „${key}" nemá koncept — zverejnená verzia sa nemení.`, { key })
  }
}

/** Nastavenia kurzu mimo verzie: téma, smart:tagy, samozápis. */
export async function saveCourseSettings(
  companyCode: string,
  key: string,
  change: { topicKey?: string; topicLabel?: string; smartTags?: SmartTag[]; openEnrollment?: boolean },
  actor: string,
): Promise<void> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  for (const [field, value] of Object.entries(change)) if (value !== undefined) set[field] = value
  const before = await getCourse(companyCode, key)
  if (!before) throw new CourseError("learning.courseNotFound", `Kurz „${key}" neexistuje.`, { key })
  await (await courses()).updateOne({ companyCode, key }, { $set: set })
  await writeAudit({
    companyCode, subject: "course", action: "changed", actor, targetId: key, targetLabel: before.title,
    changes: Object.fromEntries(Object.entries(change).map(([f, to]) => [f, { from: (before as unknown as Record<string, unknown>)[f], to }])),
  })
}

export type PublishResult = { ok: true; version: CourseVersion } | { ok: false; problems: PublishProblem[] }

/**
 * Zverejní koncept. Predošlá zverejnená verzia sa **archivuje** — nové
 * zápisy idú do novej, ale kto je zapísaný do starej, dokončuje starú
 * (D118). `readyTests` = kľúče testov v stave `ready` a ich verzie (L2).
 */
export async function publishCourse(
  companyCode: string,
  key: string,
  actor: string,
  readyTests: ReadonlyMap<string, number> = new Map(),
): Promise<PublishResult> {
  const course = await getCourse(companyCode, key)
  if (!course) throw new CourseError("learning.courseNotFound", `Kurz „${key}" neexistuje.`, { key })
  const draft = draftVersion(course)
  if (!draft) throw new CourseError("learning.noDraft", `Kurz „${key}" nemá koncept na zverejnenie.`, { key })
  const problems = publishProblems(draft, new Set(readyTests.keys()))
  if (problems.length) return { ok: false, problems }

  const at = new Date()
  // Zmrazenie verzií testov (D118): zmena testu neprepíše, čo ľudia robili.
  const parts = draft.parts.map(p => ({ ...p, tests: p.tests.map(t => ({ ...t, testVersion: readyTests.get(t.testKey) })) }))
  const previous = publishedVersion(course)
  // Jeden zápis: archivovanie predošlej a zverejnenie novej sa nesmú
  // rozísť — kurz by inak po výpadku zostal bez zverejnenej verzie.
  const set: Record<string, unknown> = {
    "versions.$[d].state": "published",
    "versions.$[d].publishedAt": at,
    "versions.$[d].publishedBy": actor,
    "versions.$[d].parts": parts,
    title: draft.title,
    updatedAt: at,
  }
  const arrayFilters: Record<string, unknown>[] = [{ "d.versionId": draft.versionId }]
  if (previous) {
    Object.assign(set, { "versions.$[p].state": "archived", "versions.$[p].archivedAt": at, "versions.$[p].archivedBy": actor })
    arrayFilters.push({ "p.versionId": previous.versionId })
  }
  const r = await (await courses()).updateOne(
    { companyCode, key, versions: { $elemMatch: { versionId: draft.versionId, state: "draft" } } },
    { $set: set },
    { arrayFilters },
  )
  if (r.matchedCount === 0) throw new CourseError("learning.noDraft", `Koncept kurzu „${key}" sa medzitým zmenil.`, { key })
  await writeAudit({
    companyCode, subject: "course", action: "published", actor, targetId: key, targetLabel: draft.title,
    note: `verzia ${draft.version}${previous ? `, predošlá ${previous.version} archivovaná` : ""}`,
  })
  return { ok: true, version: { ...draft, parts, state: "published", publishedAt: at, publishedBy: actor } }
}

/** Nový koncept z poslednej zverejnenej (alebo archivovanej) verzie. */
export async function startNewVersion(companyCode: string, key: string, actor: string): Promise<CourseVersion> {
  const course = await getCourse(companyCode, key)
  if (!course) throw new CourseError("learning.courseNotFound", `Kurz „${key}" neexistuje.`, { key })
  if (draftVersion(course)) throw new CourseError("learning.draftExists", `Kurz „${key}" už koncept má.`, { key })
  const base = publishedVersion(course) ?? [...course.versions].sort((a, b) => b.version - a.version)[0]
  const draft = draftFrom(base, { versionId: crypto.randomUUID(), version: nextVersionNumber(course), at: new Date(), actor })
  // Podmienka „žiadny koncept" aj v zápise — dva súbežné kliky nevyrobia dva.
  const r = await (await courses()).updateOne(
    { companyCode, key, "versions.state": { $ne: "draft" } },
    { $push: { versions: draft } },
  )
  if (r.matchedCount === 0) throw new CourseError("learning.draftExists", `Kurz „${key}" už koncept má.`, { key })
  await writeAudit({ companyCode, subject: "course", action: "course-version", actor, targetId: key, targetLabel: course.title, note: `verzia ${draft.version}` })
  return draft
}

/**
 * Archivuje zverejnenú verziu: kurz sa už nikomu neponúkne, ale kto je
 * zapísaný, dokončiť ho môže (rám LEARNING, Q2 ✅).
 */
export async function archiveCourse(companyCode: string, key: string, actor: string): Promise<void> {
  const course = await getCourse(companyCode, key)
  if (!course) throw new CourseError("learning.courseNotFound", `Kurz „${key}" neexistuje.`, { key })
  const current = publishedVersion(course)
  if (!current) throw new CourseError("learning.notPublished", `Kurz „${key}" nemá zverejnenú verziu.`, { key })
  const at = new Date()
  await (await courses()).updateOne(
    { companyCode, key },
    { $set: { "versions.$[p].state": "archived", "versions.$[p].archivedAt": at, "versions.$[p].archivedBy": actor, updatedAt: at } },
    { arrayFilters: [{ "p.versionId": current.versionId, "p.state": "published" }] },
  )
  await writeAudit({ companyCode, subject: "course", action: "archived", actor, targetId: key, targetLabel: course.title, note: `verzia ${current.version}` })
}
