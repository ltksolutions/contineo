/**
 * webImport.ts — sledovaný zdroj: predpis zo Slov-Lexu do knižnice
 * a kontrola zmien (ADR-037, krok B; D242–D246).
 *
 * Tá istá cesta ako import z konektora (ADR-029, `connectorImport.ts`):
 * z predpisu vznikne **koncept dokumentu** cez `uploadDocument()`. Rozdiel
 * je v súboroch — PDF je **záväzné PDF zo Slov-Lexu**, nie sadzba u nás
 * (D244), a Markdown z HTML znenia je zdroj textu na vyhľadávanie (D95).
 * Ďalej je to bežný dokument: metadáta, schválenie (ADR-006), zverejnenie,
 * hierarchia (D219).
 *
 * **Pôvod** (`documents.source`, typ `web`) nesie adaptér, adresu,
 * identifikátor predpisu a **časovú verziu** znenia, ktoré je v knižnici.
 * Kontrola zdroja porovná históriu predpisu s ňou: novšie znenie — aj
 * s účinnosťou v budúcnosti — je koncept nového znenia s tou účinnosťou
 * (D243). Nič zverejnené sa neprepisuje (D24).
 *
 * Krok C (cron a upozornenie) volá to isté, čo tlačidlo; zatiaľ nie je.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, type DocumentSource, type WebDocumentSource } from "./documents"
import { uploadDocument, checkMetadata, LibraryError } from "./libraryWrite"
import type { VersionMeta } from "./versionMeta"
import { contentHash } from "./connectorImport"
import { assignDocument } from "./folders"
import { slugifyKey } from "./slug"
import { AppError } from "./appError"
import type { CodelistExtras } from "./codelists"
import {
  parseActRef, actId, actNumber, historyUrl, versionUrl, portalUrl, parseHistory, parseVersion, effectiveRow, newerRows,
  SLOV_LEX_ADAPTER, SLOV_LEX_ADAPTER_VERSION, type ActRef, type HistoryRow, type ActVersion,
} from "./slovLex"

export class WebImportError extends AppError {}

/** Strop na jeden súbor — stránka znenia má 1,5 MB, PDF okolo 11 MB. */
const FETCH_TIMEOUT_MS = 30_000
const USER_AGENT = "Contineo/1 (+https://contineo.app; kniznica)"
/** Orgán, ktorý zákon prijal — do údajov o znení (ADR-013, D246). */
const PARLIAMENT = "Národná rada Slovenskej republiky"

async function fetchUrl(url: string): Promise<Response> {
  let r: Response
  try {
    r = await fetch(url, { headers: { "user-agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (e) {
    throw new WebImportError("web.fetchFailed", `Slov-Lex neodpovedal: ${url} (${String((e as Error)?.message ?? e)})`, { url })
  }
  if (!r.ok) throw new WebImportError("web.fetchFailed", `Slov-Lex vrátil ${r.status}: ${url}`, { url, status: r.status })
  return r
}

function refOf(address: string): ActRef {
  const ref = parseActRef(address)
  if (!ref) throw new WebImportError("web.badAddress", `Adresa nie je predpis na Slov-Lexe: ${address.slice(0, 120)}`)
  return ref
}

async function history(ref: ActRef): Promise<HistoryRow[]> {
  const rows = parseHistory(await (await fetchUrl(historyUrl(ref))).text())
  if (!rows.length) throw new WebImportError("web.noVersion", `Predpis ${actNumber(ref)} nemá na Slov-Lexe žiadne znenie.`)
  return rows
}

interface Fetched {
  page: ActVersion
  pdf: Buffer
  hash: string
}

/** Stiahne HTML znenia aj záväzné PDF; prevod zlyhá nahlas pri zmene značkovania. */
async function fetchVersion(ref: ActRef, row: HistoryRow): Promise<Fetched> {
  const html = await (await fetchUrl(versionUrl(ref, row.timepoint))).text()
  let page: ActVersion
  try {
    page = parseVersion(html, ref, row.timepoint)
  } catch (e) {
    throw new WebImportError("web.parseFailed", String((e as Error)?.message ?? e), { url: versionUrl(ref, row.timepoint) })
  }
  const pdf = Buffer.from(await (await fetchUrl(page.pdfUrl)).arrayBuffer())
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new WebImportError("web.pdfFailed", `Záväzné PDF sa nepodarilo stiahnuť: ${page.pdfUrl}`, { url: page.pdfUrl })
  }
  return { page, pdf, hash: contentHash(page.markdown) }
}

function files(ref: ActRef, row: HistoryRow, f: Fetched) {
  const base = `${slugifyKey(f.page.kind) || "predpis"}-${ref.number}-${ref.year}-${row.timepoint}`
  return {
    pdf: { name: `${base}.pdf`, data: f.pdf },
    source: { name: `${base}.md`, data: Buffer.from(f.page.markdown, "utf8") },
  }
}

/** Údaje o znení (ADR-013): prijal parlament, účinnosť z histórie; dátum schválenia konsolidované znenie nemá (D246). */
function versionMeta(row: HistoryRow): VersionMeta {
  return { author: null, approvedBy: PARLIAMENT, approvedOn: null, effectiveFrom: new Date(row.effectiveFrom) }
}

function sourceOf(ref: ActRef, row: HistoryRow, f: Fetched, url: string): WebDocumentSource {
  return {
    type: "web", adapter: SLOV_LEX_ADAPTER, url, externalId: actId(ref), timepoint: row.timepoint,
    fetchedAt: new Date(), contentHash: f.hash, adapterVersion: SLOV_LEX_ADAPTER_VERSION,
  }
}

interface ExistingDoc {
  documentId: string
  title: string
  timepoint: string
}

/** Dokument organizácie, ktorý z tohto predpisu už vznikol — jeden predpis, jeden dokument (D245). */
async function existingByAct(companyCode: string, externalId: string): Promise<ExistingDoc | null> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, "source.type": "web", "source.externalId": externalId },
    { projection: { documentId: 1, title: 1, "source.timepoint": 1 } },
  ) as { documentId: string; title?: string; source?: { timepoint?: string } } | null
  return doc ? { documentId: doc.documentId, title: String(doc.title ?? doc.documentId), timepoint: String(doc.source?.timepoint ?? "") } : null
}

export interface WebPreview {
  externalId: string
  /** „440/2015 Z. z." */
  number: string
  title: string
  /** Znenie účinné dnes — to sa importuje. */
  current: HistoryRow
  /** Znenia vyhlásené na neskôr. */
  later: HistoryRow[]
  existing: ExistingDoc | null
}

/** Náhľad pred importom: čo sa nájde na adrese a či to v knižnici už je. Nič nezapisuje. */
export async function previewSlovLex(companyCode: string, address: string, now: Date = new Date()): Promise<WebPreview> {
  const ref = refOf(address)
  const rows = await history(ref)
  const current = effectiveRow(rows, now)
  if (!current) throw new WebImportError("web.noVersion", `Predpis ${actNumber(ref)} nemá znenie účinné k dnešnému dňu.`)
  const html = await (await fetchUrl(versionUrl(ref, current.timepoint))).text()
  let page: ActVersion
  try {
    page = parseVersion(html, ref, current.timepoint)
  } catch (e) {
    throw new WebImportError("web.parseFailed", String((e as Error)?.message ?? e))
  }
  return {
    externalId: actId(ref), number: actNumber(ref), title: page.title, current,
    later: newerRows(rows, current.timepoint), existing: await existingByAct(companyCode, actId(ref)),
  }
}

export interface WebImportInput {
  address: string
  folderId: string | null
  category: string
  accessLevel: string
  language: string
  scope: string
  ownerDepartmentId?: string
  tags?: string[]
}

export interface WebImportOutcome {
  documentId: string
  title: string
  /** `created` = nový koncept; `exists` = predpis v knižnici už bol, nič sa nezapísalo. */
  result: "created" | "exists"
  effectiveFrom: string | null
  later: HistoryRow[]
}

/** Predpis zo Slov-Lexu → koncept dokumentu so záväzným PDF a textom (D244, D245). */
export async function importFromSlovLex(
  companyCode: string, input: WebImportInput, actor: string, extras: CodelistExtras | undefined, now: Date = new Date(),
): Promise<WebImportOutcome> {
  const ref = refOf(input.address)
  const existing = await existingByAct(companyCode, actId(ref))
  if (existing) return { documentId: existing.documentId, title: existing.title, result: "exists", effectiveFrom: null, later: [] }

  const rows = await history(ref)
  const current = effectiveRow(rows, now)
  if (!current) throw new WebImportError("web.noVersion", `Predpis ${actNumber(ref)} nemá znenie účinné k dnešnému dňu.`)
  const fetched = await fetchVersion(ref, current)

  const meta = checkMetadata({
    title: fetched.page.title,
    documentKey: slugifyKey(`${fetched.page.kind} ${ref.number} ${ref.year}`),
    sectionKey: "",
    companyCode, scope: input.scope, accessLevel: input.accessLevel, language: input.language, category: input.category,
    sourceType: "web", tags: input.tags ?? [], ownerDepartmentId: input.ownerDepartmentId,
  }, extras)
  const r = await uploadDocument(meta, files(ref, current, fetched), actor, "new", versionMeta(current))
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const source: DocumentSource = sourceOf(ref, current, fetched, portalUrl(ref))
  await col.updateOne({ companyCode, documentId: r.documentId }, { $set: { source } })
  if (input.folderId) await assignDocument(companyCode, r.documentId, input.folderId, actor)
  return { documentId: r.documentId, title: fetched.page.title, result: "created", effectiveFrom: current.effectiveFrom, later: newerRows(rows, current.timepoint) }
}

export interface WebCheckOutcome {
  /** `version` = novšie znenie ako koncept; `corrected` = tá istá časová verzia s iným textom; `unchanged` = nič. */
  result: "unchanged" | "version" | "corrected"
  effectiveFrom: string | null
  /** Ďalšie znenia po tom, ktoré sa práve stiahlo — každá kontrola berie jedno. */
  later: HistoryRow[]
}

/**
 * Kontrola zdroja (D243): najbližšie znenie po tom, ktoré je v knižnici,
 * ide ako koncept nového znenia s účinnosťou zo Slov-Lexu. Keď novšie nie
 * je, porovná sa text tej istej časovej verzie — oprava na portáli je
 * tiež nové znenie. Rozpracovaný koncept sa prepíše ako pri konektore.
 */
export async function checkWebSource(
  companyCode: string, documentId: string, actor: string, extras: CodelistExtras | undefined,
): Promise<WebCheckOutcome> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { source: 1, title: 1, documentKey: 1, scope: 1, accessLevel: 1, language: 1, category: 1, tags: 1, ownerDepartmentId: 1 } },
  ) as { source?: DocumentSource; title?: string; documentKey?: string; scope?: string; accessLevel?: string; language?: string; category?: string; tags?: string[]; ownerDepartmentId?: string | null } | null
  if (!doc?.source || doc.source.type !== "web") throw new LibraryError("library.notFromWeb", "Tento dokument nevznikol zo sledovaného zdroja.")
  const src = doc.source
  const ref = refOf(src.externalId)
  const rows = await history(ref)
  const newer = newerRows(rows, src.timepoint)
  const target = newer[0] ?? rows.find(r => r.timepoint === src.timepoint) ?? null
  if (!target) throw new WebImportError("web.noVersion", `Znenie ${src.timepoint} predpisu ${actNumber(ref)} na Slov-Lexe už nie je.`)
  const fetched = await fetchVersion(ref, target)
  if (!newer.length && fetched.hash === src.contentHash) return { result: "unchanged", effectiveFrom: null, later: [] }

  // Identita a metadáta ostávajú; názov tiež (ADR-015 — mení sa len vedome).
  const meta = checkMetadata({
    title: String(doc.title ?? fetched.page.title), documentKey: String(doc.documentKey ?? ""), sectionKey: "",
    companyCode, scope: String(doc.scope ?? "company"), accessLevel: String(doc.accessLevel ?? "internal"),
    language: String(doc.language ?? "sk"), category: doc.category ? String(doc.category) : "",
    sourceType: "web", tags: Array.isArray(doc.tags) ? doc.tags : [],
    ownerDepartmentId: doc.ownerDepartmentId ? String(doc.ownerDepartmentId) : undefined,
  }, extras)
  await uploadDocument(meta, files(ref, target, fetched), actor, "version", versionMeta(target))
  const source: DocumentSource = sourceOf(ref, target, fetched, src.url)
  await col.updateOne({ companyCode, documentId }, { $set: { source } })
  return { result: newer.length ? "version" : "corrected", effectiveFrom: target.effectiveFrom, later: newer.slice(1) }
}
