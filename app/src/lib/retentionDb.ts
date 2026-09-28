/**
 * Retenčná dávka (ADR-012, D101, D102) — výmaz reťaze dôkazov po lehote.
 * Od ADR-021 aj záznamy vzdelávania (D130) a orezanie ich podrobností
 * rok po dokončení kurzu (D131). **Certifikátov sa nedotýka** (D132).
 *
 * **Jediná cesta, ktorou doklad zaniká.** Mimo tejto dávky a rozhodnutia
 * o námietke (D105) platí D24 ďalej: záznam sa nemení ani nemaže.
 *
 * Režim `report` (predvolený) nič nemaže — len spočíta, čo by sa zmazalo.
 * Počty sú v oboch režimoch rovnaké, takže výkaz je presne to, čo neskôr
 * spraví `delete`.
 */

import type { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import { DOCUMENT_OPENS_COLLECTION } from "./documentOpens"
import { ASSIGNMENTS_COLLECTION } from "./assignments"
import { READING_COLLECTION } from "./readingTime"
import { APPROVALS_COLLECTION } from "./approvals"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "./documents"
import { OBJECTIONS_COLLECTION } from "./objections"
import { ENROLLMENTS_COLLECTION, type Enrollment } from "./enrollments"
import { PART_COMPLETIONS_COLLECTION, VIDEO_WATCH_COLLECTION, courseProgress } from "./learningProgress"
import { TEST_ATTEMPTS_COLLECTION } from "./testAttempts"
import { COURSES_COLLECTION, versionById, type Course } from "./courses"
import { progressFactsMany } from "./learningProgressDb"
import {
  retentionDecision, isStaleActive, learningDetailsDue, addMonths, RETENTION_LOG_DAYS, LEARNING_DETAIL_MONTHS,
  type RetentionBasis, type RetentionMode,
} from "./retention"

export const RETENTION_LOG_COLLECTION = "retention_log"

/** `details` = orezanie podrobností vzdelávania po roku (ADR-021, D131). */
export type DeletionReason = RetentionBasis | "objection" | "details"

export interface DeletionCounts {
  acknowledgements: number
  documentOpens: number
  readingTimes: number
  assignments: number
  approvalRounds: number
  responsibleCleared: number
  /** Námietky osoby — osobný údaj, maže sa s ostatnými dokladmi (D105). */
  objections: number
  /** Vzdelávanie (ADR-021, D130) — certifikáty sa nemažú (D132). */
  enrollments: number
  partCompletions: number
  videoWatch: number
  testAttempts: number
}

const ZERO: DeletionCounts = {
  acknowledgements: 0, documentOpens: 0, readingTimes: 0,
  assignments: 0, approvalRounds: 0, responsibleCleared: 0, objections: 0,
  enrollments: 0, partCompletions: 0, videoWatch: 0, testAttempts: 0,
}

/** Kolekcie vzdelávania osoby, ktoré maže lehota (D130). */
const LEARNING_COLLECTIONS = [
  [ENROLLMENTS_COLLECTION, "enrollments"],
  [PART_COMPLETIONS_COLLECTION, "partCompletions"],
  [VIDEO_WATCH_COLLECTION, "videoWatch"],
  [TEST_ATTEMPTS_COLLECTION, "testAttempts"],
] as const

const total = (c: DeletionCounts) => Object.values(c).reduce((a, b) => a + b, 0)

type PersonForRetention = Pick<Person, "id" | "companyCode" | "email" | "status" | "emailHistory"> & {
  endedAt?: Date | null
  deactivatedAt?: Date | null
}

/** Všetky adresy osoby — pridelenie osobe nesie adresu platnú v čase pridelenia. */
function emailsOf(p: PersonForRetention): Set<string> {
  return new Set(
    [p.email, ...(p.emailHistory ?? []).map(h => h.email)]
      .filter(Boolean)
      .map(e => e.trim().toLowerCase()),
  )
}

/**
 * Posledná udalosť v reťazi **každej osoby organizácie naraz** — pre strop
 * pri vyradených bez dátumu a pre výpis aktívnych bez udalosti (D100).
 *
 * Tri agregácie na organizáciu, nie tri dotazy na osobu: dávka beží denne
 * a osôb môžu byť desaťtisíce.
 */
async function lastEvents(companyCode: string, people: PersonForRetention[]): Promise<Map<string, Date>> {
  const acks = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const opens = await getCollection(DOCUMENT_OPENS_COLLECTION)
  const assignments = await getCollection(ASSIGNMENTS_COLLECTION)
  const byPersonMax = async (name: string, field: string) =>
    (await getCollection(name)).aggregate([
      { $match: { companyCode } },
      { $group: { _id: "$personId", last: { $max: `$${field}` } } },
    ]).toArray()

  // Vzdelávanie je tiež udalosť (D130): kto pred rokom robil test, nie je
  // „bez udalosti 5 rokov".
  const learning = await Promise.all([
    byPersonMax(ENROLLMENTS_COLLECTION, "enrolledAt"),
    byPersonMax(PART_COMPLETIONS_COLLECTION, "at"),
    byPersonMax(TEST_ATTEMPTS_COLLECTION, "startedAt"),
  ])

  const [byAck, byOpen, byAssignment] = await Promise.all([
    acks.aggregate([
      { $match: { companyCode } },
      { $group: { _id: "$personId", last: { $max: "$acknowledgedAt" } } },
    ]).toArray(),
    opens.aggregate([
      { $match: { companyCode } },
      { $group: { _id: "$personId", last: { $max: "$firstOpenedAt" } } },
    ]).toArray(),
    assignments.aggregate([
      { $match: { companyCode, "audience.kind": "person" } },
      { $group: { _id: { $toLower: "$audience.value" }, last: { $max: "$assignedAt" } } },
    ]).toArray(),
  ])

  const latest = new Map<string, Date>()
  const bump = (key: string, d: unknown) => {
    if (!(d instanceof Date)) return
    const prev = latest.get(key)
    if (!prev || prev.getTime() < d.getTime()) latest.set(key, d)
  }
  for (const r of byAck) bump(String(r._id), r.last)
  for (const r of byOpen) bump(String(r._id), r.last)
  for (const rows of learning) for (const r of rows) bump(String(r._id), r.last)
  const byEmail = new Map(byAssignment.map(r => [String(r._id).trim(), r.last as Date]))
  for (const p of people) {
    for (const e of emailsOf(p)) bump(p.id, byEmail.get(e))
  }
  return latest
}

/**
 * Pridelenia **osobe** (`audience.kind = person`). Pridelenie skupine,
 * útvaru alebo trase sa týka mnohých a zostáva (D101). Porovnanie adresy je
 * bez ohľadu na veľkosť písmen, rovnako ako `matchesAudience()`.
 */
async function personAssignments(
  companyCode: string,
  p: PersonForRetention,
  projection: Record<string, 1>,
): Promise<Record<string, unknown>[]> {
  const col = await getCollection(ASSIGNMENTS_COLLECTION)
  const emails = emailsOf(p)
  const rows = await col
    .find({ companyCode, "audience.kind": "person" }, { projection: { ...projection, audience: 1, subject: 1 } })
    .toArray()
  return rows.filter(a => emails.has(String((a.audience as { value?: string })?.value ?? "").trim().toLowerCase()))
}

/**
 * Zmaže (alebo v režime `report` len spočíta) doklady osoby.
 *
 * `versions` obmedzí výmaz na vybrané znenia (`documentId|versionId`) —
 * pri vyhovenej námietke len znenia s oprávneným záujmom (D105).
 *
 * Kolo schvaľovania a zodpovedná osoba znenia sa zmažú, keď po výmaze
 * nezostane **žiadny** doklad o oboznámení so znením **a** znenie už neplatí
 * (B4a, B11). Platné znenie si kolá drží vždy — jeho stav sa z nich odvodzuje
 * (D27) a bez nich by vyzeralo ako neschválené.
 */
export async function deletePersonEvidence(
  person: PersonForRetention,
  reason: DeletionReason,
  mode: RetentionMode,
  now: Date = new Date(),
  versions?: Set<string>,
): Promise<DeletionCounts> {
  const companyCode = person.companyCode
  const dry = mode !== "delete"
  const inScope = (documentId: unknown, versionId: unknown) =>
    !versions || versions.has(`${String(documentId)}|${String(versionId)}`)

  const acksCol = await getCollection(ACKNOWLEDGEMENTS_COLLECTION)
  const opensCol = await getCollection(DOCUMENT_OPENS_COLLECTION)
  const readingCol = await getCollection(READING_COLLECTION)
  const assignCol = await getCollection(ASSIGNMENTS_COLLECTION)

  const acks = (await acksCol
    .find({ companyCode, personId: person.id }, { projection: { _id: 1, documentId: 1, versionId: 1 } })
    .toArray()).filter(a => inScope(a.documentId, a.versionId))
  const opens = (await opensCol
    .find({ companyCode, personId: person.id }, { projection: { _id: 1, documentId: 1, versionId: 1 } })
    .toArray()).filter(o => inScope(o.documentId, o.versionId))
  const reading = (await readingCol
    .find({ companyCode, personId: person.id }, { projection: { _id: 1, documentId: 1, versionId: 1 } })
    .toArray()).filter(r => inScope(r.documentId, r.versionId))
  const own = (await personAssignments(companyCode, person, { _id: 1 }))
    .filter(a => {
      const s = a.subject as { documentId?: string; versionId?: string } | undefined
      return inScope(s?.documentId, s?.versionId)
    })

  // Námietky sa mažú len s lehotou, nie pri vyhovení námietky — tá musí
  // zostať ako doklad, že sa o nej rozhodlo a čo sa zmazalo.
  const objectionsCol = await getCollection(OBJECTIONS_COLLECTION)
  const objections = reason === "objection" || versions
    ? []
    : await objectionsCol.find({ companyCode, personId: person.id }, { projection: { _id: 1 } }).toArray()

  const counts: DeletionCounts = {
    ...ZERO,
    acknowledgements: acks.length,
    documentOpens: opens.length,
    readingTimes: reading.length,
    assignments: own.length,
    objections: objections.length,
  }

  // Vzdelávanie (D130) len s lehotou — námietka sa týka predpisov
  // (oprávnený záujem pri znení), nie kurzov. Certifikáty zostávajú (D132).
  if (reason !== "objection" && !versions) {
    for (const [name, key] of LEARNING_COLLECTIONS) {
      const col = await getCollection(name)
      const filter = { companyCode, personId: person.id }
      counts[key] = await col.countDocuments(filter)
      if (!dry && counts[key]) await col.deleteMany(filter)
    }
  }

  // Znenia, ktorých sa výmaz dotkol — kandidáti na zmazanie kôl (B4a).
  const touched = new Map<string, { documentId: string; versionId: string }>()
  for (const a of acks) {
    touched.set(`${a.documentId}|${a.versionId}`, { documentId: String(a.documentId), versionId: String(a.versionId) })
  }

  if (!dry) {
    const ids = (rows: { _id: unknown }[]) => ({ _id: { $in: rows.map(r => r._id as ObjectId) } })
    // Organizácia v každej podmienke (D32), aj keď `_id` stačí.
    if (acks.length) await acksCol.deleteMany({ companyCode, ...ids(acks) })
    if (opens.length) await opensCol.deleteMany({ companyCode, ...ids(opens) })
    if (reading.length) await readingCol.deleteMany({ companyCode, ...ids(reading) })
    if (own.length) await assignCol.deleteMany({ companyCode, ...ids(own as { _id: unknown }[]) })
    if (objections.length) await objectionsCol.deleteMany({ companyCode, ...ids(objections) })
  }

  // Kolá a zodpovedná osoba pri zneniach, o ktorých už nie je žiadny doklad.
  const rounds = await getCollection(APPROVALS_COLLECTION)
  const docs = await getCollection<DocumentRecord>(DOCUMENTS_COLLECTION)
  for (const { documentId, versionId } of touched.values()) {
    const remaining = await acksCol.countDocuments({
      companyCode, documentId, versionId,
      // V režime výkazu ešte existujú aj záznamy tejto osoby — nerátajú sa.
      ...(dry ? { personId: { $ne: person.id } } : {}),
    })
    if (remaining > 0) continue

    const doc = await docs.findOne({ companyCode, documentId })
    const current = doc ? effectiveVersion(doc, now) : null
    if (current?.ok && current.version.versionId === versionId) continue

    counts.approvalRounds += await rounds.countDocuments({ companyCode, documentId, versionId })
    const v = doc?.versions?.find(x => x.versionId === versionId) as
      { responsiblePerson?: unknown; responsibleChanges?: unknown[] } | undefined
    const hasResponsible = Boolean(v?.responsiblePerson || v?.responsibleChanges?.length)
    if (hasResponsible) counts.responsibleCleared++

    if (!dry) {
      await rounds.deleteMany({ companyCode, documentId, versionId })
      if (hasResponsible) {
        await docs.updateOne(
          { companyCode, documentId },
          { $unset: { "versions.$[v].responsiblePerson": "", "versions.$[v].responsibleChanges": "" } },
          { arrayFilters: [{ "v.versionId": versionId }] },
        )
      }
    }
  }

  if (!dry && total(counts) > 0) await logDeletion(companyCode, person.id, reason, counts, now)
  return counts
}

let logIndexReady: Promise<unknown> | null = null

/**
 * Záznam o výmaze (D102) — na zopakovanie po obnove zo zálohy. Bez mena
 * a adresy: `personId` stačí, osoba po výmaze dokladov ešte existuje.
 */
async function logDeletion(
  companyCode: string,
  personId: string,
  reason: DeletionReason,
  counts: DeletionCounts,
  at: Date,
): Promise<void> {
  const col = await getCollection(RETENTION_LOG_COLLECTION)
  logIndexReady ??= col.createIndex(
    { at: 1 },
    { name: "retention_log_ttl", expireAfterSeconds: RETENTION_LOG_DAYS * 24 * 3600 },
  ).catch(e => { logIndexReady = null; throw e })
  await logIndexReady
  await col.insertOne({ companyCode, personId, reason, counts, at })
}

export interface LearningDetailsCounts {
  /** Zápisy dokončených kurzov, ktorým sa podrobnosti orezali. */
  enrollments: number
  /** Pokusy, z ktorých zmizli otázky a odpovede. */
  testAttempts: number
  /** Sledovania, z ktorých zmizli úseky (dopozerané — ostáva `reachedAt`). */
  videoWatchTrimmed: number
  /** Sledovania, ktoré hranicu neprekročili — nič nedokazujú, mažú sa. */
  videoWatchDeleted: number
}

export interface RetentionRun {
  companyCode: string
  mode: RetentionMode
  /** Osoby, ktorým lehota uplynula a mali čo zmazať. */
  persons: { personId: string; basis: RetentionBasis; counts: DeletionCounts }[]
  /** Aktívne osoby bez udalosti 5 rokov — na kontrolu HR, nič sa nemaže. */
  staleActive: number
  /** Orezanie podrobností vzdelávania rok po dokončení kurzu (D131). */
  learningDetails: LearningDetailsCounts
}

/**
 * Orezanie podrobností vzdelávania (ADR-021, D131): rok po **dokončení**
 * kurzu zmiznú z pokusov otázky a odpovede a zo sledovania videa úseky.
 *
 * - Dokončenie sa **odvodzuje** (D119) — kurz sa prepočíta z udalostí.
 * - Sledovanie, ktoré hranicu prekročilo, **zostane** s `reachedAt`: stav
 *   časti sa z neho odvodzuje a bez neho by kurz zrazu vyzeral nedokončený.
 *   Sledovanie bez `reachedAt` nič nedokazuje a zmaže sa.
 * - Zápis dostane `detailsPurgedAt`, aby sa denne neprepočítaval znova.
 */
export async function trimLearningDetails(companyCode: string, mode: RetentionMode, now: Date = new Date()): Promise<LearningDetailsCounts> {
  const counts: LearningDetailsCounts = { enrollments: 0, testAttempts: 0, videoWatchTrimmed: 0, videoWatchDeleted: 0 }
  const dry = mode !== "delete"
  // Dokončiť sa nedá skôr, než sa človek zapísal — starší zápis je kandidát.
  const cutoff = addMonths(now, -LEARNING_DETAIL_MONTHS)
  const enrollmentsCol = await getCollection<Enrollment>(ENROLLMENTS_COLLECTION)
  const candidates = await enrollmentsCol
    .find({ companyCode, enrolledAt: { $lte: cutoff }, cancelledAt: null, detailsPurgedAt: { $exists: false } })
    .toArray()
  if (!candidates.length) return counts

  const courses = new Map<string, Course | null>()
  const coursesCol = await getCollection<Course>(COURSES_COLLECTION)
  for (const key of new Set(candidates.map(e => e.courseKey))) courses.set(key, await coursesCol.findOne({ companyCode, key }))
  const facts = await progressFactsMany(companyCode, candidates.map(e => e.id))
  const attempts = await getCollection(TEST_ATTEMPTS_COLLECTION)
  const watches = await getCollection(VIDEO_WATCH_COLLECTION)

  for (const e of candidates) {
    const course = courses.get(e.courseKey)
    const version = course ? versionById(course, e.versionId) : null
    if (!version) continue
    const progress = courseProgress(version, facts.get(e.id) ?? { completions: [], watches: [], passedTests: [] })
    if (!learningDetailsDue(progress.completedAt, now)) continue

    const attemptFilter = { companyCode, "context.enrollmentId": e.id, submittedAt: { $ne: null }, detailsPurgedAt: { $exists: false } }
    const reached = { companyCode, enrollmentId: e.id, reachedAt: { $ne: null }, detailsPurgedAt: { $exists: false } }
    const notReached = { companyCode, enrollmentId: e.id, reachedAt: null }
    const c = {
      testAttempts: await attempts.countDocuments(attemptFilter),
      videoWatchTrimmed: await watches.countDocuments(reached),
      videoWatchDeleted: await watches.countDocuments(notReached),
    }
    counts.enrollments++
    counts.testAttempts += c.testAttempts
    counts.videoWatchTrimmed += c.videoWatchTrimmed
    counts.videoWatchDeleted += c.videoWatchDeleted
    if (dry) continue

    if (c.testAttempts) await attempts.updateMany(attemptFilter, { $set: { questions: [], answers: {}, detailsPurgedAt: now } })
    if (c.videoWatchTrimmed) await watches.updateMany(reached, { $set: { watchedRanges: [], detailsPurgedAt: now } })
    if (c.videoWatchDeleted) await watches.deleteMany(notReached)
    await enrollmentsCol.updateOne({ companyCode, id: e.id }, { $set: { detailsPurgedAt: now } })
    if (c.testAttempts + c.videoWatchTrimmed + c.videoWatchDeleted > 0) {
      await logDeletion(companyCode, e.personId, "details", {
        ...ZERO, testAttempts: c.testAttempts, videoWatch: c.videoWatchTrimmed + c.videoWatchDeleted,
      }, now)
    }
  }
  return counts
}

/**
 * Jeden beh dávky pre organizáciu. Volá ho denný cron (D102).
 */
export async function runRetention(companyCode: string, mode: RetentionMode, now: Date = new Date()): Promise<RetentionRun> {
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const people = await col
    .find(
      { companyCode },
      { projection: { id: 1, companyCode: 1, email: 1, emailHistory: 1, status: 1, endedAt: 1, deactivatedAt: 1 } },
    )
    .toArray() as unknown as PersonForRetention[]

  const run: RetentionRun = {
    companyCode, mode, persons: [], staleActive: 0,
    learningDetails: { enrollments: 0, testAttempts: 0, videoWatchTrimmed: 0, videoWatchDeleted: 0 },
  }
  const last = await lastEvents(companyCode, people)
  for (const p of people) {
    const input = { status: p.status, endedAt: p.endedAt, deactivatedAt: p.deactivatedAt, lastEventAt: last.get(p.id) ?? null }

    if (isStaleActive(input, now)) run.staleActive++
    const decision = retentionDecision(input, now)
    if (!decision.due || !decision.basis) continue

    const counts = await deletePersonEvidence(p, decision.basis, mode, now)
    if (total(counts) > 0) run.persons.push({ personId: p.id, basis: decision.basis, counts })
  }
  // Po výmaze osôb — ich zápisy už nie sú, nerátajú sa dvakrát.
  run.learningDetails = await trimLearningDetails(companyCode, mode, now)
  return run
}
