/**
 * conversionCheckDb.ts — kontrola slov pri koncepte, potvrdenie nezhôd
 * a prekážka predloženia na schválenie (ADR-046, D299–D300).
 *
 * Kontrola (`conversionCheck`) a potvrdené nezhody (`conversionConfirmed`)
 * sú pri koncepte. Po úprave textu sa kontrola prepočíta lenivo — pri
 * otvorení editora a pred predložením (`freshConversionCheck`); potvrdenie
 * je viazané na odtlačok nezhody, takže nezmenené miesto ostane potvrdené.
 *
 * Oddelené od behu (`aiConversionJob.ts`): schvaľovanie (`approvalsDb.ts`)
 * sa sem pýta a beh zapisuje cez `libraryWrite.ts`, ktorý schvaľovanie
 * importuje — v jednom súbore by to bol kruh.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { AppError } from "./appError"
import { loadFile } from "./fileStore"
import { pdfTextLayer } from "./conversion"
import { checkConversion, unresolvedDifferences, CHECK_VERSION, type ConversionCheck, type LayerPage } from "./conversionCheck"
import { textFingerprint } from "./chunkIdentity"

export class ConversionError extends AppError {}

/** Toľkokrát za sebou smie krok prevodu zlyhať, kým sa beh vzdá. */
export const MAX_FAILURES = 3

export interface StoredCheck extends ConversionCheck {
  /** Odtlačok textu, nad ktorým kontrola bežala. */
  textHash: string
  pdfFileId: string
  at: Date
}

export interface Confirmation {
  id: string
  by: string
  at: Date
}

interface CheckDoc {
  draftMarkdown?: string
  originalFile?: { id: string } | null
  aiConversion?: { status?: string; failures?: number; pdfFileId?: string } | null
  conversionCheck?: StoredCheck | null
  conversionConfirmed?: Confirmation[]
}

async function documents() {
  return getCollection(DOCUMENTS_COLLECTION)
}

export function isConverting(job: { status?: string; failures?: number } | null | undefined): boolean {
  return Boolean(job && job.status === "running" && (job.failures ?? 0) < MAX_FAILURES)
}

/** Textová vrstva PDF, s ktorým sa porovnáva. */
export async function referenceLayer(companyCode: string, pdfFileId: string): Promise<LayerPage[]> {
  const file = await loadFile(companyCode, pdfFileId)
  if (!file) throw new ConversionError("conversion.pdfMissing", "Pôvodné PDF sa nenašlo.")
  return pdfTextLayer(file.data)
}

export function storedCheck(check: ConversionCheck, markdown: string, pdfFileId: string, at: Date): StoredCheck {
  return { ...check, textHash: textFingerprint(markdown), pdfFileId, at }
}

/**
 * Kontrola slov pre prijatý návrh prevodu (`llmDraft` s `mode: "convert"`).
 * Volá sa po `saveDraft` — text je už v koncepte.
 */
export async function adoptConversionCheck(companyCode: string, documentId: string): Promise<void> {
  const col = await documents()
  const doc = await col.findOne({ companyCode, documentId }, { projection: { draftMarkdown: 1, aiConversion: 1 } }) as CheckDoc | null
  const pdfFileId = doc?.aiConversion?.pdfFileId
  if (!doc || !pdfFileId) return
  const markdown = doc.draftMarkdown ?? ""
  const check = storedCheck(checkConversion(await referenceLayer(companyCode, pdfFileId), markdown), markdown, pdfFileId, new Date())
  await col.updateOne({ companyCode, documentId }, { $set: { conversionCheck: check, conversionConfirmed: [] } })
}

export interface FreshCheck {
  check: StoredCheck
  confirmed: Confirmation[]
  /** Nezhody, ktoré ešte nikto nepotvrdil. */
  open: StoredCheck["differences"]
}

/**
 * Kontrola slov pre dnešný text konceptu. Keď sa text od poslednej kontroly
 * zmenil, prepočíta sa a uloží. `null`, keď koncept prevod modelom nemá
 * alebo pôvodné PDF už nie je to, s ktorým sa porovnávalo.
 */
export async function freshConversionCheck(companyCode: string, documentId: string): Promise<FreshCheck | null> {
  const col = await documents()
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { draftMarkdown: 1, originalFile: 1, conversionCheck: 1, conversionConfirmed: 1 } },
  ) as CheckDoc | null
  let check = doc?.conversionCheck
  if (!doc || !check || doc.originalFile?.id !== check.pdfFileId) return null
  const markdown = doc.draftMarkdown ?? ""
  if (check.textHash !== textFingerprint(markdown) || check.version !== CHECK_VERSION) {
    check = storedCheck(checkConversion(await referenceLayer(companyCode, check.pdfFileId), markdown), markdown, check.pdfFileId, new Date())
    await col.updateOne({ companyCode, documentId }, { $set: { conversionCheck: check } })
  }
  const confirmed = doc.conversionConfirmed ?? []
  return { check, confirmed, open: unresolvedDifferences(check, confirmed.map(c => c.id)) }
}

/**
 * Potvrdí nezhody — človek ich porovnal s originálom a znenie je správne
 * (D300). `ids` sú odtlačky nezhôd; neznáme sa ignorujú.
 */
export async function confirmDifferences(companyCode: string, documentId: string, ids: string[], by: string, now = new Date()): Promise<number> {
  const fresh = await freshConversionCheck(companyCode, documentId)
  if (!fresh) throw new ConversionError("conversion.noCheck", "Koncept nemá kontrolu slov.")
  const wanted = new Set(ids)
  const add = fresh.open.filter(d => wanted.has(d.id)).map(d => ({ id: d.id, by, at: now }))
  if (!add.length) return 0
  await (await documents()).updateOne({ companyCode, documentId }, { $push: { conversionConfirmed: { $each: add } } } as never)
  return add.length
}

/**
 * Prekážka predloženia na schválenie (D300): beží prevod alebo ostali
 * nepotvrdené nezhody. `null`, keď nič nebráni.
 */
export async function conversionBlocker(companyCode: string, documentId: string): Promise<{ code: string; count?: number } | null> {
  const doc = await (await documents()).findOne({ companyCode, documentId }, { projection: { aiConversion: 1 } }) as CheckDoc | null
  if (isConverting(doc?.aiConversion)) return { code: "approval.conversionRunning" }
  const fresh = await freshConversionCheck(companyCode, documentId)
  if (fresh && fresh.open.length) return { code: "approval.conversionUnresolved", count: fresh.open.length }
  return null
}
