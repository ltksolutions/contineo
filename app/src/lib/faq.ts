/**
 * faq.ts — FAQ ako druh dokumentu v knižnici (ADR-028, D164).
 *
 * Znenie FAQ nie je text z PDF, ale zoznam **záznamov**: kanonická otázka,
 * ďalšie znenia otázky (z mailov), odpoveď, zdroje (dokument a článok)
 * a komu je určená. Všetko ostatné má FAQ spoločné s každým iným dokumentom:
 * `companyCode`, prístupovú úroveň, priečinok, prípravu → schválenie →
 * zverejnenie (ADR-014), znenia a archiváciu. Preto sa tu nevymýšľa nová
 * kolekcia — D11 (revízia 2026-09-15) to už raz odmietlo.
 *
 * ## Čo z toho vyplýva pre index
 *
 * Jeden záznam = jeden úsek so `sourceType: "qa"`, teda **tá istá vetva
 * vyhľadávania ako kurovaný pár** (`lib/curation.ts`): nájde sa pri otázke
 * o dnešku, nesie `derivedFrom` na zdrojové predpisy, nové znenie predpisu
 * ho **expiruje** (`expireCurationFor()`) a prístup sa **odvodzuje**
 * najprísnejšou stranou (`strictestAccessLevel()`) — z úrovne samotného
 * FAQ dokumentu a z úrovní všetkých zdrojov. Záznam bez zdroja má úroveň
 * dokumentu; v tom sa od páru líši zámerne, lebo pár bez zdroja nemá odkiaľ
 * úroveň zobrať, kým FAQ dokument ju má nastavenú.
 *
 * Úsek nesie `faqVersionId`, **nie `versionId`**. Vetva „platné znenia"
 * (`versionId` + `superseded: false`) by úsek našla aj po expirácii, lebo
 * expirácia mení len `isActive` — a práve `isActive` je to, čo vetva
 * overených odpovedí rešpektuje. Dve cesty k tomu istému úseku by si
 * navzájom kazili pravidlá; takto má jednu.
 *
 * ## Prečo PDF
 *
 * Pri každom uložení záznamov sa zloží Markdown aj PDF (`faqPdf.ts`) a uložia
 * sa ako koncept — presne tie polia, aké by vyplnilo nahratie súboru. Brány
 * „PDF je povinné" (ADR-011) tak platia bez výnimky a schvaľovateľ vidí
 * znenie v tej istej podobe ako pri predpise.
 */

import { createHash, randomBytes } from "node:crypto"
import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, type VersionFile } from "./documents"
import {
  CHUNKS_COLLECTION, LibraryError, uploadDocument, releaseDraftFiles,
  type DocumentMetadata,
} from "./libraryWrite"
import { saveFile } from "./fileStore"
import { strictestAccessLevel, QA_SOURCE_TYPE } from "./curation"
import { chunkingStrategyFor } from "./codelists"
import { writeAudit } from "./audit"
import { dictionary, isUiLanguage, type UiLanguage } from "./i18n"
import { renderFaqPdf, sourceLine, type FaqPdfTexts } from "./faqPdf"

export const MAX_QUESTION = 300
export const MAX_ANSWER = 6000
export const MAX_VARIANTS = 10
export const MAX_SOURCES = 5
export const MAX_AUDIENCE = 10

export interface FaqSource {
  /** `documents.documentId` zdrojového predpisu. */
  documentId: string
  /** Článok, ak ho záznam cituje — voľný text ako `articleRef` úseku. */
  articleRef: string | null
}

export interface FaqEntry {
  /** Stabilný v rámci dokumentu; prežíva znenia, aby sa dalo porovnať „čo sa zmenilo". */
  id: string
  question: string
  variants: string[]
  answer: string
  sources: FaqSource[]
  /** Komu je odpoveď určená — voľné štítky (klubový manažér, rozhodca…). */
  audience: string[]
  /**
   * Odkiaľ záznam vznikol, keď ho navrhla ťažba histórie schránky (D165):
   * kanál, vlákna a `messageId` správ. Telá správ sa neukladajú.
   */
  origin?: { channelKey: string; threadRefs: string[]; messageIds: string[]; minedAt: Date; model: string } | null
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
}

export type FaqEntryInput = Pick<FaqEntry, "question" | "variants" | "answer" | "sources" | "audience">

/** Je dokument FAQ? Rozhoduje druh, nie názov (ADR-027 krok 2). */
export function isFaqCategory(category: string | null | undefined): boolean {
  return chunkingStrategyFor(category) === "entries"
}

export function newEntryId(): string {
  return `e${randomBytes(6).toString("hex")}`
}

function tidy(s: unknown): string {
  return String(s ?? "").replace(/\r\n?/g, "\n").trim()
}
function tidyList(xs: unknown, max: number, splitter: RegExp = /\n/): string[] {
  const list = Array.isArray(xs) ? xs : String(xs ?? "").split(splitter)
  const out: string[] = []
  for (const x of list) {
    const v = String(x ?? "").replace(/\s+/g, " ").trim()
    if (v && !out.includes(v)) out.push(v)
  }
  return out.slice(0, max)
}

/** Overí a oreže záznam z formulára. Vyhadzuje `LibraryError`. */
export function checkEntry(input: {
  question?: unknown
  variants?: unknown
  answer?: unknown
  sources?: { documentId?: unknown; articleRef?: unknown }[]
  audience?: unknown
}): FaqEntryInput {
  const question = tidy(input.question).replace(/\s+/g, " ")
  if (!question) throw new LibraryError("library.faqQuestionRequired", "Otázka je povinná — bez nej záznam nemá čo zodpovedať.")
  const answer = tidy(input.answer)
  if (!answer) throw new LibraryError("library.faqAnswerRequired", "Odpoveď je povinná — otázka bez odpovede do FAQ nepatrí.")
  if (question.length > MAX_QUESTION || answer.length > MAX_ANSWER) {
    throw new LibraryError("library.faqTooLong", "Záznam je príliš dlhý — otázka do 300 a odpoveď do 6 000 znakov.", {
      question: MAX_QUESTION, answer: MAX_ANSWER,
    })
  }
  const sources: FaqSource[] = []
  for (const s of input.sources ?? []) {
    const documentId = tidy(s.documentId).toLowerCase()
    if (!documentId) continue
    if (sources.some(x => x.documentId === documentId)) continue
    sources.push({ documentId, articleRef: tidy(s.articleRef).replace(/\s+/g, " ") || null })
  }
  return {
    question,
    variants: tidyList(input.variants, MAX_VARIANTS).filter(v => v !== question),
    answer,
    sources: sources.slice(0, MAX_SOURCES),
    audience: tidyList(input.audience, MAX_AUDIENCE, /[,\n]/),
  }
}

// ── texty v jazyku dokumentu ───────────────────────────────────────────────

/** Jazyk dokumentu môže byť mimo jazykov rozhrania — vtedy slovenčina. */
export function documentLanguage(language: unknown): UiLanguage {
  return isUiLanguage(language) ? language : "sk"
}

export function faqTexts(language: UiLanguage): FaqPdfTexts & { question: string } {
  const t = dictionary(language).library.faq
  return {
    intro: t.mdIntro, variants: t.mdVariants, answer: t.mdAnswer, sources: t.mdSources,
    audience: t.mdAudience, empty: t.mdEmpty, question: t.mdQuestion, page: t.pdfPage,
  }
}

/**
 * Markdown zo záznamov — text znenia (`draftMarkdown`, `versions[].markdown`).
 * Nerobí sa z neho členenie (to robia záznamy), ale je to text, ktorý sa
 * porovnáva medzi zneniami a z ktorého sa počíta identita (D96).
 */
export function faqMarkdown(title: string, entries: FaqEntry[], language: UiLanguage, titles: Map<string, string>): string {
  const t = faqTexts(language)
  const parts = [`# ${title}`, "", t.intro, ""]
  if (!entries.length) parts.push(t.empty, "")
  entries.forEach((e, i) => {
    parts.push(`## ${i + 1}. ${e.question}`, "")
    if (e.variants.length) parts.push(`*${t.variants}:* ${e.variants.join(" · ")}`, "")
    parts.push(e.answer, "")
    if (e.sources.length) parts.push(`*${t.sources}:* ${e.sources.map(s => sourceLine(s, titles)).join("; ")}`, "")
    if (e.audience.length) parts.push(`*${t.audience}:* ${e.audience.join(", ")}`, "")
  })
  return parts.join("\n").trim() + "\n"
}

/**
 * Text úseku pre index — rovnaký tvar ako kurovaný pár („Otázka: … /
 * Odpoveď: …"), aby model videl otázku aj odpoveď v jednom úseku a ďalšie
 * znenia otázky zväčšili šancu, že sa úsek nájde aj na inak položenú otázku.
 */
export function faqChunkText(entry: FaqEntry, language: UiLanguage): string {
  const t = faqTexts(language)
  const lines = [`${t.question}: ${entry.question}`]
  if (entry.variants.length) lines.push(`${t.variants}: ${entry.variants.join(" | ")}`)
  lines.push("", `${t.answer}: ${entry.answer}`)
  return lines.join("\n")
}

/** Odtlačok záznamov — `chunkingId` znenia FAQ (nič sa nereže, ale pole má byť). */
export function entriesFingerprint(entries: FaqEntry[]): string {
  const canonical = entries.map(e => ({
    id: e.id, q: e.question, v: e.variants, a: e.answer,
    s: e.sources.map(s => `${s.documentId}|${s.articleRef ?? ""}`), p: e.audience,
  }))
  return createHash("sha256").update(JSON.stringify({ faq: 1, canonical })).digest("hex")
}

export interface FaqChunkContext {
  companyCode: string
  documentId: string
  versionId: string
  scope: string
  language: string
  tags: string[]
  /** Úroveň samotného FAQ dokumentu — vstupuje do najprísnejšej strany. */
  documentAccessLevel: string
  /** Úrovne úsekov zdrojových dokumentov podľa `documentId` (`sourceAccessLevels()`). */
  sourceLevels: Map<string, readonly (string | null | undefined)[]>
  effectiveFrom: Date
  now: Date
}

/** Úroveň jedného záznamu — jediné miesto, kde sa o nej rozhoduje. */
export function entryAccessLevel(entry: Pick<FaqEntry, "sources">, ctx: Pick<FaqChunkContext, "documentAccessLevel" | "sourceLevels">): "public" | "internal" {
  // Zdroj bez úsekov (nezverejnený, archivovaný) sa počíta ako neznámy — a
  // neznámy je interný (`strictestAccessLevel`). Nevedieť znamená zavrieť.
  const levels = [ctx.documentAccessLevel, ...entry.sources.flatMap(s => ctx.sourceLevels.get(s.documentId) ?? [undefined])]
  return strictestAccessLevel(levels)
}

/** Úseky do `document_chunks` — čisté, bez databázy. */
export function faqChunks(entries: FaqEntry[], ctx: FaqChunkContext): Record<string, unknown>[] {
  const language = documentLanguage(ctx.language)
  const chunkingId = entriesFingerprint(entries)
  return entries.map((e, i) => ({
    chunkIndex: i,
    heading: e.question,
    text: faqChunkText(e, language),
    articleRef: null,
    chunkType: QA_SOURCE_TYPE,
    sourceType: QA_SOURCE_TYPE,
    documentId: ctx.documentId,
    // Zdroje, z ktorých odpoveď vychádza — nové znenie ktoréhokoľvek z nich
    // záznam expiruje (`expireCurationFor`). Samotné FAQ sem nepatrí.
    derivedFrom: [...new Set(e.sources.map(s => s.documentId).filter(d => d !== ctx.documentId))],
    faqVersionId: ctx.versionId,
    faqEntryId: e.id,
    chunkingId,
    companyCode: ctx.companyCode,
    scope: ctx.scope,
    accessLevel: entryAccessLevel(e, ctx),
    language: ctx.language,
    tags: ctx.tags,
    embeddingModel: process.env.EMBEDDING_MODEL ?? "voyage-4",
    embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1024),
    embeddingProvider: process.env.EMBEDDING_KIND ?? "atlas-auto",
    embeddedAt: ctx.now,
    isActive: true,
    effectiveFrom: ctx.effectiveFrom,
    effectiveTo: null,
    createdAt: ctx.now,
  }))
}

// ── databáza ───────────────────────────────────────────────────────────────

type RawDoc = {
  documentId: string
  title?: string
  category?: string | null
  accessLevel?: string
  scope?: string
  language?: string
  tags?: string[]
  draftFaq?: FaqEntry[]
  draftPdf?: VersionFile | null
  draftSource?: VersionFile | null
  versions?: { versionId: string; faq?: FaqEntry[]; isActive?: boolean }[]
}

/**
 * Úrovne úsekov zdrojových dokumentov — rovnaké čítanie ako
 * `reconcileCurationAccess()`: z ich **vlastných** úsekov, nie z párov.
 */
export async function sourceAccessLevels(
  companyCode: string,
  documentIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (!documentIds.length) return out
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  const rows = await chunkCol
    .find(
      { companyCode, documentId: { $in: documentIds }, sourceType: { $ne: QA_SOURCE_TYPE } },
      { projection: { documentId: 1, accessLevel: 1 } },
    )
    .toArray() as unknown as { documentId?: string; accessLevel?: string }[]
  for (const r of rows) {
    const key = r.documentId ?? ""
    out.set(key, [...(out.get(key) ?? []), r.accessLevel ?? ""])
  }
  return out
}

/** Názvy dokumentov podľa `documentId` — kópia do textu znenia. */
export async function documentTitles(companyCode: string, documentIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!documentIds.length) return out
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const rows = await col
    .find({ companyCode, documentId: { $in: documentIds } }, { projection: { documentId: 1, title: 1 } })
    .toArray() as unknown as { documentId: string; title?: string }[]
  for (const r of rows) out.set(r.documentId, String(r.title ?? r.documentId))
  return out
}

/** Overí, že všetky zdroje záznamu sú dokumenty tejto organizácie (D32). */
export async function checkSources(companyCode: string, sources: FaqSource[]): Promise<void> {
  if (!sources.length) return
  const titles = await documentTitles(companyCode, sources.map(s => s.documentId))
  const missing = sources.find(s => !titles.has(s.documentId))
  if (missing) {
    throw new LibraryError("library.faqSourceUnknown", "Zdrojový dokument tu nie je.", { documentId: missing.documentId })
  }
}

async function renderFiles(companyCode: string, doc: RawDoc, entries: FaqEntry[]): Promise<{ markdown: string; pdf: Uint8Array }> {
  const language = documentLanguage(doc.language)
  const titles = await documentTitles(companyCode, entries.flatMap(e => e.sources.map(s => s.documentId)))
  const title = String(doc.title ?? "")
  const markdown = faqMarkdown(title, entries, language, titles)
  const pdf = await renderFaqPdf({ title, entries, texts: faqTexts(language), titles })
  return { markdown, pdf }
}

/**
 * Založí FAQ dokument: prázdny zoznam záznamov, z neho Markdown a PDF, a
 * ďalej **tá istá cesta ako nahratie** (`uploadDocument`) — kolízia kľúča,
 * oddelenie, audit, koncept. Druh je vždy FAQ bez ohľadu na vstup.
 */
export async function createFaqDocument(meta: DocumentMetadata, actor: string): Promise<{ documentId: string }> {
  const faqMeta: DocumentMetadata = { ...meta, category: "faq" }
  if (!isFaqCategory(faqMeta.category)) {
    throw new LibraryError("library.notFaq", "Druh FAQ v číselníku chýba.")
  }
  const language = documentLanguage(meta.language)
  const title = meta.title
  const markdown = faqMarkdown(title, [], language, new Map())
  const pdf = await renderFaqPdf({ title, entries: [], texts: faqTexts(language), titles: new Map() })
  const base = `${meta.documentKey || "faq"}`
  const r = await uploadDocument(
    faqMeta,
    { pdf: { name: `${base}.pdf`, data: Buffer.from(pdf) }, source: { name: `${base}.md`, data: Buffer.from(markdown, "utf8") } },
    actor,
    "new",
  )
  const col = await getCollection(DOCUMENTS_COLLECTION)
  await col.updateOne({ documentId: r.documentId, companyCode: meta.companyCode }, { $set: { draftFaq: [] } })
  return { documentId: r.documentId }
}

export interface FaqDraft {
  documentId: string
  title: string
  accessLevel: string
  language: UiLanguage
  entries: FaqEntry[]
  /** Záznamy v platnom (aktívnom) znení — na porovnanie „čo sa zmenilo". */
  published: FaqEntry[]
}

export async function faqDraft(companyCode: string, documentId: string): Promise<FaqDraft | null> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ companyCode, documentId }) as RawDoc | null
  if (!doc) return null
  if (!isFaqCategory(doc.category)) throw new LibraryError("library.notFaq", "Tento dokument nie je FAQ.")
  const active = (doc.versions ?? []).find(v => v.isActive)
  return {
    documentId,
    title: String(doc.title ?? ""),
    accessLevel: String(doc.accessLevel ?? "internal"),
    language: documentLanguage(doc.language),
    entries: Array.isArray(doc.draftFaq) ? doc.draftFaq : [],
    published: active?.faq ?? [],
  }
}

/**
 * Zapíše záznamy ako koncept: Markdown, PDF, zdroj a zoznam záznamov naraz.
 * Predošlé súbory konceptu sa uvoľnia (ak ich nedrží žiadne znenie).
 */
async function writeDraft(companyCode: string, doc: RawDoc, entries: FaqEntry[], actor: string): Promise<void> {
  const { markdown, pdf } = await renderFiles(companyCode, doc, entries)
  const now = new Date()
  const base = String(doc.documentId).split(":")[1] || "faq"
  const pdfBuffer = Buffer.from(pdf)
  const mdBuffer = Buffer.from(markdown, "utf8")
  const storedPdf = await saveFile(companyCode, `${base}.pdf`, "application/pdf", pdfBuffer, actor)
  const storedMd = await saveFile(companyCode, `${base}.md`, "text/markdown", mdBuffer, actor)
  const asFile = (s: typeof storedPdf, type: VersionFile["type"]): VersionFile => ({
    id: s.id, name: s.name, bytes: s.bajtov, sha256: s.sha256, type, uploadedAt: now, uploadedBy: actor,
  })
  const col = await getCollection(DOCUMENTS_COLLECTION)
  await col.updateOne(
    { documentId: doc.documentId, companyCode },
    {
      $set: {
        draftFaq: entries,
        draftMarkdown: markdown,
        draftPdf: asFile(storedPdf, "pdf"),
        draftSource: asFile(storedMd, "markdown"),
        originalFile: {
          id: storedMd.id, name: storedMd.name, contentType: "text/markdown", bytes: storedMd.bajtov,
          type: "markdown", uploadedAt: now, uploadedBy: actor,
        },
        processingStatus: "converted",
        processingError: null,
        updatedAt: now,
        updatedBy: actor,
      },
    },
  )
  await releaseDraftFiles(companyCode, doc.documentId, [doc.draftPdf, doc.draftSource], [storedPdf.id, storedMd.id])
    .catch(() => {}) // upratovanie; zápis už prebehol a nemá kvôli nemu zlyhať
}

async function loadFaqDoc(companyCode: string, documentId: string): Promise<RawDoc> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ companyCode, documentId }) as RawDoc | null
  if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")
  if (!isFaqCategory(doc.category)) throw new LibraryError("library.notFaq", "Tento dokument nie je FAQ.")
  return doc
}

/** Pridá alebo upraví záznam (podľa `id`). Vracia uložený záznam. */
export async function saveFaqEntry(
  companyCode: string,
  documentId: string,
  input: FaqEntryInput & { id?: string | null; origin?: FaqEntry["origin"] },
  actor: string,
): Promise<FaqEntry> {
  const doc = await loadFaqDoc(companyCode, documentId)
  await checkSources(companyCode, input.sources)
  const entries = Array.isArray(doc.draftFaq) ? [...doc.draftFaq] : []
  const now = new Date()
  const existing = input.id ? entries.find(e => e.id === input.id) : undefined
  if (input.id && !existing) throw new LibraryError("library.faqEntryNotFound", "Taký záznam v tomto FAQ nie je.")
  const saved: FaqEntry = existing
    ? { ...existing, question: input.question, variants: input.variants, answer: input.answer, sources: input.sources, audience: input.audience, updatedAt: now, updatedBy: actor }
    : {
        id: newEntryId(), question: input.question, variants: input.variants, answer: input.answer,
        sources: input.sources, audience: input.audience, ...(input.origin ? { origin: input.origin } : {}),
        createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
      }
  const next = existing ? entries.map(e => (e.id === saved.id ? saved : e)) : [...entries, saved]
  await writeDraft(companyCode, doc, next, actor)
  await writeAudit({
    companyCode, subject: "document", action: existing ? "faq-zaznam-upraveny" : "faq-zaznam-pridany", actor,
    targetId: documentId, targetLabel: String(doc.title ?? documentId), note: saved.question,
  })
  return saved
}

export async function removeFaqEntry(companyCode: string, documentId: string, entryId: string, actor: string): Promise<void> {
  const doc = await loadFaqDoc(companyCode, documentId)
  const entries = Array.isArray(doc.draftFaq) ? doc.draftFaq : []
  const gone = entries.find(e => e.id === entryId)
  if (!gone) throw new LibraryError("library.faqEntryNotFound", "Taký záznam v tomto FAQ nie je.")
  await writeDraft(companyCode, doc, entries.filter(e => e.id !== entryId), actor)
  await writeAudit({
    companyCode, subject: "document", action: "faq-zaznam-odstraneny", actor,
    targetId: documentId, targetLabel: String(doc.title ?? documentId), note: gone.question,
  })
}

export interface FaqEntryState {
  isActive: boolean
  accessLevel: string
  effectiveTo: Date | null
}

/**
 * Stav záznamov platného znenia podľa úsekov v indexe — **odvodený**, nie
 * uložený (D27). Neaktívny úsek pri aktívnom znení znamená, že sa zmenil
 * zdrojový predpis a odpoveď treba skontrolovať.
 */
export async function faqEntryStates(companyCode: string, documentId: string, versionId: string): Promise<Map<string, FaqEntryState>> {
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  const rows = await chunkCol
    .find({ companyCode, documentId, sourceType: QA_SOURCE_TYPE, faqVersionId: versionId }, { projection: { faqEntryId: 1, isActive: 1, accessLevel: 1, effectiveTo: 1 } })
    .toArray() as unknown as { faqEntryId?: string; isActive?: boolean; accessLevel?: string; effectiveTo?: Date | null }[]
  const out = new Map<string, FaqEntryState>()
  for (const r of rows) {
    if (!r.faqEntryId) continue
    out.set(r.faqEntryId, { isActive: Boolean(r.isActive), accessLevel: String(r.accessLevel ?? ""), effectiveTo: r.effectiveTo ?? null })
  }
  return out
}

/**
 * Prepočet úsekov FAQ po zmene metadát **samotného FAQ** (`saveMetadata`):
 * rozsah, jazyk a štítky sa skopírujú, úroveň sa odvodí znova z úrovne
 * dokumentu a zdrojov. Hromadná kópia v `saveMetadata` úseky `qa` vynecháva
 * (D11), takže bez tohto by prepnutie FAQ na verejné nič nezmenilo.
 */
export async function reconcileFaqAccess(companyCode: string, documentId: string): Promise<number> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ companyCode, documentId }, { projection: { accessLevel: 1, scope: 1, language: 1, tags: 1, versions: 1 } }) as RawDoc | null
  if (!doc) return 0
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  const rows = await chunkCol
    .find({ companyCode, documentId, sourceType: QA_SOURCE_TYPE, faqVersionId: { $exists: true } }, { projection: { faqVersionId: 1, faqEntryId: 1, derivedFrom: 1, accessLevel: 1 } })
    .toArray() as unknown as { _id: unknown; faqVersionId: string; faqEntryId: string; derivedFrom?: string[]; accessLevel?: string }[]
  if (!rows.length) return 0
  const levels = await sourceAccessLevels(companyCode, [...new Set(rows.flatMap(r => r.derivedFrom ?? []))])
  const ctx = { documentAccessLevel: String(doc.accessLevel ?? ""), sourceLevels: levels }
  let changed = 0
  for (const r of rows) {
    const level = entryAccessLevel({ sources: (r.derivedFrom ?? []).map(d => ({ documentId: d, articleRef: null })) }, ctx)
    await chunkCol.updateOne(
      { _id: r._id, companyCode } as never,
      { $set: { accessLevel: level, scope: doc.scope, language: doc.language, tags: doc.tags ?? [] } },
    )
    if (level !== r.accessLevel) changed += 1
  }
  return changed
}
