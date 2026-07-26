/**
 * tenantProfile.ts
 *
 * Načítanie profilu tenanta z kolekcie `tenant_profiles` (ADR-001).
 * Profil určuje, ktoré tri adaptéry sa použijú — embedding, rerank, generovanie.
 *
 * Cache je in-memory s TTL. Zmena profilu sa prejaví do TTL, alebo hneď
 * po zavolaní invalidateProfile().
 */

import { getCollection } from "./mongodb"
import { TenantProfile, ProviderConfigError } from "./providers/types"

const TTL_MS = 5 * 60 * 1000   // 5 minút

interface CacheEntry { profile: TenantProfile; expiresAt: number }
const cache = new Map<string, CacheEntry>()

/**
 * Predvolený profil — použije sa, keď tenant nemá vlastný záznam.
 * Zodpovedá dnešnému správaniu: Atlas auto-embed + $rerank + Claude.
 */
export function defaultProfile(companyCode = "SFZ"): TenantProfile {
  return {
    companyCode,
    tier: "T1",
    dataResidency: "eu",
    providers: {
      embedding: {
        kind: "atlas-auto",
        model: process.env.EMBEDDING_MODEL ?? "voyage-4",
        dim: Number(process.env.EMBEDDING_DIM ?? 1024),
        index: process.env.VECTOR_INDEX ?? "rag_vector_index",
      },
      rerank: {
        kind: (process.env.RERANK_KIND as "atlas-stage" | "none") ?? "atlas-stage",
        model: process.env.RERANK_MODEL ?? "voyage-rerank-2.5",
        index: process.env.RERANK_INDEX ?? "rag_rerank_index",
        topK: Number(process.env.RERANK_TOPK ?? 8),
      },
      generation: {
        kind: (process.env.GENERATION_KIND as "anthropic" | "openai") ?? "anthropic",
        model: process.env.GENERATION_MODEL ?? "claude-sonnet-5",
        citations: process.env.GENERATION_CITATIONS !== "false",
        promptCaching: process.env.GENERATION_PROMPT_CACHING !== "false",
        maxTokens: Number(process.env.GENERATION_MAX_TOKENS ?? 1024),
        url: process.env.GENERATION_URL,
        apiKeyEnv: process.env.GENERATION_API_KEY_ENV,
      },
    },
    limits: { maxContextChunks: Number(process.env.MAX_CONTEXT_CHUNKS ?? 8) },
  }
}

/** Overí, že profil dáva zmysel. Radšej spadnúť tu než tíško zle odpovedať. */
export function validateProfile(p: TenantProfile): void {
  const g = p.providers?.generation
  const e = p.providers?.embedding

  if (!p.companyCode) throw new ProviderConfigError("Profil nemá companyCode")
  if (!g) throw new ProviderConfigError(`${p.companyCode}: chýba providers.generation`)
  if (!e) throw new ProviderConfigError(`${p.companyCode}: chýba providers.embedding`)

  if (g.kind === "openai" && !g.url) {
    throw new ProviderConfigError(
      `${p.companyCode}: generation.kind="openai" vyžaduje url (napr. http://vllm:8000/v1)`
    )
  }
  if (g.kind === "anthropic" && g.url) {
    throw new ProviderConfigError(
      `${p.companyCode}: generation.kind="anthropic" nepoužíva url — pre Bedrock/Vertex pridaj samostatný adaptér`
    )
  }
  if (g.citations && g.kind !== "anthropic") {
    throw new ProviderConfigError(
      `${p.companyCode}: citations sú podporované len pri kind="anthropic"`
    )
  }
  if (!e.dim || e.dim < 1) {
    throw new ProviderConfigError(`${p.companyCode}: embedding.dim musí byť kladné číslo`)
  }
  if (p.dataResidency === "air-gap" && e.kind === "atlas-auto") {
    throw new ProviderConfigError(
      `${p.companyCode}: air-gap nemôže používať atlas-auto — Automated Embedding volá Voyage API`
    )
  }
  if (p.dataResidency === "air-gap" && g.kind === "anthropic") {
    throw new ProviderConfigError(
      `${p.companyCode}: air-gap nemôže používať Claude API`
    )
  }
}

/** Načíta profil tenanta. Pri chýbajúcom zázname vráti predvolený. */
export async function getTenantProfile(companyCode: string): Promise<TenantProfile> {
  const hit = cache.get(companyCode)
  if (hit && hit.expiresAt > Date.now()) return hit.profile

  let profile: TenantProfile
  try {
    const col = await getCollection<TenantProfile>("tenant_profiles")
    const doc = await col.findOne({ companyCode })
    profile = doc ? ({ ...doc } as TenantProfile) : defaultProfile(companyCode)
  } catch {
    // DB nedostupná — nepadneme, ideme na predvolený profil.
    profile = defaultProfile(companyCode)
  }

  validateProfile(profile)
  cache.set(companyCode, { profile, expiresAt: Date.now() + TTL_MS })
  return profile
}

/** Zahodí cache — po zmene profilu v admin rozhraní. */
export function invalidateProfile(companyCode?: string): void {
  if (companyCode) cache.delete(companyCode)
  else cache.clear()
}
