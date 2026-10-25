/**
 * tools.ts — nástroje MCP servera, fáza 1: len čítanie (ADR-038, D250).
 *
 * Každý nástroj je tenký obal nad funkciou, ktorú už používa web
 * (`libraryList`, `loadDocumentFor`, `hybridSearch`, `chatStream`…),
 * s `companyCode` z tokenu. Čo web nevie, sem nepatrí — najprv `lib/`.
 *
 * **Zoznam sa skladá pre reláciu** (`toolsFor`): rozsah tokenu **a** role
 * osoby — prienik, nie zjednotenie (D249). Čo človek nesmie, v zozname
 * nie je; volanie podľa mena odmietne tá istá kontrola.
 *
 * Opisy sú anglické a jedny (D254): číta ich model, nie človek. Texty pre
 * človeka (súhlas, plachta účtu) idú cez i18n.
 */

import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { getCollection } from "../mongodb"
import { libraryList, hierarchyDocuments, type LibraryRow } from "../libraryRead"
import { loadDocumentFor, effectiveVersion, type DocumentRecord, type Version } from "../documents"
import { versionText } from "../versionCompare"
import { searchScope, attachVersions } from "../searchVersions"
import { hybridSearch, type ChunkResult, type SearchOptions } from "../mongoSearch"
import { getTenantProfile } from "../tenantProfile"
import { getProviders } from "../providers/factory"
import { CONTENT_ROLE } from "../library"
import { brandingView } from "../tenants"
import { questionsLastHour } from "../widgetApi"
import { liveSearch } from "../liveSources"
import { lawSearch } from "../lawSearch"
import { SLOV_LEX_SOURCE_ID } from "../lawCatalog"
import { AppError } from "../appError"
import type { OAuthScope } from "../oauthServer"
import { askOnce } from "./ask"
import { sourcesFor, pickSources, unknownSourcesMessage, LIBRARY_SOURCE_ID, type McpSource } from "./sources"
import { lawActsFor, lawActText, lawActMarkdown } from "./law"
import { logMcpCall } from "./calls"
import type { McpActor } from "./auth"

// ── Katalóg ─────────────────────────────────────────────────────────────────

export interface ToolSpec {
  name: string
  /** Rozsah tokenu, ktorý nástroj potrebuje; `null` = stačí prihlásenie. */
  scope: OAuthScope | null
  /** Role osoby, z ktorých aspoň jedna musí byť; chýba = každý. */
  roles?: readonly string[]
}

export const TOOL_CATALOG: readonly ToolSpec[] = [
  { name: "whoami", scope: null },
  { name: "list_sources", scope: "library.read" },
  { name: "search_library", scope: "library.read" },
  { name: "list_documents", scope: "library.read" },
  { name: "get_document", scope: "library.read" },
  { name: "document_hierarchy", scope: "library.read" },
  { name: "list_law_acts", scope: "library.read" },
  { name: "get_law_act", scope: "library.read" },
  { name: "ask", scope: "ask" },
]

/** Názvy nástrojov, ktoré táto relácia dostane. Čistá funkcia — testuje sa. */
export function toolsFor(scopes: readonly string[], roles: readonly string[] = []): string[] {
  return TOOL_CATALOG
    .filter(t => t.scope === null || scopes.includes(t.scope))
    .filter(t => !t.roles || t.roles.some(r => roles.includes(r)))
    .map(t => t.name)
}

/** Strop otázok `ask` na osobu a hodinu — agent v slučke minie viac než človek (D14). */
export const ASK_PER_HOUR = 60
/** Najviac úsekov z `search_library`. */
const SEARCH_MAX = 20

// ── Pomocné ─────────────────────────────────────────────────────────────────

function text(value: string, structured?: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text: value }], ...(structured ? { structuredContent: structured } : {}) }
}

function failure(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] }
}

function documentUrl(origin: string, documentId: string): string {
  return `${origin}/documents/${encodeURIComponent(documentId)}`
}

function day(d: Date | string | null | undefined): string | null {
  if (!d) return null
  const date = new Date(d)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function parseAsOf(raw: string | undefined): Date {
  if (!raw) return new Date()
  const d = new Date(`${raw}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new AppError("mcp.badDate", `Dátum „${raw}" nie je v tvare RRRR-MM-DD.`)
  return d
}

/** Smie osoba vidieť dokument cez MCP: verejný vždy, interný len bez „len verejný obsah" (D252). */
function visible(actor: Pick<McpActor, "accessLevel">, accessLevel: string | undefined): boolean {
  return actor.accessLevel === "internal" || (accessLevel ?? "internal") === "public"
}

/**
 * Obal každého nástroja: rozsah a role sa kontrolujú **aj tu**, nie len pri
 * skladaní zoznamu; stopa volania (D177) a chyba ako výsledok, nie výnimka —
 * klient má dostať vetu, nie prerušené spojenie.
 */
function guarded<A>(actor: McpActor, spec: ToolSpec, run: (args: A) => Promise<CallToolResult>): (args: A) => Promise<CallToolResult> {
  return async args => {
    const started = Date.now()
    const base = {
      companyCode: actor.tenant.companyCode, personId: actor.person.id, personName: actor.person.fullName,
      clientId: actor.clientId, clientName: actor.clientName, grantId: actor.grantId, tool: `tool:${spec.name}`,
    }
    if (!toolsFor(actor.scopes, actor.person.roles ?? []).includes(spec.name)) {
      void logMcpCall({ ...base, ms: Date.now() - started, outcome: "forbidden", size: 0 })
      return failure("This tool is not available for your token or role.")
    }
    try {
      const result = await run(args)
      const size = result.content.reduce((n, c) => n + (c.type === "text" ? c.text.length : 0), 0)
      void logMcpCall({ ...base, ms: Date.now() - started, outcome: result.isError ? "error" : "ok", size })
      return result
    } catch (e) {
      const message = e instanceof AppError ? e.message : "The request failed."
      if (!(e instanceof AppError)) console.error(`[mcp] ${spec.name} zlyhal:`, e)
      void logMcpCall({ ...base, ms: Date.now() - started, outcome: "error", size: 0, error: e instanceof Error ? e.message.slice(0, 200) : String(e) })
      return failure(message)
    }
  }
}

function spec(name: string): ToolSpec {
  return TOOL_CATALOG.find(t => t.name === name)!
}

// ── Hľadanie bez modelu ─────────────────────────────────────────────────────

export interface SearchHit {
  documentId: string
  title: string
  articleRef: string | null
  heading: string | null
  text: string
  versionLabel: string | null
  effectiveFrom: string | null
  /** `"qa"` = overená odpoveď kurátora, nie článok predpisu (D11); `"law"` = text zákona z katalógu legislatívy (zdroj `slov-lex`, ADR-040 D268); `"mcp"` = konektor. */
  sourceType: string | null
  /** Zdroj vo výbere: `library`, `law` alebo id konektora (ADR-040 D266). */
  source: string
  url: string
}

/**
 * Úsek → výsledok. Adresa podľa pôvodu: dokument knižnice na portáli,
 * Legislatíva na Slov-Lexe (paragraf), konektor na jeho serveri.
 */
export function toHit(c: ChunkResult, origin: string): SearchHit {
  const source = c.law ? SLOV_LEX_SOURCE_ID : c.live ? c.live.connectorId : LIBRARY_SOURCE_ID
  const external = c.law?.url ?? (c.live ? c.document?.sourceUrl : undefined)
  return {
    source,
    documentId: c.documentId,
    title: c.document?.title ?? c.documentId,
    articleRef: c.articleRef ?? null,
    heading: c.heading ?? null,
    text: c.text,
    versionLabel: c.version?.label ?? null,
    effectiveFrom: day(c.version?.effectiveFrom),
    sourceType: c.sourceType ?? null,
    url: external || documentUrl(origin, c.documentId),
  }
}

/**
 * Hľadanie vo vybraných zdrojoch bez jazykového modelu: knižnica, Legislatíva
 * (`lawSearch`, to isté ako na Opýtať sa) a konektory (`liveSearch` — volá
 * cudzí server, nie model). Poradie ako pri odpovedi: knižnica, konektory,
 * Legislatíva (D174, D259). Zdroj, ktorý zlyhal, sa ohlási, odpoveď ide ďalej.
 */
/**
 * Strop `limit` pre **každý zdroj zvlášť** (knižnica, Slov-Lex, každý
 * konektor), poradie sa zachová. Model si tak vie ustrážiť dĺžku výsledku:
 * paragraf zákona má aj tisíce znakov a bez stropu Legislatíva pridávala svoje
 * úseky navyše (Ján 25. 10. 2026). Čistá funkcia — testuje sa.
 */
export function capPerSource(hits: SearchHit[], limit: number): SearchHit[] {
  const seen = new Map<string, number>()
  return hits.filter(h => {
    const n = seen.get(h.source) ?? 0
    seen.set(h.source, n + 1)
    return n < limit
  })
}

async function searchSources(actor: McpActor, picked: McpSource[], query: string, limit: number, asOf: Date): Promise<{ hits: SearchHit[]; failed: string[] }> {
  const companyCode = actor.tenant.companyCode
  const ids = new Set(picked.map(s => s.id))
  const connectors = picked.filter(s => s.kind === "mcp").map(s => s.id)
  const profile = await getTenantProfile(companyCode)
  const providers = getProviders(profile)
  const [library, live, law] = await Promise.all([
    ids.has(LIBRARY_SOURCE_ID) ? searchLibrary(actor, query, limit, asOf) : Promise.resolve([]),
    connectors.length
      ? liveSearch({
          companyCode, query, accessLevel: actor.accessLevel, redirectUrl: "", only: connectors,
          ctx: { actor: { personId: actor.person.id, personName: actor.person.fullName }, channelKey: null },
        })
      : Promise.resolve({ chunks: [], failed: [], asked: [] }),
    ids.has(SLOV_LEX_SOURCE_ID)
      ? lawSearch({
          companyCode, query, asOf, byDefault: false,
          useStageRerank: providers.rerank.isPipelineStage, rerankModel: profile.providers.rerank.model,
          vectorPath: profile.providers.embedding.vectorPath,
        })
      : Promise.resolve({ chunks: [], asked: false, failed: false }),
  ])
  const names = new Map(picked.map(s => [s.id, s.name]))
  return {
    hits: capPerSource([...library, ...live.chunks.map(c => toHit(c, actor.origin)), ...law.chunks.map(c => toHit(c, actor.origin))], limit),
    failed: [...live.failed.map(f => f.name), ...(law.failed ? [names.get(SLOV_LEX_SOURCE_ID) ?? SLOV_LEX_SOURCE_ID] : [])],
  }
}

async function searchLibrary(actor: McpActor, query: string, limit: number, asOf: Date): Promise<SearchHit[]> {
  const companyCode = actor.tenant.companyCode
  const profile = await getTenantProfile(companyCode)
  const providers = getProviders(profile)
  const scope = await searchScope(companyCode, asOf)
  const collection = await getCollection("document_chunks")
  const opts: SearchOptions = {
    query, accessLevel: actor.accessLevel, companyCode, limit: Math.max(limit * 2, 10), rerankLimit: limit,
    useStageRerank: providers.rerank.isPipelineStage,
    rerankModel: profile.providers.rerank.model,
    vectorPath: profile.providers.embedding.vectorPath,
    versionIds: scope.versionIds,
    verifiedAnswers: scope.verifiedAnswers,
  }
  let chunks = await hybridSearch(collection, opts)
  if (!providers.rerank.isPipelineStage && chunks.length) {
    try { chunks = await providers.rerank.rerank(query, chunks, limit) } catch (e) {
      console.error("[mcp] rerank zlyhal, ostáva poradie z $rankFusion:", e)
      chunks = chunks.slice(0, limit)
    }
  }
  return attachVersions(chunks, scope.versions).slice(0, limit).map(c => toHit(c, actor.origin))
}

// ── Dokumenty ───────────────────────────────────────────────────────────────

interface DocumentSummary {
  documentId: string
  title: string
  category: string | null
  tags: string[]
  accessLevel: string
  status: string
  versionLabel: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  archived: boolean
  folder: string | null
  parentIds: string[]
  url: string
}

function summary(r: LibraryRow, origin: string): DocumentSummary {
  return {
    documentId: r.documentId, title: r.title, category: r.category ?? null, tags: r.tags,
    accessLevel: r.accessLevel ?? "internal", status: r.status,
    versionLabel: r.effectiveFrom ? r.effectiveLabel : null,
    effectiveFrom: day(r.effectiveFrom), effectiveTo: day(r.effectiveTo), archived: Boolean(r.archived),
    folder: r.folderTrail?.length ? r.folderTrail.join(" / ") : null, parentIds: r.parentIds,
    url: documentUrl(origin, r.documentId),
  }
}

/**
 * Dokumenty, ktoré osoba vidí: bežný člen len tie s platným znením (ako
 * `readableDocuments()`), správca obsahu aj koncepty a archív, keď o ne
 * požiada. `publicOnly` zužuje na verejné (D252).
 */
export function visibleRows(rows: LibraryRow[], actor: Pick<McpActor, "accessLevel"> & { roles: string[] }, includeDrafts: boolean): LibraryRow[] {
  const contentAdmin = actor.roles.includes(CONTENT_ROLE)
  return rows.filter(r => {
    if (!visible(actor, r.accessLevel)) return false
    if (contentAdmin && includeDrafts) return true
    return r.status === "published" && r.effectiveFrom !== null && !r.archived
  })
}

function versionInfo(v: Version): Record<string, unknown> {
  return { versionId: v.versionId, label: v.label, effectiveFrom: day(v.effectiveFrom), effectiveTo: day(v.effectiveTo), isActive: v.isActive, changeNote: v.changeNote ?? null }
}

function pickVersion(doc: DocumentRecord, versionId: string | undefined, asOf: Date): { version: Version; reason?: undefined } | { version?: undefined; reason: string } {
  if (versionId) {
    const v = (doc.versions ?? []).find(x => x.versionId === versionId)
    return v ? { version: v } : { reason: "unknown-version" }
  }
  const e = effectiveVersion(doc, asOf)
  return e.ok ? { version: e.version } : { reason: e.reason }
}

// ── Registrácia ─────────────────────────────────────────────────────────────

export function registerTools(server: McpServer, actor: McpActor): void {
  const allowed = new Set(toolsFor(actor.scopes, actor.person.roles ?? []))
  const org = brandingView(actor.tenant)
  const orgName = org.shortName?.trim() || org.displayName

  if (allowed.has("whoami")) {
    server.registerTool("whoami", {
      title: "Who am I",
      description: "The signed-in person, their organisation, roles, interface language, the scopes this token carries and the access level the tools answer at.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("whoami"), async () => {
      const data = {
        person: { id: actor.person.id, name: actor.person.fullName, email: actor.person.email, department: actor.person.department ?? null, roles: actor.person.roles ?? [], language: actor.person.language },
        organisation: { companyCode: actor.tenant.companyCode, name: org.displayName, shortName: org.shortName ?? null, portal: actor.origin },
        client: { id: actor.clientId, name: actor.clientName },
        scopes: actor.scopes,
        accessLevel: actor.accessLevel,
        tools: [...allowed],
      }
      return text(JSON.stringify(data, null, 2), data)
    }))
  }

  if (allowed.has("list_sources")) {
    server.registerTool("list_sources", {
      title: "List sources",
      description: `The content sources ${orgName} has and this person may search: the library (always), Legislation from Slov-Lex when the organisation follows any acts, and connected knowledge sources (MCP connectors). Pass their ids as \`sources\` to search_library or ask.`,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("list_sources"), async () => {
      const sources = await sourcesFor(actor)
      const lines = sources.map(s => `- ${s.id}: ${s.name}${s.defaultOn ? " (default)" : ""} — ${s.description}`)
      return text(lines.join("\n"), { sources })
    }))
  }

  if (allowed.has("search_library")) {
    server.registerTool("search_library", {
      title: "Search the library and sources",
      description: `Hybrid (semantic + full-text) search over the sections of ${orgName}'s documents in force on the given day — and, when asked via \`sources\`, over Legislation (Slov-Lex acts the organisation follows) and connected knowledge sources. Returns the best-matching passages with document, article, version and source — no language model is involved; write the answer yourself and cite the passages. Use \`ask\` instead when you want Contineo's own answer with citations.`,
      inputSchema: {
        query: z.string().min(2).max(500).describe("What to look for, in the language of the documents (Slovak for most organisations)."),
        limit: z.number().int().min(1).max(SEARCH_MAX).optional().describe(`At most this many passages from each selected source (default 8, at most ${SEARCH_MAX}); Legislation returns at most 4. Use a small limit with several sources — sections of a law can be long.`),
        asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Search the versions in force on this day (YYYY-MM-DD). Default: today."),
        sources: z.array(z.string().max(100)).max(10).optional().describe('Source ids from list_sources, e.g. ["library", "slov-lex"]. Default: ["library"].'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("search_library"), async ({ query, limit, asOf, sources }) => {
      const available = await sourcesFor(actor)
      const { picked, unknown } = pickSources(sources, available, [LIBRARY_SOURCE_ID])
      if (unknown.length) return failure(unknownSourcesMessage(unknown, available))
      const { hits, failed } = await searchSources(actor, picked, query.trim(), limit ?? 8, parseAsOf(asOf))
      const lines = hits.map((h, i) =>
        `${i + 1}. ${h.title}${h.articleRef ? ` — ${h.articleRef}` : ""}${h.heading ? ` (${h.heading})` : ""}${h.versionLabel ? ` [${h.versionLabel}]` : ""}${h.source !== LIBRARY_SOURCE_ID ? ` {${h.source}}` : ""}\n${h.url}\n${h.text}`)
      const note = failed.length ? `\n\n(Not searched — source did not respond: ${failed.join(", ")})` : ""
      return text((hits.length ? lines.join("\n\n") : "No passages matched.") + note, {
        hits, asOf: day(parseAsOf(asOf)), searched: picked.map(s => s.id), failed,
      })
    }))
  }

  if (allowed.has("list_documents")) {
    server.registerTool("list_documents", {
      title: "List documents",
      description: `Documents in ${orgName}'s library with their current version, kind, tags and folder. Filter by kind (category), tag or a title search. Content administrators may include drafts and archived documents.`,
      inputSchema: {
        search: z.string().max(200).optional().describe("Title or full-text filter, as in the Library screen."),
        category: z.string().max(60).optional().describe("Document kind key (e.g. stanovy, poriadok, smernica, manual, zakon)."),
        tag: z.string().max(60).optional().describe("Tag key."),
        includeDrafts: z.boolean().optional().describe("Content administrators only: also drafts and archived documents."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("list_documents"), async ({ search, category, tag, includeDrafts }) => {
      const rows = await libraryList(actor.tenant.companyCode, { search, category, tag })
      const docs = visibleRows(rows, { accessLevel: actor.accessLevel, roles: actor.person.roles ?? [] }, Boolean(includeDrafts))
        .map(r => summary(r, actor.origin))
      const lines = docs.map(d => `- ${d.title} (${d.documentId})${d.versionLabel ? ` — ${d.versionLabel}, from ${d.effectiveFrom}` : ` — ${d.status}`}${d.category ? ` · ${d.category}` : ""}`)
      return text(docs.length ? lines.join("\n") : "No documents.", { documents: docs })
    }))
  }

  if (allowed.has("get_document")) {
    server.registerTool("get_document", {
      title: "Get a document",
      description: "The full Markdown text of a document's version in force on the given day (or a specific versionId), with metadata and the list of versions. Cite articles by their numbering in the text.",
      inputSchema: {
        documentId: z.string().min(1).max(200).describe("Document identifier, e.g. sfz:stanovy (from list_documents or search_library)."),
        versionId: z.string().max(200).optional().describe("A specific version; default is the version in force on asOf."),
        asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Day for which the version in force is chosen (YYYY-MM-DD). Default: today."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("get_document"), async ({ documentId, versionId, asOf }) => {
      const doc = await loadDocumentFor({ companyCode: actor.tenant.companyCode }, documentId)
      // „Neexistuje" a „nesmieš" sa nerozlišujú (D32) — ani cez MCP.
      if (!doc || !visible(actor, doc.accessLevel)) return failure(`Document ${documentId} was not found.`)
      const picked = pickVersion(doc, versionId, parseAsOf(asOf))
      // Druh a značky nie sú v type `DocumentRecord` (číta ich zoznam cez `LibraryRow`), v zázname sú.
      const extra = doc as unknown as { category?: string; tags?: string[] }
      const meta = {
        documentId: doc.documentId, title: doc.title, category: extra.category ?? null, tags: extra.tags ?? [],
        accessLevel: doc.accessLevel ?? "internal", language: doc.language ?? null, url: documentUrl(actor.origin, doc.documentId),
        versions: (doc.versions ?? []).map(versionInfo),
      }
      if (!picked.version) {
        return text(`${doc.title}: no version in force (${picked.reason}).`, { ...meta, version: null, reason: picked.reason, markdown: null })
      }
      const markdown = versionText(doc, picked.version)
      const v = versionInfo(picked.version)
      const head = `# ${doc.title}\n\nVersion ${picked.version.label}${v.effectiveFrom ? `, in force from ${v.effectiveFrom}` : ""}${v.effectiveTo ? ` to ${v.effectiveTo}` : ""}\n${meta.url}\n\n`
      return text(head + (markdown ?? "(The text of this version is not stored; only the PDF is.)"), { ...meta, version: v, markdown })
    }))
  }

  if (allowed.has("document_hierarchy")) {
    server.registerTool("document_hierarchy", {
      title: "Document hierarchy",
      description: "Which documents are superior to which (statutes above regulations, the law above statutes). Each entry lists its parentIds. Useful before judging whether one document complies with another.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("document_hierarchy"), async () => {
      const all = await hierarchyDocuments(actor.tenant.companyCode)
      const rows = actor.accessLevel === "internal" ? all : await (async () => {
        const visibleIds = new Set(visibleRows(await libraryList(actor.tenant.companyCode), { accessLevel: actor.accessLevel, roles: [] }, false).map(r => r.documentId))
        return all.filter(d => visibleIds.has(d.documentId))
      })()
      const lines = rows.map(d => `- ${d.title} (${d.documentId})${d.parentIds.length ? ` ← ${d.parentIds.join(", ")}` : ""}`)
      return text(lines.join("\n") || "No documents.", { documents: rows })
    }))
  }

  if (allowed.has("ask")) {
    server.registerTool("ask", {
      title: "Ask Contineo",
      description: `Contineo's own answer with citations, produced by ${orgName}'s configured model over the documents in force — the same answer the person would get on the portal. Costs the organisation an AI call; prefer search_library when you only need passages. The question is recorded in the person's history.`,
      inputSchema: {
        question: z.string().min(3).max(1000).describe("The question, in the person's language."),
        sources: z.array(z.string().max(100)).max(10).optional().describe('Source ids from list_sources to answer from, e.g. ["library", "slov-lex"]. Default: ["library"].'),
        includeLiveSources: z.boolean().optional().describe("Deprecated — use sources. true = the library and every available source."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("ask"), async ({ question, sources, includeLiveSources }) => {
      const companyCode = actor.tenant.companyCode
      if (await questionsLastHour(companyCode, actor.person.id) >= ASK_PER_HOUR) {
        return failure(`Hourly limit of ${ASK_PER_HOUR} questions reached; try again later.`)
      }
      const available = await sourcesFor(actor)
      const fallback = includeLiveSources ? available.map(s => s.id) : [LIBRARY_SOURCE_ID]
      const { picked, unknown } = pickSources(sources, available, fallback)
      if (unknown.length) return failure(unknownSourcesMessage(unknown, available))
      const outcome = await askOnce({
        companyCode, query: question.trim(), language: actor.person.language, accessLevel: actor.accessLevel,
        usageActor: { companyCode, personId: actor.person.id, personName: actor.person.fullName, email: actor.person.email },
        only: picked.map(s => s.id),
        callbackUrl: "",
      }, undefined, {
        library: picked.some(s => s.id === LIBRARY_SOURCE_ID),
        live: picked.filter(s => s.id !== LIBRARY_SOURCE_ID).map(s => s.name),
      })
      if (outcome.error) return failure(outcome.error === "timeout" ? "The answer took too long." : outcome.error)
      if (!outcome.answer.trim()) {
        return text(outcome.noVersions ? "No document version is in force on that day." : "Nothing in the documents answers this question.", { answer: null, sources: [], noVersions: outcome.noVersions })
      }
      const cited = outcome.sources.map(s => ({
        index: s.index, title: s.title, documentId: s.documentId ?? null, articleRef: s.articleRef ?? null, heading: s.heading ?? null,
        // Dokument knižnice na portáli; Legislatíva a konektor majú vlastnú adresu.
        sourceType: s.sourceType ?? null,
        url: s.documentId && !/^(law|live):/.test(s.documentId) ? documentUrl(actor.origin, s.documentId) : s.url ?? null,
      }))
      const list = cited.map(s => `[${s.index}] ${s.title}${s.articleRef ? ` — ${s.articleRef}` : ""}${s.url ? ` · ${s.url}` : ""}`).join("\n")
      return text(`${outcome.answer.trim()}\n\nSources:\n${list}`, {
        answer: outcome.answer.trim(), sources: cited, asOf: outcome.asOf ?? null, model: outcome.model,
        liveFailed: outcome.liveFailed ?? [], recordedId: outcome.recordedId ?? null, searched: picked.map(s => s.id),
      })
    }))
  }

  if (allowed.has("list_law_acts")) {
    server.registerTool("list_law_acts", {
      title: "List followed legislation",
      description: `Acts from Slov-Lex (laws, decrees) that ${orgName} follows: number, title, the version in force today, how many versions exist and whether the organisation also keeps the act in its library. Use get_law_act for the text.`,
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("list_law_acts"), async () => {
      const { allowed: ok, acts } = await lawActsFor(actor.tenant.companyCode)
      if (!ok) return text("Legislation is not available in this organisation's data residency mode.", { acts: [] })
      const lines = acts.map(a => `- ${a.title} (${a.actId})${a.current ? ` — in force from ${a.current.effectiveFrom}${a.current.amendment ? `, amended by ${a.current.amendment}` : ""}` : " — no version in force yet"}${a.libraryDocumentId ? ` · in the library as ${a.libraryDocumentId}` : ""}`)
      return text(acts.length ? lines.join("\n") : "The organisation follows no legislation.", { acts })
    }))
  }

  if (allowed.has("get_law_act")) {
    server.registerTool("get_law_act", {
      title: "Get a law",
      description: "The full Markdown text of a followed act from Slov-Lex in the version in force on the given day (or a specific timepoint), with the list of its versions and links to Slov-Lex. Cite sections (§) by their numbering in the text. When the act is also in the library, the library document is the organisation's approved copy.",
      inputSchema: {
        actId: z.string().min(1).max(60).describe("Act id from list_law_acts, e.g. SK/ZZ/2015/440."),
        asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Day for which the version in force is chosen (YYYY-MM-DD). Default: today."),
        timepoint: z.string().regex(/^\d{8}$/).optional().describe("A specific version (YYYYMMDD timepoint from the versions list)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    }, guarded(actor, spec("get_law_act"), async ({ actId, asOf, timepoint }) => {
      const act = await lawActText(actor.tenant.companyCode, actId, parseAsOf(asOf), timepoint)
      if (!act) return failure(`Act ${actId} is not followed by the organisation, or has no version for that day.`)
      const { markdown, ...meta } = act
      return text(lawActMarkdown(act), { ...meta, markdown })
    }))
  }
}
