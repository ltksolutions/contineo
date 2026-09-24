/**
 * Retenčná dávka (ADR-012, D101, D102) — výmaz reťaze dôkazov po lehote.
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
import {
  retentionDecision, isStaleActive, RETENTION_LOG_DAYS,
  type RetentionBasis, type RetentionMode,
} from "./retention"

export const RETENTION_LOG_COLLECTION = "retention_log"

export type DeletionReason = RetentionBasis | "objection"

export interface DeletionCounts {
  acknowledgements: number
  documentOpens: number
  readingTimes: number
  assignments: number
  approvalRounds: number
  responsibleCleared: number
}

const ZERO: DeletionCounts = {
  acknowledgements: 0, documentOpens: 0, readingTimes: 0,
  assignments: 0, approvalRounds: 0, responsibleCleared: 0,
}

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

  const counts: DeletionCounts = {
    ...ZERO,
    acknowledgements: acks.length,
    documentOpens: opens.length,
    readingTimes: reading.length,
    assignments: own.length,
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

export interface RetentionRun {
  companyCode: string
  mode: RetentionMode
  /** Osoby, ktorým lehota uplynula a mali čo zmazať. */
  persons: { personId: string; basis: RetentionBasis; counts: DeletionCounts }[]
  /** Aktívne osoby bez udalosti 5 rokov — na kontrolu HR, nič sa nemaže. */
  staleActive: number
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

  const run: RetentionRun = { companyCode, mode, persons: [], staleActive: 0 }
  const last = await lastEvents(companyCode, people)
  for (const p of people) {
    const input = { status: p.status, endedAt: p.endedAt, deactivatedAt: p.deactivatedAt, lastEventAt: last.get(p.id) ?? null }

    if (isStaleActive(input, now)) run.staleActive++
    const decision = retentionDecision(input, now)
    if (!decision.due || !decision.basis) continue

    const counts = await deletePersonEvidence(p, decision.basis, mode, now)
    if (total(counts) > 0) run.persons.push({ personId: p.id, basis: decision.basis, counts })
  }
  return run
}
