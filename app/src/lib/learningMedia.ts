/**
 * Kto smie vidieť súbor kurzu (obrázok, galéria, video, plagát) — modul
 * Vzdelávanie (ADR-018, D122).
 *
 * Súbor sa servíruje len tomu, kto vidí kurz, v ktorom je použitý:
 * zapísanému, každému pri otvorenom zverejnenom kurze, a lektorovi
 * (`learning-admin`, aj koncepty). Identifikátor v GridFS sa dá uhádnuť —
 * samotná zhoda organizácie by pustila k videu z kurzu, do ktorého človek
 * nepatrí (D32).
 */

import { getCollection } from "./mongodb"
import { COURSES_COLLECTION, publishedVersion, type Course } from "./courses"
import { enrollmentFor } from "./enrollmentsDb"
import { QUESTIONS_COLLECTION } from "./questions"
import { TEST_ATTEMPTS_COLLECTION } from "./testAttempts"

/** Prípony súborov kurzu (obrázky, hotové video bez prekódovania, D122). */
export const COURSE_MEDIA_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm"] as const
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif"
export const VIDEO_ACCEPT = ".mp4,.webm"

/** Kurzy organizácie, v ktorých je súbor použitý (v ktorejkoľvek verzii). */
export async function coursesUsingFile(companyCode: string, fileId: string): Promise<Course[]> {
  return (await getCollection<Course>(COURSES_COLLECTION)).find({
    companyCode,
    $or: [
      { "versions.parts.blocks.fileId": fileId },
      { "versions.parts.blocks.items.fileId": fileId },
      { "versions.parts.blocks.source.assetId": fileId },
      { "versions.parts.blocks.posterFileId": fileId },
    ],
  }, { projection: { _id: 0 } }).toArray()
}

export async function canSeeCourseFile(
  person: { id: string; companyCode: string },
  isAdmin: boolean,
  fileId: string,
): Promise<boolean> {
  const courses = await coursesUsingFile(person.companyCode, fileId)
  if (!courses.length) return canSeeQuestionFile(person, isAdmin, fileId)
  if (isAdmin) return true
  for (const c of courses) {
    if (c.openEnrollment && publishedVersion(c)) return true
    const e = await enrollmentFor(person.companyCode, person.id, c.key)
    if (e && !e.cancelledAt) return true
  }
  return false
}

/**
 * Súbor z otázky (D120): lektor ho vidí, keď je v banke; ostatní len vtedy,
 * keď ho cituje snímka **ich** pokusu. Banku otázok bežný človek nevidí.
 */
async function canSeeQuestionFile(person: { id: string; companyCode: string }, isAdmin: boolean, fileId: string): Promise<boolean> {
  const media = { $or: [{ fileId }, { "source.assetId": fileId }] }
  if (isAdmin) {
    const inBank = await (await getCollection(QUESTIONS_COLLECTION)).countDocuments({
      companyCode: person.companyCode, $or: [{ media: { $elemMatch: media } }, { "answers.media.fileId": fileId }, { "answers.media.source.assetId": fileId }],
    })
    if (inBank) return true
  }
  const cited = await (await getCollection(TEST_ATTEMPTS_COLLECTION)).countDocuments({
    companyCode: person.companyCode, personId: person.id,
    $or: [{ "questions.media": { $elemMatch: media } }, { "questions.answers.media.fileId": fileId }, { "questions.answers.media.source.assetId": fileId }],
  })
  return cited > 0
}
