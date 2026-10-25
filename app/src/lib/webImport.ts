/**
 * webImport.ts — sledovaný zdroj: predpis zo Slov-Lexu do knižnice
 * a kontrola zmien (ADR-037, krok B; D242–D246) — od fázy 2 ADR-039 (D260)
 * **z katalógu legislatívy**, nie priamym sťahovaním.
 *
 * Tá istá cesta ako import z konektora (ADR-029, `connectorImport.ts`):
 * z predpisu vznikne **koncept dokumentu** cez `uploadDocument()`. Rozdiel
 * je v súboroch — PDF je **záväzné PDF zo Slov-Lexu** (D244), Markdown je
 * text znenia **z katalógu** (`lawCatalog.ts`), ktorý Contineo drží raz pre
 * všetky organizácie. Zo Slov-Lexu sa tu sťahuje už len PDF: katalóg ho
 * nedrží, lebo potrebný je až pri odbere do knižnice (D260). Ďalej je to
 * bežný dokument: metadáta, schválenie (ADR-006), zverejnenie, hierarchia.
 *
 * **Pôvod** (`documents.source`, typ `web`) nesie adaptér, adresu,
 * identifikátor predpisu a **časovú verziu** znenia, ktoré je v knižnici.
 * Kontrola zdroja porovná katalóg s ňou: novšie znenie — aj s účinnosťou
 * v budúcnosti — je koncept nového znenia s tou účinnosťou (D243). Nič
 * zverejnené sa neprepisuje (D24). Dokument importovaný pred fázou 2 je
 * napojený samým identifikátorom (`lawLibraryLink.ts`); keď predpis
 * v katalógu nie je, kontrola ho doň pridá.
 *
 * Krok C (D247, prekonané D261): denný cron volá `draftNewVersionsFromCatalog()`
 * — to isté, čo tlačidlo, pre každý dokument so sledovaným zdrojom, a správcom
 * obsahu pošle upozornenie.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, type DocumentSource, type WebDocumentSource } from "./documents"
import { uploadDocument, checkMetadata, LibraryError } from "./libraryWrite"
import type { VersionMeta } from "./versionMeta"
import { assignDocument } from "./folders"
import { slugifyKey } from "./slug"
import { AppError } from "./appError"
import type { CodelistExtras } from "./codelists"
import { parseActRef, actId, actNumber, portalUrl, effectiveRow, newerRows, SLOV_LEX_ADAPTER, SLOV_LEX_ADAPTER_VERSION, type ActRef, type HistoryRow } from "./slovLex"
import { addAct, actById, catalogVersion, versionsOf, subscribe, type LawActVersion } from "./lawCatalog"
import { lawDocumentsFor } from "./lawLibraryLink"
import { notifyPeople } from "./notifications"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { TENANTS_COLLECTION, normalizeTenant, type Tenant } from "./tenants"
import { tenantExtras } from "./codelistsTenant"

export class WebImportError extends AppError {}

/** Strop na jeden súbor — PDF znenia má okolo 11 MB. */
const FETCH_TIMEOUT_MS = 30_000
const USER_AGENT = "Contineo/1 (+https://contineo.app; kniznica)"
/** Orgán, ktorý zákon prijal — do údajov o znení (ADR-013, D246). */
const PARLIAMENT = "Národná rada Slovenskej republiky"
/** Kto je autorom zápisov z cronu — do histórie znenia a auditu. */
const CRON_ACTOR = "cron:law-catalog"

async function fetchPdf(url: string): Promise<Buffer> {
  let r: Response
  try {
    r = await fetch(url, { headers: { "user-agent": USER_AGENT }, cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (e) {
    throw new WebImportError("web.fetchFailed", `Slov-Lex neodpovedal: ${url} (${String((e as Error)?.message ?? e)})`, { url })
  }
  if (!r.ok) throw new WebImportError("web.fetchFailed", `Slov-Lex vrátil ${r.status}: ${url}`, { url, status: r.status })
  const pdf = Buffer.from(await r.arrayBuffer())
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new WebImportError("web.pdfFailed", `Záväzné PDF sa nepodarilo stiahnuť: ${url}`, { url })
  }
  return pdf
}

function refOf(address: string): ActRef {
  const ref = parseActRef(address)
  if (!ref) throw new WebImportError("web.badAddress", `Adresa nie je predpis na Slov-Lexe: ${address.slice(0, 120)}`)
  return ref
}

// ── Katalóg ako zdroj znení ──────────────────────────────────────────────────

type VersionHead = Omit<LawActVersion, "markdown">
const iso = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null)

/** Znenie katalógu v tvare riadku histórie (rozhranie ADR-037 ostáva). Exportované kvôli testom. */
export function rowOf(v: Pick<VersionHead, "timepoint" | "effectiveFrom" | "effectiveTo" | "amendment">): HistoryRow {
  return { timepoint: v.timepoint, effectiveFrom: iso(v.effectiveFrom) ?? "", effectiveTo: iso(v.effectiveTo), amendment: v.amendment }
}

/** Predpis v katalógu — pridá sa, keď chýba (D257: katalóg rastie podľa potreby). */
async function catalogRows(ref: ActRef, actor: { companyCode: string; email: string }, now: Date): Promise<HistoryRow[]> {
  const id = actId(ref)
  if (!(await actById(id))) await addAct(id, actor, now)
  const rows = (await versionsOf(id)).map(rowOf)
  if (!rows.length) throw new WebImportError("web.noVersion", `Predpis ${actNumber(ref)} nemá v katalógu žiadne znenie.`)
  return rows
}

interface Fetched {
  version: LawActVersion
  pdf: Buffer
}

/** Text z katalógu, záväzné PDF zo Slov-Lexu (D244, D260). */
async function fetchVersion(ref: ActRef, row: HistoryRow): Promise<Fetched> {
  const version = await catalogVersion(actId(ref), row.timepoint)
  if (!version) throw new WebImportError("web.noVersion", `Znenie ${row.timepoint} predpisu ${actNumber(ref)} v katalógu nie je.`)
  return { version, pdf: await fetchPdf(version.pdfUrl) }
}

function files(ref: ActRef, row: HistoryRow, f: Fetched) {
  const base = `${slugifyKey(f.version.title.split(" č.")[0]) || "predpis"}-${ref.number}-${ref.year}-${row.timepoint}`
  return {
    pdf: { name: `${base}.pdf`, data: f.pdf },
    source: { name: `${base}.md`, data: Buffer.from(f.version.markdown, "utf8") },
  }
}

/** Údaje o znení (ADR-013): prijal parlament, účinnosť z histórie; dátum schválenia konsolidované znenie nemá (D246). */
function versionMeta(row: HistoryRow): VersionMeta {
  return { author: null, approvedBy: PARLIAMENT, approvedOn: null, effectiveFrom: new Date(row.effectiveFrom) }
}

function sourceOf(ref: ActRef, row: HistoryRow, f: Fetched, url: string): WebDocumentSource {
  return {
    type: "web", adapter: SLOV_LEX_ADAPTER, url, externalId: actId(ref), timepoint: row.timepoint,
    fetchedAt: new Date(), contentHash: f.version.contentHash, adapterVersion: SLOV_LEX_ADAPTER_VERSION, catalog: true,
  }
}

interface ExistingDoc {
  documentId: string
  title: string
  timepoint: string
}

/** Dokument organizácie, ktorý z tohto predpisu už vznikol — jeden predpis, jeden dokument (D245). */
async function existingByAct(companyCode: string, externalId: string): Promise<ExistingDoc | null> {
  const d = (await lawDocumentsFor(companyCode, [externalId])).get(externalId)
  return d ? { documentId: d.documentId, title: d.title, timepoint: d.timepoint } : null
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

/**
 * Náhľad pred importom: čo je v katalógu a či to v knižnici už je. Predpis,
 * ktorý v katalógu nie je, sa doň pridá (jedno stiahnutie znenia účinného
 * dnes) — to je jediný zápis, ktorý náhľad urobí, a je mimo organizácie.
 */
export async function previewSlovLex(companyCode: string, address: string, actor: string, now: Date = new Date()): Promise<WebPreview> {
  const ref = refOf(address)
  const rows = await catalogRows(ref, { companyCode, email: actor }, now)
  const current = effectiveRow(rows, now)
  if (!current) throw new WebImportError("web.noVersion", `Predpis ${actNumber(ref)} nemá znenie účinné k dnešnému dňu.`)
  const act = await actById(actId(ref))
  return {
    externalId: actId(ref), number: actNumber(ref), title: act?.title ?? actNumber(ref), current,
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

/**
 * Predpis z katalógu → koncept dokumentu so záväzným PDF a textom (D244,
 * D245, D260). Odber organizácie sa zároveň zvýši na „knižnica" — ten
 * zahŕňa zdroj Legislatíva na Opýtať sa.
 */
export async function importFromSlovLex(
  companyCode: string, input: WebImportInput, actor: string, extras: CodelistExtras | undefined, now: Date = new Date(),
): Promise<WebImportOutcome> {
  const ref = refOf(input.address)
  const existing = await existingByAct(companyCode, actId(ref))
  if (existing) return { documentId: existing.documentId, title: existing.title, result: "exists", effectiveFrom: null, later: [] }

  await subscribe(companyCode, actId(ref), actor, now, "library")
  const rows = await catalogRows(ref, { companyCode, email: actor }, now)
  const current = effectiveRow(rows, now)
  if (!current) throw new WebImportError("web.noVersion", `Predpis ${actNumber(ref)} nemá znenie účinné k dnešnému dňu.`)
  const fetched = await fetchVersion(ref, current)
  const kind = fetched.version.title.split(" č.")[0] || "Predpis"

  const meta = checkMetadata({
    title: fetched.version.title,
    documentKey: slugifyKey(`${kind} ${ref.number} ${ref.year}`),
    sectionKey: "",
    companyCode, scope: input.scope, accessLevel: input.accessLevel, language: input.language, category: input.category,
    sourceType: "web", tags: input.tags ?? [], ownerDepartmentId: input.ownerDepartmentId,
  }, extras)
  const r = await uploadDocument(meta, files(ref, current, fetched), actor, "new", versionMeta(current))
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const source: DocumentSource = sourceOf(ref, current, fetched, portalUrl(ref))
  await col.updateOne({ companyCode, documentId: r.documentId }, { $set: { source } })
  if (input.folderId) await assignDocument(companyCode, r.documentId, input.folderId, actor)
  return { documentId: r.documentId, title: fetched.version.title, result: "created", effectiveFrom: current.effectiveFrom, later: newerRows(rows, current.timepoint) }
}

export interface WebCheckOutcome {
  /** `version` = novšie znenie ako koncept; `corrected` = tá istá časová verzia s iným textom; `unchanged` = nič. */
  result: "unchanged" | "version" | "corrected"
  effectiveFrom: string | null
  /** Ďalšie znenia po tom, ktoré sa práve stiahlo — každá kontrola berie jedno. */
  later: HistoryRow[]
}

/**
 * Kontrola zdroja (D243): najbližšie znenie v katalógu po tom, ktoré je
 * v knižnici, ide ako koncept nového znenia s účinnosťou zo Slov-Lexu. Keď
 * novšie nie je, porovná sa odtlačok textu tej istej časovej verzie —
 * oprava na portáli je tiež nové znenie. Rozpracovaný koncept sa prepíše
 * ako pri konektore.
 */
export async function checkWebSource(
  companyCode: string, documentId: string, actor: string, extras: CodelistExtras | undefined, now: Date = new Date(),
): Promise<WebCheckOutcome> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { source: 1, title: 1, documentKey: 1, scope: 1, accessLevel: 1, language: 1, category: 1, tags: 1, ownerDepartmentId: 1 } },
  ) as { source?: DocumentSource; title?: string; documentKey?: string; scope?: string; accessLevel?: string; language?: string; category?: string; tags?: string[]; ownerDepartmentId?: string | null } | null
  if (!doc?.source || doc.source.type !== "web") throw new LibraryError("library.notFromWeb", "Tento dokument nevznikol zo sledovaného zdroja.")
  const src = doc.source
  const ref = refOf(src.externalId)
  const rows = await catalogRows(ref, { companyCode, email: actor }, now)
  const newer = newerRows(rows, src.timepoint)
  const target = newer[0] ?? rows.find(r => r.timepoint === src.timepoint) ?? null
  if (!target) throw new WebImportError("web.noVersion", `Znenie ${src.timepoint} predpisu ${actNumber(ref)} v katalógu nie je.`)
  // Odtlačok z katalógu stačí na „nič sa nezmenilo" — PDF sa sťahuje až keď treba.
  const head = (await versionsOf(actId(ref))).find(v => v.timepoint === target.timepoint)
  if (!newer.length && head && head.contentHash === src.contentHash) return { result: "unchanged", effectiveFrom: null, later: [] }
  const fetched = await fetchVersion(ref, target)

  // Identita a metadáta ostávajú; názov tiež (ADR-015 — mení sa len vedome).
  const meta = checkMetadata({
    title: String(doc.title ?? fetched.version.title), documentKey: String(doc.documentKey ?? ""), sectionKey: "",
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

// ── Cron (D261): koncepty nových znení a upozornenie ────────────────────────

export interface DraftOutcome {
  companyCode: string
  documentId: string
  title: string
  result: WebCheckOutcome["result"] | "error"
  effectiveFrom: string | null
  error?: string
}

/**
 * Pre každý dokument so sledovaným zdrojom v každej organizácii: keď má
 * katalóg novšie znenie (alebo opravený text), založí koncept nového znenia
 * a správcom obsahu organizácie pošle upozornenie. Katalóg je v tej chvíli
 * už skontrolovaný (`syncAct`), takže sa zo Slov-Lexu sťahuje len PDF.
 * Zlyhanie jedného dokumentu nezastaví ostatné.
 */
export async function draftNewVersionsFromCatalog(now: Date = new Date()): Promise<DraftOutcome[]> {
  const docs = await (await getCollection(DOCUMENTS_COLLECTION))
    .find({ "source.type": "web", "source.adapter": SLOV_LEX_ADAPTER }, { projection: { companyCode: 1, documentId: 1, title: 1, "source.externalId": 1, "source.timepoint": 1, "source.contentHash": 1 } })
    .toArray() as unknown as { companyCode: string; documentId: string; title?: string; source: { externalId: string; timepoint: string; contentHash: string } }[]
  if (!docs.length) return []

  const tenants = new Map((await (await getCollection<Tenant>(TENANTS_COLLECTION)).find({ status: "active" }).toArray()).map(t => [t.companyCode, normalizeTenant(t)]))
  const out: DraftOutcome[] = []
  for (const d of docs) {
    const tenant = tenants.get(d.companyCode)
    if (!tenant) continue
    const title = String(d.title ?? d.documentId)
    // Lacná predkontrola bez PDF: je v katalógu niečo novšie alebo iný text?
    const heads = await versionsOf(d.source.externalId)
    const newer = heads.some(v => v.timepoint > d.source.timepoint)
    const same = heads.find(v => v.timepoint === d.source.timepoint)
    if (!newer && (!same || same.contentHash === d.source.contentHash)) continue
    try {
      const r = await checkWebSource(d.companyCode, d.documentId, CRON_ACTOR, tenantExtras(tenant), now)
      out.push({ companyCode: d.companyCode, documentId: d.documentId, title, result: r.result, effectiveFrom: r.effectiveFrom })
      if (r.result !== "unchanged") await notifyContentAdmins(d.companyCode, d.documentId, title, r.effectiveFrom)
    } catch (e) {
      out.push({ companyCode: d.companyCode, documentId: d.documentId, title, result: "error", effectiveFrom: null, error: String((e as Error)?.message ?? e).slice(0, 300) })
    }
  }
  return out
}

async function notifyContentAdmins(companyCode: string, documentId: string, title: string, effectiveFrom: string | null): Promise<void> {
  const people = await (await getCollection<Person>(PERSONS_COLLECTION))
    .find({ companyCode, roles: "content-admin", status: { $ne: "inactive" } } as never, { projection: { _id: 0, id: 1 } }).toArray()
  await notifyPeople({
    companyCode, personIds: people.map(p => p.id), kind: "lawVersionDraft",
    params: { documentId, documentTitle: title, versionLabel: effectiveFrom ?? "" },
  })
}
