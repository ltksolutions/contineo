/**
 * complianceChecks.ts — kontrola ako zadanie, beh ako jej kolo (ADR-036,
 * D234 v znení dodatku D239; návrh KNIZ-kontroly-a-kola, 20. 10. 2026).
 *
 * **Kontrola** je záznam v `compliance_checks`: druh (súlad dokumentov /
 * návrhy z helpdesku), kontrolované dokumenty, pri helpdesku kanál, názov
 * a zrušenie. **Kolo** je dnešný beh (`compliance_runs`) s `checkId`
 * a `round`. Výsledky, rozhodnutia a spotreba ostávajú pri behu — kontrola
 * nesie len zadanie, takže sa nič nezdvojuje (D27).
 *
 * Bez migrácie: behy spred D239 sú od 20. 10. 2026 zrušené (D238) a ostávajú
 * čitateľné v starom tvare na svojej adrese.
 */

import { randomBytes } from "node:crypto"
import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import {
  COMPLIANCE_RUNS_COLLECTION, ComplianceError, runTitle, startDocumentReview, startHelpdeskReview,
  type ComplianceRun, type RunStarter,
} from "./complianceCheck"

export const COMPLIANCE_CHECKS_COLLECTION = "compliance_checks"

export type CheckKind = "documents" | "helpdesk"

export interface ComplianceCheck {
  companyCode: string
  checkId: string
  kind: CheckKind
  /** Názov patrí kontrole (prázdny = „Kontrola <dátum založenia>"). */
  name: string
  /** Kontrolované dokumenty; pri helpdesku sa obnovia každým kolom (verejné manuály). */
  subjectIds: string[]
  /** Vybrané normy; prázdne = nadradené z hierarchie pri každom kole (D219). */
  referenceIds: string[]
  channelKey: string | null
  /** Kópia názvu kanála v čase založenia. */
  channelName: string | null
  createdAt: Date
  createdBy: string
  updatedAt: Date
  /** Zrušenie (D238) — kontrola zmizne zo zoznamu, záznam ostáva (D24). */
  archivedAt: Date | null
  archivedBy: string | null
  archiveReason: string | null
}

async function checks() { return getCollection<ComplianceCheck>(COMPLIANCE_CHECKS_COLLECTION) }
async function runs() { return getCollection<ComplianceRun>(COMPLIANCE_RUNS_COLLECTION) }

export async function checkById(companyCode: string, checkId: string): Promise<ComplianceCheck | null> {
  const code = requireCompanyCode(companyCode, "checkById")
  return (await checks()).findOne({ companyCode: code, checkId }, { projection: { _id: 0 } })
}

/** Kontroly organizácie bez zrušených, naposledy menené hore. */
export async function listChecks(companyCode: string): Promise<ComplianceCheck[]> {
  const code = requireCompanyCode(companyCode, "listChecks")
  return (await checks()).find({ companyCode: code, archivedAt: null }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).limit(200).toArray()
}

/** Kolá kontroly od prvého. */
export async function roundsOf(companyCode: string, checkId: string): Promise<ComplianceRun[]> {
  const code = requireCompanyCode(companyCode, "roundsOf")
  return (await runs()).find({ companyCode: code, checkId }, { projection: { _id: 0 } }).sort({ round: 1, startedAt: 1 }).toArray()
}

/** Posledné kolo a počet kôl pre viac kontrol jedným dotazom (zoznam). */
export async function latestRounds(companyCode: string, checkIds: string[]): Promise<Map<string, { latest: ComplianceRun; count: number }>> {
  const code = requireCompanyCode(companyCode, "latestRounds")
  const out = new Map<string, { latest: ComplianceRun; count: number }>()
  if (!checkIds.length) return out
  const all = await (await runs()).find(
    { companyCode: code, checkId: { $in: checkIds } },
    // Bez rozpracovaných krokov a cache — zoznam ich nepotrebuje.
    { projection: { _id: 0, partials: 0, warmPacks: 0 } },
  ).sort({ round: 1 }).toArray()
  for (const r of all) {
    const id = String(r.checkId)
    const cur = out.get(id)
    out.set(id, { latest: r, count: (cur?.count ?? 0) + 1 })
  }
  return out
}

/** Nezrušená kontrola návrhov z helpdesku pre kanál (Q6 — upozorniť, nie zakázať). */
export async function checkForChannel(companyCode: string, channelKey: string): Promise<ComplianceCheck | null> {
  const code = requireCompanyCode(companyCode, "checkForChannel")
  return (await checks()).findOne({ companyCode: code, kind: "helpdesk", channelKey, archivedAt: null }, { projection: { _id: 0 }, sort: { updatedAt: -1 } })
}

/**
 * Kontrola, ktorej patrí požiadavka (Q2): najnovšia nezrušená kontrola
 * dokumentov, ktorá kontroluje všetky dokumenty požiadavky. Žiadna = požiadavka
 * založí novú kontrolu.
 */
export async function checkForSubjects(companyCode: string, subjectIds: string[]): Promise<ComplianceCheck | null> {
  const code = requireCompanyCode(companyCode, "checkForSubjects")
  if (!subjectIds.length) return null
  return (await checks()).findOne(
    { companyCode: code, kind: "documents", archivedAt: null, subjectIds: { $all: subjectIds } },
    { projection: { _id: 0 }, sort: { updatedAt: -1 } },
  )
}

export interface NewCheck {
  kind: CheckKind
  name: string
  subjectIds: string[]
  referenceIds: string[]
  channel?: { key: string; name: string } | null
}

/** Založí kontrolu (bez kola — to spustí `startCheckRound`). */
export async function createCheck(companyCode: string, input: NewCheck, actor: string, now = new Date()): Promise<ComplianceCheck> {
  const code = requireCompanyCode(companyCode, "createCheck")
  const check: ComplianceCheck = {
    companyCode: code, checkId: randomBytes(8).toString("hex"), kind: input.kind, name: runTitle(input.name),
    subjectIds: [...new Set(input.subjectIds.filter(Boolean))], referenceIds: [...new Set(input.referenceIds.filter(Boolean))],
    channelKey: input.channel?.key ?? null, channelName: input.channel?.name ?? null,
    createdAt: now, createdBy: actor, updatedAt: now, archivedAt: null, archivedBy: null, archiveReason: null,
  }
  await (await checks()).insertOne({ ...check })
  return check
}

/**
 * Ďalšie kolo kontroly. Zadanie je z kontroly; normy z požiadavky (nové
 * znenie normy, D200) majú prednosť pred uloženými. Zlyhanie spustenia kolo
 * nezaloží a kontrolu nemení.
 */
export async function startCheckRound(companyCode: string, checkId: string, starter: RunStarter, opts: { referenceIds?: string[] } = {}, now = new Date()): Promise<ComplianceRun> {
  const code = requireCompanyCode(companyCode, "startCheckRound")
  const check = await checkById(code, checkId)
  if (!check || check.archivedAt) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")
  const last = await (await runs()).find({ companyCode: code, checkId }, { projection: { _id: 0, round: 1 } }).sort({ round: -1 }).limit(1).next()
  const link = { checkId, round: (last?.round ?? 0) + 1 }
  const refs = opts.referenceIds?.length ? opts.referenceIds : check.referenceIds
  const run = check.kind === "helpdesk" && check.channelKey
    ? await startHelpdeskReview(code, { key: check.channelKey, name: check.channelName ?? check.channelKey }, starter, check.name, now, link)
    : await startDocumentReview(code, check.subjectIds, refs, starter, now, check.name, undefined, link)
  const subjects = run.scope.kind === "documents" ? run.scope.subjectIds : check.subjectIds
  await (await checks()).updateOne({ companyCode: code, checkId }, { $set: { updatedAt: now, subjectIds: subjects } })
  return run
}

/** Premenovanie kontroly; kópia názvu ide aj do jej kôl (upozornenia a staré odkazy). */
export async function renameCheck(companyCode: string, checkId: string, name: string, now = new Date()): Promise<void> {
  const code = requireCompanyCode(companyCode, "renameCheck")
  const title = runTitle(name)
  const r = await (await checks()).updateOne({ companyCode: code, checkId }, { $set: { name: title, updatedAt: now } })
  if (!r.matchedCount) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")
  await (await runs()).updateMany({ companyCode: code, checkId }, title ? { $set: { name: title } } : { $unset: { name: "" } })
}

/**
 * Zrušenie kontroly (D238): kontrola aj všetky jej kolá dostanú `archivedAt`,
 * bežiace kolo sa zastaví. Ponechania sa do ďalších kontrol neprenesú
 * (`keptDecisions` zrušené behy vynechá). Pevné väzby ostávajú (Q5).
 */
export async function archiveCheck(companyCode: string, checkId: string, by: string, reason = "", now = new Date()): Promise<void> {
  const code = requireCompanyCode(companyCode, "archiveCheck")
  const r = await (await checks()).updateOne(
    { companyCode: code, checkId, archivedAt: null },
    { $set: { archivedAt: now, archivedBy: by, archiveReason: reason.trim().slice(0, 1000) || null, updatedAt: now } },
  )
  if (!r.matchedCount) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")
  const col = await runs()
  await col.updateMany(
    { companyCode: code, checkId, "pending.0": { $exists: true }, stoppedAt: null },
    { $set: { pending: [], partials: [], stoppedAt: now, stoppedBy: by, finishedAt: now, notifiedAt: now, leaseUntil: null } },
  )
  await col.updateMany({ companyCode: code, checkId, archivedAt: null }, { $set: { archivedAt: now, archivedBy: by, updatedAt: now } })
}
