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
  if (!courses.length) return false
  if (isAdmin) return true
  for (const c of courses) {
    if (c.openEnrollment && publishedVersion(c)) return true
    const e = await enrollmentFor(person.companyCode, person.id, c.key)
    if (e && !e.cancelledAt) return true
  }
  return false
}
