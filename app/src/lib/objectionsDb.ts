/**
 * Námietky v databáze (ADR-012, D105). Pravidlá sú v `objections.ts`.
 */

import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, normalizeEmail, type Person } from "./persons"
import { ACKNOWLEDGEMENTS_COLLECTION } from "./acknowledgements"
import { writeAudit } from "./audit"
import { deletePersonEvidence } from "./retentionDb"
import {
  OBJECTIONS_COLLECTION, ObjectionError, checkNewObjection, checkDecision, objectionScope,
  type Objection, type NewObjection,
} from "./objections"

/**
 * Zaeviduje námietku. Osoba sa hľadá podľa adresy — aj predošlej: námietka
 * často príde z adresy, ktorú človek používal, keď ešte vo zväze bol.
 */
export async function recordObjection(
  companyCode: string,
  email: string,
  input: NewObjection,
  actor: string,
  now: Date = new Date(),
): Promise<Objection> {
  const clean = checkNewObjection(input, now)
  const address = normalizeEmail(email)
  const persons = await getCollection<Person>(PERSONS_COLLECTION)
  const person = await persons.findOne({
    companyCode,
    $or: [{ email: address }, { "emailHistory.email": address }],
  })
  if (!person) throw new ObjectionError("objection.personNotFound", "Osoba s touto adresou v organizácii nie je.", { email: address })

  const objection: Objection = {
    id: crypto.randomUUID(),
    companyCode,
    personId: person.id,
    personName: person.fullName,
    ...clean,
    recordedBy: actor,
    recordedAt: now,
    status: "pending",
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    deleted: null,
  }
  await (await getCollection<Objection>(OBJECTIONS_COLLECTION)).insertOne(objection as never)
  // Do auditu ide **len to, že** námietka prišla — nie jej znenie.
  await writeAudit({
    companyCode, subject: "person", action: "objection-recorded",
    actor, targetId: person.id, targetLabel: person.fullName,
  })
  return objection
}

/**
 * Rozhodne o námietke. Rozhoduje sa **raz** — podmienka `status: pending`
 * v zápise zaručí, že dve súbežné rozhodnutia neprejdú obe.
 *
 * Pri vyhovení sa doklady zmažú **ostro** bez ohľadu na `RETENTION_MODE`:
 * o výmaze rozhodol človek, nie dávka (D105).
 */
export async function decideObjection(
  companyCode: string,
  id: string,
  decision: string,
  note: string,
  actor: string,
  now: Date = new Date(),
): Promise<Objection> {
  const d = checkDecision(decision, note)
  const col = await getCollection<Objection>(OBJECTIONS_COLLECTION)
  const existing = await col.findOne({ companyCode, id })
  if (!existing) throw new ObjectionError("objection.notFound", "Taká námietka tu nie je.")
  if (existing.status !== "pending") throw new ObjectionError("objection.notPending", "O námietke už bolo rozhodnuté.")

  const claimed = await col.updateOne(
    { companyCode, id, status: "pending" },
    { $set: { status: d.decision, decidedAt: now, decidedBy: actor, decisionNote: d.note } },
  )
  if (!claimed.modifiedCount) throw new ObjectionError("objection.notPending", "O námietke už bolo rozhodnuté.")

  let deleted: Record<string, number> | null = null
  if (d.decision === "upheld") {
    const person = await (await getCollection<Person>(PERSONS_COLLECTION)).findOne({ companyCode, id: existing.personId })
    if (person) {
      const acks = await (await getCollection(ACKNOWLEDGEMENTS_COLLECTION))
        .find({ companyCode, personId: person.id }, { projection: { documentId: 1, versionId: 1, legalBasis: 1 } })
        .toArray() as unknown as { documentId: string; versionId: string; legalBasis?: string | null }[]
      const scope = objectionScope(acks)
      const counts = scope.versions.size > 0
        ? await deletePersonEvidence(person, "objection", "delete", now, scope.versions)
        : null
      deleted = { ...(counts ?? {}), unknownBasis: scope.unknownBasis }
      await col.updateOne({ companyCode, id }, { $set: { deleted } })
    }
  }

  await writeAudit({
    companyCode, subject: "person", action: "objection-decided",
    actor, targetId: existing.personId, targetLabel: existing.personName,
    changes: { status: { from: "pending", to: d.decision } },
  })
  return { ...existing, status: d.decision, decidedAt: now, decidedBy: actor, decisionNote: d.note, deleted }
}

/** Námietky organizácie — otvorené hore, potom podľa dátumu doručenia. */
export async function listObjections(companyCode: string): Promise<Objection[]> {
  const rows = await (await getCollection<Objection>(OBJECTIONS_COLLECTION))
    .find({ companyCode })
    .sort({ receivedAt: -1 })
    .toArray()
  return rows.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"))
}
