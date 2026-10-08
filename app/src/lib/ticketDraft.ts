/**
 * ticketDraft.ts — návrh odpovede na ticket bez streamu (ADR-028, D163).
 *
 * Tá istá cesta ako `/api/chat` — rozsah znení, hybridné hľadanie, rerank,
 * systémový prompt a model z nastavenia organizácie — len výsledok sa
 * neposiela po kúskoch do prehliadača, ale zloží do textu a uloží k ticketu
 * ako **návrh**. Odosiela ho človek (D12).
 *
 * **Len verejný obsah.** Odpoveď odchádza e-mailom von z organizácie, takže
 * sa hľadá s úrovňou `public` bez ohľadu na to, že riešiteľ je prihlásený:
 * interný predpis v návrhu by riešiteľ ľahko prehliadol a odoslal. Čo vie
 * z interného, dopíše sám a vedome.
 *
 * Rozsah je rozsah kanála (priečinky, D161) a k nemu overené odpovede
 * a záznamy FAQ (`verifiedAnswers`).
 */

import { getCollection } from "./mongodb"
import { getTenantProfile } from "./tenantProfile"
import { getProviders } from "./providers/factory"
import { hybridSearch, type SearchOptions } from "./mongoSearch"
import { searchScope, attachVersions } from "./searchVersions"
import { buildSystemPrompt, buildSources } from "./llmGenerator"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import { AppError } from "./appError"
import type { HelpdeskChannel } from "./channels"
import { questionText, type Ticket } from "./tickets"
import { liveSearch } from "./liveSources"
import { connectorCallbackUrl } from "./mcp/callbackUrl"

export class TicketDraftError extends AppError {}

export interface DraftSource {
  documentId: string
  title: string
  articleRef: string | null
  sourceType?: string
  /** Živý zdroj (ADR-029) — bez odkazu do knižnice, s názvom konektora. */
  live?: { connectorId: string; connectorName: string; externalId: string; group?: string }
}

export interface TicketDraftResult {
  text: string
  sources: DraftSource[]
  model: string
  /** Bez zdrojov sa model nevolal — návrh je prázdny a riešiteľ to má vedieť. */
  noSources: boolean
}

const MAX_TOKENS = 1500

export async function draftTicketAnswer(ticket: Ticket, channel: HelpdeskChannel, actor: UsageActor): Promise<TicketDraftResult> {
  const { companyCode } = actor
  const now = new Date()
  const profile = await getTenantProfile(companyCode)
  const providers = getProviders(profile)
  const scope = await searchScope(companyCode, now, now, { folderIds: channel.folderIds })
  const question = questionText(ticket)
  if (!question.trim()) throw new TicketDraftError("ticket.emptyQuestion", "Ticket nemá text otázky.")

  const opts: SearchOptions = {
    query: question.slice(0, 2000),
    accessLevel: "public",
    companyCode,
    limit: 20,
    rerankLimit: 5,
    useStageRerank: providers.rerank.isPipelineStage,
    rerankModel: profile.providers.rerank.model,
    vectorPath: profile.providers.embedding.vectorPath,
    versionIds: scope.versionIds,
    verifiedAnswers: scope.verifiedAnswers,
  }
  // Živé zdroje kanála (ADR-029) s úrovňou `public` — interný konektor sa
  // do návrhu e-mailu nedostane, bez výnimky v kóde (D174).
  const [libraryChunks, live] = await Promise.all([
    scope.versionIds.length || scope.verifiedAnswers
      ? hybridSearch(await getCollection("document_chunks"), opts)
      : Promise.resolve([]),
    channel.connectorScopes?.length
      ? liveSearch({
          companyCode, query: question.slice(0, 2000), accessLevel: "public", scopeRefs: channel.connectorScopes,
          redirectUrl: await connectorCallbackUrl(),
          ctx: { actor: { personId: actor.personId, personName: actor.personName }, channelKey: channel.key },
        })
      : Promise.resolve({ chunks: [], failed: [], asked: [] }),
  ])
  let chunks = [...libraryChunks, ...live.chunks]
  if (chunks.length && !providers.rerank.isPipelineStage) {
    const topK = profile.providers.rerank.topK ?? 8
    try { chunks = await providers.rerank.rerank(question, chunks, topK) } catch { chunks = chunks.slice(0, topK) }
  }
  const model = providers.generation.model
  if (!chunks.length) return { text: "", sources: [], model, noSources: true }

  const answerChunks = attachVersions(chunks, scope.versions)
  const system = buildSystemPrompt("public", providers.generation.supportsCitations, now, undefined, answerChunks.some(c => c.live))
  const query = `${question}\n\n(Odpoveď formuluj ako e-mail helpdesku pýtajúcemu sa: úplne, vecne, bez pozdravu a podpisu.)`

  let text = ""
  let tokens: Partial<import("./pricing").TokenCounts> = {}
  let failed = false
  try {
    for await (const ev of providers.generation.stream({ system, query, chunks: answerChunks, maxTokens: MAX_TOKENS })) {
      if (ev.type === "text") text += ev.text
      else if (ev.type === "tokens") tokens = { ...tokens, ...ev.tokens }
      else if (ev.type === "koniec" && ev.dovod === "max_tokens") text += "\n\n[…]"
    }
  } catch (e) {
    failed = true
    console.error("[helpdesk] návrh odpovede zlyhal:", e)
    throw new TicketDraftError("ticket.aiFailed", "Asistent návrh nepripravil — skúste to o chvíľu.")
  } finally {
    void recordAiUsage(usageRecord({
      actor, purpose: "answer", subject: `ticket: ${ticket.subject}`.slice(0, 200),
      provider: profile.providers.generation.kind, model, keySource: profile.providers.generation.keySource ?? null, tokens, failed,
    }))
  }

  const sources: DraftSource[] = buildSources(answerChunks).map(s => ({
    documentId: s.documentId, title: s.title, articleRef: s.articleRef ?? null, sourceType: s.sourceType, live: s.live,
  }))
  // Jeden dokument raz — e-mail nepotrebuje zoznam úsekov, ale čo citovať.
  const unique = [...new Map(sources.map(s => [`${s.documentId}|${s.articleRef ?? ""}`, s])).values()].slice(0, 8)
  return { text: text.trim(), sources: unique, model, noSources: false }
}
