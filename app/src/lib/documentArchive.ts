/**
 * Archivácia predpisu — „prestáva platiť dňom" (ADR-025, D156).
 *
 * Predpis sa dnes prestal dať ukončiť inak než novým znením. Archivácia
 * platnému zneniu nastaví **koniec platnosti** (`effectiveTo`) — ten istý
 * mechanizmus ako pri zverejnení novely (D143), len bez nového znenia. Text,
 * PDF ani potvrdenia sa nemenia; čo z neplatnosti vyplýva (asistent nehľadá,
 * nedá sa prideliť, výkaz DPO ho nemá, čitatelia ho nevidia), už počíta
 * `effectiveVersion()`.
 *
 * **Stav sa odvodzuje** (D27): archivovaný je predpis, ktorého posledné
 * zverejnené znenie má koniec platnosti a otvorený záznam v `archives[]`.
 * Záznam nesie kto, kedy a prečo — o rok je to jediné miesto, kde sa to dá
 * zistiť; obnovenie ho uzavrie (`restoredAt`), nezmaže.
 *
 * Dátum môže byť aj v budúcnosti (Ján 2. 10. 2026): do toho dňa predpis
 * platí normálne. **Nepotvrdené pridelenia sa odvolajú** dňom, keď
 * archivácia nadobudne účinnosť — hneď pri zápise, ak je dátum dnes alebo
 * v minulosti, inak v dennom behu (`settleArchivedDocuments()`).
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "./documents"
import { APPROVALS_COLLECTION } from "./approvals"
import { ASSIGNMENTS_COLLECTION, revoke as revokeAssignment, type Assignment } from "./assignments"
import { expireCurationFor } from "./curation"
import { writeAudit } from "./audit"
import { draftIsFree } from "./textFix"
import { AppError } from "./appError"
import { openArchive, latestPublished, type ArchiveEntry, type ArchivableVersion } from "./documentArchiveState"

export { openArchive, latestPublished, archiveState, type ArchiveEntry } from "./documentArchiveState"

type ArchivableDocument = DocumentRecord & {
  versions?: ArchivableVersion[]
  draftMarkdown?: string
  draftPdf?: { id: string } | null
}

export class ArchiveError extends AppError {}

export type ArchiveProblem =
  | "no-current"
  | "already-archived"
  | "upcoming"
  | "draft"
  | "round-open"
  | "date-before-start"
  | "no-reason"

/**
 * Dá sa predpis archivovať? Prvý dôvod, prečo nie, alebo `null`.
 *
 * Nedá sa, kým sa pripravuje nové znenie, beží kolo schvaľovania alebo je
 * zverejnená novela, ktorá ešte neplatí — zverejnenie by archiváciu ticho
 * prebilo a predpis by znova „ožil".
 */
export function archiveProblem(input: {
  doc: ArchivableDocument
  until: Date
  reason: string
  roundOpen: boolean
  now: Date
}): ArchiveProblem | null {
  const { doc, until, now } = input
  const latest = latestPublished(doc.versions)
  const current = effectiveVersion(doc, now)
  if (!latest) return "no-current"
  if (openArchive(latest)) return "already-archived"
  if (latest.effectiveTo) return "no-current"
  // Novela vopred: posledné zverejnené znenie dnes ešte neplatí.
  if (!current.ok || current.version.versionId !== latest.versionId) {
    return current.ok ? "upcoming" : "no-current"
  }
  const versions = doc.versions ?? []
  const pdfIds = versions.map(v => v.pdf?.id ?? "").filter(Boolean)
  if (!draftIsFree(doc.draftMarkdown, [...versions, { versionId: "", markdown: doc.markdown }], doc.draftPdf?.id, pdfIds)) {
    return "draft"
  }
  if (input.roundOpen) return "round-open"
  if (until.getTime() <= (latest.effectiveFrom as Date).getTime()) return "date-before-start"
  if (!input.reason.trim()) return "no-reason"
  return null
}

const MESSAGES: Record<ArchiveProblem, string> = {
  "no-current": "Predpis nemá platné znenie, ktoré by sa dalo archivovať.",
  "already-archived": "Predpis je už archivovaný.",
  upcoming: "Predpis má zverejnenú novelu, ktorá ešte neplatí. Archivovať sa dá, až keď začne platiť.",
  draft: "Pripravuje sa nové znenie. Najprv ho dokonči alebo zahoď.",
  "round-open": "Beží kolo schvaľovania. Najprv ho ukonči.",
  "date-before-start": "Dátum musí byť neskôr než začiatok platnosti znenia.",
  "no-reason": "Chýba dôvod archivácie.",
}

async function loadDocument(companyCode: string, documentId: string): Promise<ArchivableDocument> {
  const col = await getCollection<ArchivableDocument>(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ companyCode, documentId } as never)
  if (!doc) throw new ArchiveError("library.documentNotFound", "Dokument neexistuje.")
  return doc as ArchivableDocument
}

/**
 * Odvolá platné pridelenia predpisu a ukončí overené odpovede z neho
 * (rovnako ako pri novom znení). Potvrdenia sa nedotýka — sú to doklady.
 */
async function settle(companyCode: string, documentId: string, versionId: string, actor: string, when: Date): Promise<number> {
  const col = await getCollection<Assignment>(ASSIGNMENTS_COLLECTION)
  const open = await col
    .find({ companyCode, "subject.documentId": documentId, revokedAt: null } as never, { projection: { _id: 1 } })
    .toArray()
  let revoked = 0
  for (const a of open) {
    if (await revokeAssignment(companyCode, String(a._id), actor, "Predpis archivovaný.")) revoked++
  }
  await expireCurationFor(companyCode, documentId, when)

  const docs = await getCollection<ArchivableDocument>(DOCUMENTS_COLLECTION)
  await docs.updateOne(
    { companyCode, documentId } as never,
    { $set: { "versions.$[v].archives.$[a].settledAt": when } } as never,
    { arrayFilters: [{ "v.versionId": versionId }, { "a.settledAt": null, "a.restoredAt": null }] } as never,
  )
  return revoked
}

export async function archiveDocument(input: {
  companyCode: string
  documentId: string
  until: Date
  reason: string
  actor: string
  now?: Date
}): Promise<{ inEffect: boolean; revoked: number }> {
  const now = input.now ?? new Date()
  const doc = await loadDocument(input.companyCode, input.documentId)
  const rounds = await getCollection(APPROVALS_COLLECTION)
  const roundOpen = Boolean(await rounds.findOne({ companyCode: input.companyCode, documentId: input.documentId, outcome: null } as never))
  const problem = archiveProblem({ doc, until: input.until, reason: input.reason, roundOpen, now })
  if (problem) throw new ArchiveError(`archive.${problem}`, MESSAGES[problem])

  const latest = latestPublished(doc.versions) as ArchivableVersion
  const entry: ArchiveEntry = {
    at: now, by: input.actor, reason: input.reason.trim(), effectiveTo: input.until,
    restoredAt: null, restoredBy: null, settledAt: null,
  }
  const col = await getCollection<ArchivableDocument>(DOCUMENTS_COLLECTION)
  // Podmienka zopakuje, že znenie koniec platnosti nemá — dve súbežné
  // archivácie neprejdú obe.
  const r = await col.updateOne(
    { companyCode: input.companyCode, documentId: input.documentId } as never,
    {
      $set: { "versions.$[v].effectiveTo": input.until, effectiveTo: input.until, updatedAt: now, updatedBy: input.actor },
      $push: { "versions.$[v].archives": entry },
    } as never,
    { arrayFilters: [{ "v.versionId": latest.versionId, "v.effectiveTo": null }] } as never,
  )
  if (r.modifiedCount !== 1) throw new ArchiveError("archive.already-archived", MESSAGES["already-archived"])

  await writeAudit({
    companyCode: input.companyCode, subject: "document", action: "archived", actor: input.actor,
    targetId: input.documentId, targetLabel: doc.title,
    changes: { effectiveTo: { from: null, to: input.until.toISOString().slice(0, 10) } },
    note: input.reason.trim(),
  })

  const inEffect = input.until.getTime() <= now.getTime()
  const revoked = inEffect ? await settle(input.companyCode, input.documentId, latest.versionId, input.actor, now) : 0
  return { inEffect, revoked }
}

/**
 * Obnoví platnosť archivovaného predpisu (omyl). Koniec platnosti sa zruší,
 * záznam o archivácii sa uzavrie. Odvolané pridelenia sa **neobnovujú** —
 * prideliť sa dá znova.
 */
export async function restoreDocument(input: {
  companyCode: string
  documentId: string
  actor: string
  now?: Date
}): Promise<void> {
  const now = input.now ?? new Date()
  const doc = await loadDocument(input.companyCode, input.documentId)
  const latest = latestPublished(doc.versions) as ArchivableVersion | undefined
  const entry = openArchive(latest)
  if (!latest || !entry) throw new ArchiveError("archive.not-archived", "Predpis nie je archivovaný.")

  const col = await getCollection<ArchivableDocument>(DOCUMENTS_COLLECTION)
  await col.updateOne(
    { companyCode: input.companyCode, documentId: input.documentId } as never,
    {
      $set: {
        "versions.$[v].effectiveTo": null,
        "versions.$[v].archives.$[a].restoredAt": now,
        "versions.$[v].archives.$[a].restoredBy": input.actor,
        effectiveTo: null, updatedAt: now, updatedBy: input.actor,
      },
    } as never,
    { arrayFilters: [{ "v.versionId": latest.versionId }, { "a.at": entry.at, "a.restoredAt": null }] } as never,
  )
  await writeAudit({
    companyCode: input.companyCode, subject: "document", action: "validity-restored", actor: input.actor,
    targetId: input.documentId, targetLabel: doc.title,
    changes: { effectiveTo: { from: entry.effectiveTo.toISOString().slice(0, 10), to: null } },
  })
}

/**
 * Denný beh: archivácie, ktorým dnes nastal deň účinnosti, odvolajú
 * pridelenia. Archivácia k dnešku či skôr sa vybavila už pri zápise
 * (`settledAt`), takže sa neopakuje.
 */
export async function settleArchivedDocuments(companyCode: string, now: Date = new Date()): Promise<number> {
  const col = await getCollection<ArchivableDocument>(DOCUMENTS_COLLECTION)
  const docs = await col
    .find({ companyCode, "versions.archives": { $exists: true } } as never, { projection: { documentId: 1, versions: 1 } })
    .toArray() as ArchivableDocument[]
  let revoked = 0
  for (const doc of docs) {
    const latest = latestPublished(doc.versions) as ArchivableVersion | undefined
    const entry = openArchive(latest)
    if (!latest || !entry || entry.settledAt || entry.effectiveTo.getTime() > now.getTime()) continue
    revoked += await settle(companyCode, doc.documentId, latest.versionId, "system:archive", now)
  }
  return revoked
}
