/**
 * faqAssistSearch.ts — hľadanie podkladu pre záznam FAQ (`faqAssist.ts`).
 *
 * Knižnica ide tou istou cestou ako „Opýtať sa" (`searchScope()` +
 * `hybridSearch()`), konektor tou istou ako import zo servera
 * (`searchForImport()`) — žiadne tretie hľadanie s vlastnými pravidlami.
 * Hľadá správca obsahu, preto `accessLevel: "all"`: interný zdroj sa ukáže
 * so štítkom a záznam s ním bude interný sám (`entryAccessLevel()`).
 */

import { getCollection } from "./mongodb"
import { hybridSearch, type SearchOptions } from "./mongoSearch"
import { searchScope } from "./searchVersions"
import { getTenantProfile } from "./tenantProfile"
import { getProviders } from "./providers/factory"
import { searchForImport } from "./connectorImport"
import { connectorCallbackUrl } from "./mcp/callbackUrl"
import { excerptOf } from "./faqAssist"

export interface LibraryHit {
  documentId: string
  title: string
  articleRef: string | null
  accessLevel: string
  excerpt: string
}

export interface ConnectorHit {
  externalId: string
  title: string
  excerpt: string
  existingDocumentId: string | null
}

export async function searchLibraryForFaq(companyCode: string, query: string, faqDocumentId: string): Promise<LibraryHit[]> {
  const now = new Date()
  const scope = await searchScope(companyCode, now, now)
  if (!scope.versionIds.length) return []
  const profile = await getTenantProfile(companyCode)
  const providers = getProviders(profile)
  const opts: SearchOptions = {
    query,
    accessLevel: "all",
    companyCode,
    limit: 12,
    rerankLimit: 8,
    useStageRerank: providers.rerank.isPipelineStage,
    rerankModel: profile.providers.rerank.model,
    vectorPath: profile.providers.embedding.vectorPath,
    versionIds: scope.versionIds,
    // Overené odpovede nie: podklad pre FAQ má byť predpis, nie iný pár.
    verifiedAnswers: false,
  }
  const chunks = await hybridSearch(await getCollection("document_chunks"), opts)
  return chunks
    .filter(c => c.documentId !== faqDocumentId && c.sourceType !== "qa")
    .map(c => ({
      documentId: c.documentId,
      title: c.document?.title ?? c.documentId,
      articleRef: c.articleRef ?? null,
      accessLevel: c.accessLevel ?? "internal",
      excerpt: excerptOf(c.text),
    }))
}

export async function searchConnectorForFaq(
  companyCode: string, connectorId: string, scopeKey: string, query: string,
  actor: { personId: string; personName: string },
): Promise<ConnectorHit[]> {
  const found = await searchForImport(companyCode, connectorId, query, scopeKey, await connectorCallbackUrl(), { actor })
  return found.map(a => ({
    externalId: a.externalId,
    title: a.title,
    excerpt: excerptOf(a.excerpt),
    existingDocumentId: a.existingDocumentId,
  }))
}
