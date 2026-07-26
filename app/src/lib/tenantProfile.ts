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
import { skontrolujRezidenciu } from "./residency"

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
    // Predvolene najvoľnejší režim. Konkrétny tenant si ho sprísni
    // v tenant_profiles; sprísnenie je vedomé rozhodnutie, nie predvoľba.
    dataResidency: (process.env.DATA_RESIDENCY as TenantProfile["dataResidency"]) ?? "eu-data",
    providers: {
      embedding: {
        kind: "atlas-auto",
        model: process.env.EMBEDDING_MODEL ?? "voyage-4",
        dim: Number(process.env.EMBEDDING_DIM ?? 1024),
        index: process.env.VECTOR_INDEX ?? "rag_vector_index",
        // atlas-auto indexuje textové pole, nie vektor — viď docs/ATLAS_SETUP.md
        vectorPath: process.env.VECTOR_PATH ?? "text",
      },
      rerank: {
        kind: (process.env.RERANK_KIND as "atlas-stage" | "none") ?? "atlas-stage",
        model: process.env.RERANK_MODEL ?? "rerank-2",
        index: process.env.RERANK_INDEX ?? "rag_rerank_index",
        topK: Number(process.env.RERANK_TOPK ?? 8),
      },
      generation: {
        kind: (process.env.GENERATION_KIND as "anthropic" | "openai") ?? "anthropic",
        model: process.env.GENERATION_MODEL ?? "claude-sonnet-5",
        citations: process.env.GENERATION_CITATIONS !== "false",
        promptCaching: process.env.GENERATION_PROMPT_CACHING !== "false",
        maxTokens: Number(process.env.GENERATION_MAX_TOKENS ?? 1024),
        region: process.env.GENERATION_REGION,
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
  if (g.citations && g.kind !== "anthropic" && g.kind !== "bedrock") {
    throw new ProviderConfigError(
      `${p.companyCode}: citations sú podporované len pri kind="anthropic" alebo "bedrock"`
    )
  }
  if (g.kind === "bedrock" && !g.region) {
    throw new ProviderConfigError(
      `${p.companyCode}: bedrock vyžaduje región — bez neho nevieme, kde sa text spracúva`
    )
  }
  if (!e.dim || e.dim < 1) {
    throw new ProviderConfigError(`${p.companyCode}: embedding.dim musí byť kladné číslo`)
  }
  // Najčastejšia tichá chyba: pri Automated Embedding ukazuje path na vektor
  // namiesto na text. Dotaz nespadne, len nikdy nič nenájde.
  if (e.kind === "atlas-auto" && e.vectorPath === "embedding") {
    throw new ProviderConfigError(
      `${p.companyCode}: pri atlas-auto musí vectorPath ukazovať na textové pole ` +
      `(napr. "text"), nie na "embedding" — Atlas si vektory drží sám`
    )
  }
  if ((e.kind === "tei" || e.kind === "infinity") && e.vectorPath === "text") {
    throw new ProviderConfigError(
      `${p.companyCode}: pri ${e.kind} musí vectorPath ukazovať na pole s vektorom ` +
      `(napr. "embedding"), nie na "text"`
    )
  }
  // Rezidencia. Nahrádza pôvodné dve podmienky na air-gap — tie pokrývali
  // len dva prípady z mnohých a mlčky prepúšťali napríklad $rerank, ktorý
  // počíta v USA. Pravidlá sú v jednej tabuľke, viď ADR-002.
  const porusenia = skontrolujRezidenciu(p)
  if (porusenia.length) {
    throw new ProviderConfigError(
      `${p.companyCode}: profil je v rozpore s dátovou rezidenciou.\n` +
      porusenia.map(v => `  · ${v.sprava}`).join("\n")
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
