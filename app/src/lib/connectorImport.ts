/**
 * connectorImport.ts — import článkov z MCP konektora do knižnice
 * (ADR-029, použitie B; pôvodne `INGESTION_zdroje_reconciliation.md` kap. 2.2).
 *
 * Kurátor článok **vyhľadá** cez konektor (server nemá zoznam súborov),
 * vyberie, a z každého vznikne **koncept dokumentu** tou istou cestou ako
 * nahratý súbor: `uploadDocument()` s Markdownom ako zdrojom a PDF
 * vysádzaným u nás (ADR-011). Ďalej je to bežný dokument — metadáta,
 * schvaľovanie (ADR-006), zverejnenie, pridelenie. Konektor je len vstup.
 *
 * **Pôvod** (`documents.source`) nesie, odkiaľ obsah je a ako vyzeral:
 * `externalId` je cesta na serveri (na opätovné stiahnutie), `contentHash`
 * odtlačok textu po redukcii — server nedáva dátum zmeny, takže „zmenilo
 * sa to?" vie povedať len hash. Nové znenie z re-syncu ide ako koncept
 * ďalšieho znenia; nič zverejnené sa neprepisuje (D24).
 *
 * Redukcia konektora (D176) sa uplatní aj tu: čo sa do organizácie nemá
 * dostať živo, nemá sa dostať ani kópiou — kurátor rediguje už zúžený text.
 */

import { createHash } from "node:crypto"
import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, type DocumentSource } from "./documents"
import { uploadDocument, checkMetadata, makeDocumentId, LibraryError, type DocumentMetadata } from "./libraryWrite"
import { connectorById, type Connector, ConnectorError } from "./connectors"
import { withClient, toolCaller, type CallContext } from "./mcp/client"
import { profileFor, type LiveArticle } from "./mcp/profiles"
import { reduceArticle } from "./liveSources"
import { renderMarkdownPdf } from "./markdownPdf"
import { assignDocument } from "./folders"
import { slugifyKey } from "./slug"
import { dictionary, type UiLanguage } from "./i18n"
import type { CodelistExtras } from "./codelists"

export const IMPORT_ADAPTER_VERSION = "1"
/** Najviac článkov v jednom hľadaní na import — server vráti najviac 10. */
export const IMPORT_SEARCH_LIMIT = 10

export function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex")
}

export interface ImportCandidate {
  externalId: string
  title: string
  group?: string
  /** Úryvok po redukcii — kurátor vidí, čo by sa importovalo. */
  excerpt: string
  /** Dokument, ktorý z tejto cesty už vznikol (ten istý `externalId`). */
  existingDocumentId: string | null
  /** Platí len pri existujúcom: text na serveri sa od importu zmenil. */
  changed: boolean
}

async function ingestConnector(companyCode: string, connectorId: string): Promise<Connector> {
  const c = await connectorById(companyCode, connectorId)
  if (!c) throw new ConnectorError("connector.notFound", "Taký konektor tu nie je.")
  if (!c.uses.ingest.enabled) throw new ConnectorError("connector.ingestOff", "Konektor nemá zapnutý import do knižnice.")
  if (!profileFor(c.profile).search || !profileFor(c.profile).fetch) {
    throw new ConnectorError("connector.noImportProfile", "Profil tohto servera import nepodporuje.")
  }
  return c
}

/** Dokumenty organizácie, ktoré vznikli z tohto konektora — podľa cesty na serveri. */
async function importedByPath(companyCode: string, connectorId: string): Promise<Map<string, { documentId: string; contentHash: string }>> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const rows = await col.find(
    { companyCode, "source.type": "mcp", "source.connector": connectorId },
    { projection: { documentId: 1, "source.externalId": 1, "source.contentHash": 1 } },
  ).toArray() as unknown as { documentId: string; source: DocumentSource }[]
  return new Map(rows.map(r => [r.source.externalId, { documentId: r.documentId, contentHash: r.source.contentHash }]))
}

/** Hľadanie na import — celé články po redukcii, s informáciou, čo už v knižnici je. */
export async function searchForImport(
  companyCode: string, connectorId: string, query: string, scopeKey: string, redirectUrl: string, ctx: CallContext,
): Promise<ImportCandidate[]> {
  const c = await ingestConnector(companyCode, connectorId)
  const scope = c.scopes.find(s => s.key === scopeKey)
  const filter = scope?.filter ?? {}
  const profile = profileFor(c.profile)
  const articles = await withClient(c, redirectUrl, client => profile.search!(toolCaller(client), query, filter, IMPORT_SEARCH_LIMIT), ctx, "search", 15_000)
  const known = await importedByPath(companyCode, connectorId)
  const policy = c.uses.retrieval.reduction
  return articles.map(a => {
    const text = reduceArticle(a.text, policy)
    const existing = known.get(a.externalId) ?? null
    return {
      externalId: a.externalId, title: a.title, group: a.group,
      excerpt: text.replace(/\s+/g, " ").slice(0, 280),
      existingDocumentId: existing?.documentId ?? null,
      // Úryvok z hľadania je celý článok, takže hash sedí s tým, čo uloží import.
      changed: existing ? existing.contentHash !== contentHash(text) : false,
    }
  })
}

export interface ImportInput {
  connectorId: string
  externalIds: string[]
  folderId: string | null
  category: string
  accessLevel: string
  language: string
  scope: string
  ownerDepartmentId?: string
  tags?: string[]
}

export interface ImportOutcome {
  externalId: string
  title: string
  documentId: string | null
  /** `created` = nový koncept, `version` = koncept nového znenia existujúceho, `unchanged` = nič nové, `failed`. */
  result: "created" | "version" | "unchanged" | "failed"
  error?: string
}

async function fetchReduced(c: Connector, externalId: string, redirectUrl: string, ctx: CallContext): Promise<LiveArticle | null> {
  const profile = profileFor(c.profile)
  const a = await withClient(c, redirectUrl, client => profile.fetch!(toolCaller(client), externalId), ctx, "fetch", 15_000)
  if (!a) return null
  return { ...a, text: reduceArticle(a.text, c.uses.retrieval.reduction) }
}

function originLine(c: Connector, a: LiveArticle, language: UiLanguage): string {
  return dictionary(language).library.connectorImport.pdfOrigin(c.name, a.externalId)
}

/**
 * Jeden článok → koncept dokumentu (nový alebo nové znenie). Vracia, čo sa
 * stalo; výnimku nehádže — zoznam článkov sa spracúva po jednom a jedno
 * zlyhanie nemá zhodiť ostatné.
 */
async function importOne(
  c: Connector, externalId: string, input: ImportInput, actor: string, language: UiLanguage, extras: CodelistExtras | undefined,
  known: Map<string, { documentId: string; contentHash: string }>, redirectUrl: string, ctx: CallContext,
): Promise<ImportOutcome> {
  let a: LiveArticle | null
  try {
    a = await fetchReduced(c, externalId, redirectUrl, ctx)
  } catch (e) {
    return { externalId, title: externalId, documentId: null, result: "failed", error: String((e as Error)?.message ?? e).slice(0, 200) }
  }
  if (!a || !a.text.trim()) return { externalId, title: externalId, documentId: null, result: "failed", error: "empty" }
  const hash = contentHash(a.text)
  const existing = known.get(externalId)
  if (existing && existing.contentHash === hash) {
    return { externalId, title: a.title, documentId: existing.documentId, result: "unchanged" }
  }
  const col = await getCollection(DOCUMENTS_COLLECTION)
  try {
    let documentId: string
    let meta: DocumentMetadata
    if (existing) {
      // Nové znenie existujúceho dokumentu: identita ostáva, metadáta tiež.
      const doc = await col.findOne({ companyCode: c.companyCode, documentId: existing.documentId }) as Record<string, unknown> | null
      if (!doc) throw new LibraryError("library.documentNotFound", "Taký dokument tu nie je.")
      meta = checkMetadata({
        title: String(doc.title ?? a.title), documentKey: String(doc.documentKey ?? ""), sectionKey: "",
        companyCode: c.companyCode, scope: String(doc.scope ?? input.scope), accessLevel: String(doc.accessLevel ?? input.accessLevel),
        language: String(doc.language ?? input.language), category: doc.category ? String(doc.category) : input.category,
        sourceType: "mcp", tags: Array.isArray(doc.tags) ? doc.tags as string[] : [],
        ownerDepartmentId: doc.ownerDepartmentId ? String(doc.ownerDepartmentId) : undefined,
      }, extras)
      documentId = existing.documentId
    } else {
      // Kľúč z názvu článku; pri zrážke s iným dokumentom sa pridá skupina (projekt).
      let key = slugifyKey(a.title).toLowerCase()
      const base = { companyCode: c.companyCode, scope: input.scope, accessLevel: input.accessLevel, language: input.language, category: input.category, sourceType: "mcp", tags: input.tags ?? [], ownerDepartmentId: input.ownerDepartmentId, sectionKey: "" }
      if (await col.countDocuments({ companyCode: c.companyCode, documentId: makeDocumentId({ companyCode: c.companyCode, documentKey: key }) }, { limit: 1 })) {
        key = slugifyKey(`${a.group ?? "mcp"} ${a.title}`).toLowerCase()
      }
      meta = checkMetadata({ ...base, title: a.title, documentKey: key }, extras)
      documentId = makeDocumentId(meta)
    }
    const markdown = `# ${a.title}\n\n${a.text}\n`
    const pdf = await renderMarkdownPdf({
      title: a.title, markdown: a.text, author: c.name,
      texts: { page: dictionary(language).library.faq.pdfPage, origin: originLine(c, a, language) },
    })
    const file = slugifyKey(a.title) || "article"
    const r = await uploadDocument(
      meta,
      { pdf: { name: `${file}.pdf`, data: Buffer.from(pdf) }, source: { name: `${file}.md`, data: Buffer.from(markdown, "utf8") } },
      actor,
      existing ? "version" : "new",
    )
    const source: DocumentSource = {
      type: "mcp", connector: c.id, connectorName: c.name, externalId, group: a.group ?? null,
      fetchedAt: new Date(), contentHash: hash, adapterVersion: IMPORT_ADAPTER_VERSION,
    }
    await col.updateOne({ companyCode: c.companyCode, documentId: r.documentId }, { $set: { source } })
    if (!existing && input.folderId) await assignDocument(c.companyCode, r.documentId, input.folderId, actor)
    return { externalId, title: a.title, documentId: r.documentId, result: existing ? "version" : "created" }
  } catch (e) {
    return { externalId, title: a.title, documentId: existing?.documentId ?? null, result: "failed", error: String((e as Error)?.message ?? e).slice(0, 200) }
  }
}

export async function importArticles(
  companyCode: string, input: ImportInput, actor: string, language: UiLanguage, extras: CodelistExtras | undefined,
  redirectUrl: string, ctx: CallContext,
): Promise<ImportOutcome[]> {
  const c = await ingestConnector(companyCode, input.connectorId)
  const ids = [...new Set(input.externalIds.map(x => x.trim()).filter(Boolean))].slice(0, IMPORT_SEARCH_LIMIT)
  if (!ids.length) throw new ConnectorError("connector.nothingSelected", "Nie je vybraný žiadny článok.")
  const known = await importedByPath(companyCode, c.id)
  const out: ImportOutcome[] = []
  // Po jednom, nie súbežne: každý import píše do GridFS a do `documents`,
  // a chyba jedného má ostať chybou jedného.
  for (const id of ids) out.push(await importOne(c, id, input, actor, language, extras, known, redirectUrl, ctx))
  return out
}

/**
 * Re-sync jedného dokumentu: stiahne článok znova; keď sa text zmenil,
 * vznikne koncept nového znenia. Nič zverejnené sa nemení.
 */
export async function resyncDocument(
  companyCode: string, documentId: string, actor: string, language: UiLanguage, extras: CodelistExtras | undefined,
  redirectUrl: string, ctx: CallContext,
): Promise<ImportOutcome> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ companyCode, documentId }, { projection: { source: 1, scope: 1, accessLevel: 1, language: 1, category: 1, folderId: 1 } }) as { source?: DocumentSource; scope?: string; accessLevel?: string; language?: string; category?: string } | null
  if (!doc?.source || doc.source.type !== "mcp") throw new LibraryError("library.notFromConnector", "Tento dokument nevznikol z konektora.")
  const c = await ingestConnector(companyCode, doc.source.connector)
  const known = new Map([[doc.source.externalId, { documentId, contentHash: doc.source.contentHash }]])
  const input: ImportInput = {
    connectorId: c.id, externalIds: [doc.source.externalId], folderId: null,
    category: String(doc.category ?? ""), accessLevel: String(doc.accessLevel ?? "internal"), language: String(doc.language ?? "sk"), scope: String(doc.scope ?? "company"),
  }
  return importOne(c, doc.source.externalId, input, actor, language, extras, known, redirectUrl, ctx)
}
