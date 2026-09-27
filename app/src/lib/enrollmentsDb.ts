/**
 * Zápisy v databáze (ADR-018, D122): samozápis, pridelenie adresátom,
 * zrušenie. Jedinečnosť (`companyCode`, `personId`, `courseKey`) stráži
 * index — druhý zápis toho istého človeka do toho istého kurzu **obnoví**
 * prvý, nevyrobí druhý (plán 4.6).
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { audienceMembers, audienceLabel, type Audience } from "./assignments"
import { publishedVersion } from "./courses"
import { getCourse, CourseError } from "./coursesDb"
import { ENROLLMENTS_COLLECTION, type Enrollment, type EnrollmentSource } from "./enrollments"
import type { Person } from "./persons"

async function enrollments() {
  return getCollection<Enrollment>(ENROLLMENTS_COLLECTION)
}

export async function enrollmentsForPerson(companyCode: string, personId: string): Promise<Enrollment[]> {
  return (await enrollments())
    .find({ companyCode, personId, cancelledAt: null }, { projection: { _id: 0 } })
    .toArray()
}

export async function enrollmentFor(companyCode: string, personId: string, courseKey: string): Promise<Enrollment | null> {
  return (await enrollments()).findOne({ companyCode, personId, courseKey }, { projection: { _id: 0 } })
}

export async function enrollmentsForCourse(companyCode: string, courseKey: string): Promise<Enrollment[]> {
  return (await enrollments()).find({ companyCode, courseKey }, { projection: { _id: 0 } }).toArray()
}

type EnrollPerson = Pick<Person, "id" | "email" | "fullName">

/**
 * Zapíše osobu do zverejnenej verzie. Existujúci aktívny zápis sa nemení
 * (človek pokračuje vo svojej verzii); zrušený sa obnoví. Vracia, či
 * vznikol nový zápis.
 */
async function enroll(
  companyCode: string,
  courseKey: string,
  person: EnrollPerson,
  source: EnrollmentSource,
  extra: Pick<Enrollment, "assignedBy" | "audience"> = {},
): Promise<{ enrollment: Enrollment; created: boolean }> {
  const course = await getCourse(companyCode, courseKey)
  if (!course) throw new CourseError("learning.courseNotFound", `Kurz „${courseKey}" neexistuje.`, { key: courseKey })
  const version = publishedVersion(course)
  if (!version) throw new CourseError("learning.notPublished", `Kurz „${courseKey}" nie je zverejnený.`, { key: courseKey })

  const col = await enrollments()
  const existing = await col.findOne({ companyCode, personId: person.id, courseKey }, { projection: { _id: 0 } })
  if (existing && !existing.cancelledAt) return { enrollment: existing, created: false }
  if (existing) {
    await col.updateOne(
      { companyCode, id: existing.id },
      { $set: { cancelledAt: null }, $unset: { cancelledBy: "", cancellationReason: "" } },
    )
    return { enrollment: { ...existing, cancelledAt: null }, created: false }
  }

  const enrollment: Enrollment = {
    id: crypto.randomUUID(),
    companyCode,
    personId: person.id,
    email: person.email.toLowerCase(),
    fullName: person.fullName,
    courseKey,
    versionId: version.versionId,
    courseTitle: version.title,
    enrolledAt: new Date(),
    source,
    ...extra,
    cancelledAt: null,
  }
  try {
    await col.insertOne({ ...enrollment })
  } catch (e) {
    // Súbežný druhý zápis — vyhral ten prvý, výsledok je ten istý.
    if ((e as { code?: number }).code === 11000) {
      const won = await col.findOne({ companyCode, personId: person.id, courseKey }, { projection: { _id: 0 } })
      if (won) return { enrollment: won, created: false }
    }
    throw e
  }
  return { enrollment, created: true }
}

/** Samozápis — len pri otvorenom zverejnenom kurze. */
export async function enrollSelf(companyCode: string, courseKey: string, person: EnrollPerson): Promise<Enrollment> {
  const course = await getCourse(companyCode, courseKey)
  if (!course?.openEnrollment) {
    throw new CourseError("learning.notOpen", `Do kurzu „${courseKey}" sa zapísať nedá — nie je otvorený.`, { key: courseKey })
  }
  const { enrollment, created } = await enroll(companyCode, courseKey, person, "self")
  if (created) {
    await writeAudit({ companyCode, subject: "enrollment", action: "created", actor: person.email, targetId: enrollment.id, targetLabel: `${person.fullName} · ${enrollment.courseTitle}`, note: "samozápis" })
  }
  return enrollment
}

/**
 * Pridelí kurz adresátom (všetci / oddelenie / skupina / trasa / osoba) —
 * ten istý výber ako pri norme (`audienceMembers`, jediné pravidlo
 * príslušnosti). Kto je v dvoch publikách, zapíše sa raz.
 */
export async function assignCourse(
  companyCode: string,
  courseKey: string,
  audiences: Audience[],
  actor: { email: string; fullName: string },
): Promise<{ created: number; existing: number }> {
  const seen = new Set<string>()
  let created = 0, existing = 0
  for (const audience of audiences) {
    for (const m of await audienceMembers(companyCode, audience)) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      const r = await enroll(companyCode, courseKey, m, "assignment", { assignedBy: actor, audience })
      if (r.created) created++
      else existing++
    }
  }
  await writeAudit({
    companyCode, subject: "enrollment", action: "assigned", actor: actor.email, targetId: courseKey,
    targetLabel: courseKey, note: `${audiences.map(audienceLabel).join(", ")} — nových ${created}, už zapísaných ${existing}`,
  })
  return { created, existing }
}

/** Zruší zápis (D24: `cancelledAt`, nie zmazanie). Udalosti postupu zostávajú. */
export async function cancelEnrollment(companyCode: string, id: string, actor: string, reason: string): Promise<boolean> {
  const text = reason.trim()
  if (!text) throw new CourseError("learning.reasonRequired", "Dôvod zrušenia zápisu je povinný.")
  const col = await enrollments()
  const before = await col.findOne({ companyCode, id, cancelledAt: null }, { projection: { _id: 0 } })
  if (!before) return false
  await col.updateOne({ companyCode, id }, { $set: { cancelledAt: new Date(), cancelledBy: actor, cancellationReason: text } })
  await writeAudit({ companyCode, subject: "enrollment", action: "revoked", actor, targetId: id, targetLabel: `${before.fullName} · ${before.courseTitle}`, note: text })
  return true
}
