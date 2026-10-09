/**
 * liveSources.ts — živý zdroj pri odpovedi (ADR-029, použitie A, D174–D176).
 *
 * Pri otázke sa popri `document_chunks` zavolajú konektory, ktoré majú
 * živý zdroj zapnutý, sú pripojené a ich prístupová úroveň nepresahuje
 * úroveň pýtajúceho sa. Server vracia celé články; tu sa zredukujú podľa
 * politiky konektora (D176), rozdelia podľa nadpisov a vrátia v tvare
 * úseku (`ChunkResult`) so `sourceType: "mcp"`, aby ďalšia cesta — rerank,
 * generovanie, citácie — bola tá istá ako pre knižnicu.
 *
 * Zlyhanie konektora nikdy nezhodí odpoveď z knižnice: vracia sa prázdny
 * zoznam a dôvod, ktorý stream pošle ako poznámku.
 */

import type { ChunkResult } from "./mongoSearch"
import { listConnectors, parseScopeRef, connectorAllowed, type Connector, type ConnectorScope, type ReductionPolicy } from "./connectors"
import { withClient, toolCaller, type CallContext } from "./mcp/client"
import { canSearch, searchArticles } from "./mcp/operations"
import type { LiveArticle } from "./mcp/profiles"
import { scrubRegexes } from "./connectorReduction"

export const LIVE_SOURCE_TYPE = "mcp"

/** Najviac článkov z jedného rozsahu a najviac úsekov z jedného článku. */
const ARTICLES_PER_SCOPE = 3
const SECTIONS_PER_ARTICLE = 4
const SECTION_MAX_CHARS = 2_800

export interface LiveSearchInput {
  companyCode: string
  query: string
  accessLevel: "public" | "internal"
  /** Rozsahy kanála (`<connectorId>:<scopeKey>`); bez nich všetky rozsahy každého zapnutého konektora. */
  scopeRefs?: string[]
  /** Kam sa má server vrátiť pri obnove prihlásenia — SDK ho chce, aj keď sa nepresmeruje. */
  redirectUrl: string
  ctx: CallContext
  /** Konektory, ktoré si človek vypol pilulkou; prázdne = všetky. */
  only?: string[]
}

export interface LiveSearchResult {
  chunks: ChunkResult[]
  /** Konektory, ktoré nestihli alebo zlyhali — do poznámky pod odpoveďou. */
  failed: { connectorId: string; name: string; reason: string }[]
  /** Ktoré konektory sa vôbec volali. */
  asked: { connectorId: string; name: string }[]
}

// ── Redukcia (D176) ──────────────────────────────────────────────────────────

/** Zahodí sekcie s daným nadpisom (aj vnorené) a nahradí vzory. Exportované kvôli testom. */
export function reduceArticle(text: string, policy: ReductionPolicy): string {
  let out = text
  if (policy.dropSections.length) {
    const drop = new Set(policy.dropSections.map(s => s.trim().toLowerCase()))
    const lines = out.split("\n")
    const kept: string[] = []
    let skippingLevel = 0
    for (const line of lines) {
      const h = line.match(/^(#{1,6})\s+(.+?)\s*$/)
      if (h) {
        const level = h[1].length
        if (skippingLevel && level <= skippingLevel) skippingLevel = 0
        if (!skippingLevel && drop.has(h[2].trim().toLowerCase())) { skippingLevel = level; continue }
      }
      if (!skippingLevel) kept.push(line)
    }
    out = kept.join("\n")
  }
  // Hotové vzory (e-mail, telefón, IBAN, rodné číslo) a vlastné vzory.
  for (const src of scrubRegexes(policy.scrubPresets, policy.scrubPatterns)) {
    try { out = out.replace(new RegExp(src, "g"), "[…]") } catch { /* neplatný vzor sa pri uložení neprijme; tu sa len preskočí */ }
  }
  return out.trim()
}

export function skipped(externalId: string, policy: ReductionPolicy): boolean {
  return policy.skipPaths.some(p => { try { return new RegExp(p).test(externalId) } catch { return false } })
}

// ── Delenie podľa nadpisov ───────────────────────────────────────────────────

/** Markdown na úseky podľa `##`/`###`; dlhý úsek sa reže po odsekoch. Exportované kvôli testom. */
export function splitMarkdown(text: string): { heading: string | undefined; text: string }[] {
  const parts: { heading: string | undefined; text: string }[] = []
  let heading: string | undefined
  let buf: string[] = []
  const flush = () => {
    const body = buf.join("\n").trim()
    if (body) {
      // Dlhý úsek po odsekoch, nie uprostred vety.
      let rest = body
      while (rest.length > SECTION_MAX_CHARS) {
        const cut = rest.lastIndexOf("\n\n", SECTION_MAX_CHARS)
        const at = cut > SECTION_MAX_CHARS / 3 ? cut : SECTION_MAX_CHARS
        parts.push({ heading, text: rest.slice(0, at).trim() })
        rest = rest.slice(at).trim()
      }
      if (rest) parts.push({ heading, text: rest })
    }
    buf = []
  }
  for (const line of text.split("\n")) {
    const h = line.match(/^#{2,3}\s+(.+?)\s*$/)
    if (h) { flush(); heading = h[1].trim(); continue }
    if (/^#\s+/.test(line)) { flush(); continue }  // názov článku nesie `title`
    buf.push(line)
  }
  flush()
  return parts
}

function toChunks(c: Connector, a: LiveArticle, policy: ReductionPolicy): ChunkResult[] {
  const text = reduceArticle(a.text, policy)
  const documentId = `live:${c.id}:${a.externalId}`
  return splitMarkdown(text).slice(0, SECTIONS_PER_ARTICLE).map((s, i) => ({
    _id: `${documentId}#${i}`,
    text: s.heading ? `${s.heading}\n${s.text}` : s.text,
    documentId,
    companyCode: c.companyCode,
    accessLevel: c.uses.retrieval.accessLevel,
    heading: s.heading,
    chunkIndex: i,
    sourceType: LIVE_SOURCE_TYPE,
    score: a.score,
    document: { title: a.title, slug: "", sourceUrl: a.url, category: "live" },
    live: { connectorId: c.id, connectorName: c.name, externalId: a.externalId, group: a.group },
  }))
}

// ── Hľadanie ────────────────────────────────────────────────────────────────

/** Rozsahy, ktoré sa pre daný konektor majú volať. Bez rozsahov jeden bez filtra. */
function scopesToAsk(c: Connector, refs: string[] | undefined): ConnectorScope[] {
  if (refs?.length) {
    const wanted = refs.map(parseScopeRef).filter(r => r?.connectorId === c.id).map(r => r!.scopeKey)
    return c.scopes.filter(s => wanted.includes(s.key))
  }
  return c.scopes.length ? c.scopes : [{ key: "", label: "", filter: {} }]
}

/** Konektory, ktoré sa pri tejto otázke smú volať (bez volania servera). */
export async function liveConnectorsFor(companyCode: string, accessLevel: "public" | "internal", scopeRefs?: string[]): Promise<Connector[]> {
  const all = await listConnectors(companyCode)
  const refIds = scopeRefs?.length ? new Set(scopeRefs.map(parseScopeRef).filter(Boolean).map(r => r!.connectorId)) : null
  const usable = all.filter(c =>
    c.uses.retrieval.enabled && c.status === "connected" && canSearch(c)
    && (accessLevel === "internal" || c.uses.retrieval.accessLevel === "public")
    && (!refIds || refIds.has(c.id)),
  )
  // Konektor, ktorý režim organizácie nepripúšťa, sa neponúkne ani pilulkou —
  // inak by človek klikol a dostal len poznámku, že zdroj nestihol.
  const allowed = await Promise.all(usable.map(c => connectorAllowed(companyCode, c.endpoint)))
  return usable.filter((_, i) => allowed[i])
}

export async function liveSearch(input: LiveSearchInput): Promise<LiveSearchResult> {
  // Portál bez výslovného výberu (pilulky): len konektory s „používať
  // predvolene" — predvolene sa hľadá v knižnici (Ján 8. 10. 2026). Kanál
  // (`scopeRefs`) má rozsah od správcu a predvoľba sa ho netýka.
  const connectors = (await liveConnectorsFor(input.companyCode, input.accessLevel, input.scopeRefs))
    .filter(c => input.only?.length ? input.only.includes(c.id) : (input.scopeRefs !== undefined || c.uses.retrieval.defaultOn))
  // Rozsah kanála, ktorý sa odkazuje na konektor bez tohto rozsahu, sa nevolá:
  // kanál by videl viac, než mu správca vybral.
  const jobs = connectors.flatMap(c => scopesToAsk(c, input.scopeRefs).map(s => ({ c, s })))
  const failed: LiveSearchResult["failed"] = []
  const results = await Promise.all(jobs.map(async ({ c, s }) => {
    try {
      const articles = await withClient(c, input.redirectUrl, client => searchArticles(toolCaller(client), c, input.query, s.filter, ARTICLES_PER_SCOPE), input.ctx, "search")
      const policy = c.uses.retrieval.reduction
      return articles.filter(a => !skipped(a.externalId, policy)).slice(0, ARTICLES_PER_SCOPE).flatMap(a => toChunks(c, a, policy))
    } catch (e) {
      failed.push({ connectorId: c.id, name: c.name, reason: String((e as Error)?.message ?? e).slice(0, 200) })
      return [] as ChunkResult[]
    }
  }))
  // Ten istý článok z dvoch rozsahov raz.
  const seen = new Set<string>()
  const chunks = results.flat().filter(ch => (seen.has(ch._id) ? false : (seen.add(ch._id), true)))
  return { chunks, failed, asked: connectors.map(c => ({ connectorId: c.id, name: c.name })) }
}

// ── Vyskúšať hľadanie (návrh ORG-konektory, Q7) ─────────────────────────────

export interface TryResult {
  /** Články pred redukciou — z nich sa počítajú návrhy (`suggestReductions`). */
  raw: LiveArticle[]
  /** Čo by dostal model: bez vynechaných ciest, po redukcii. */
  shown: (LiveArticle & { reducedText: string })[]
}

/**
 * Jedno hľadanie na výslovné stlačenie správcu. Ten istý nástroj, ten istý
 * rozklad a tá istá redukcia ako pri otázke — inak by skúška ukázala niečo
 * iné, než dostane model. Volanie má stopu (D177) ako každé iné.
 */
export async function trySearch(c: Connector, query: string, scopeKey: string, redirectUrl: string, ctx: CallContext): Promise<TryResult> {
  const filter = c.scopes.find(s => s.key === scopeKey)?.filter ?? {}
  const raw = await withClient(c, redirectUrl, client => searchArticles(toolCaller(client), c, query, filter, 10), ctx, "try", 15_000)
  const policy = c.uses.retrieval.reduction
  const shown = raw.filter(a => !skipped(a.externalId, policy)).map(a => ({ ...a, reducedText: reduceArticle(a.text, policy) }))
  return { raw, shown }
}
