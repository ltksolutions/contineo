/**
 * providers/factory.ts
 *
 * Z profilu tenanta poskladá trojicu adaptérov (ADR-001).
 * Toto je jediné miesto, kde sa rozhoduje o konkrétnom providerovi —
 * volajúci kód o vendoroch nevie.
 */

import { ChunkResult } from "../mongoSearch"
import {
  TenantProfile, Providers, ProviderConfigError,
  EmbeddingProvider, EmbeddingConfig,
  RerankProvider, RerankConfig,
  GenerationProvider, GenerationConfig,
} from "./types"
import { AnthropicGenerationProvider } from "./generation/anthropic"
import { OpenAICompatGenerationProvider } from "./generation/openai"
import { HttpEmbeddingProvider } from "./embedding/http"
import { HttpRerankProvider } from "./rerank/http"

// ── Embedding ────────────────────────────────────────────────────────────────

/** Atlas Automated Embedding — vektor vzniká v databáze, aplikácia ho nepočíta. */
class AtlasInlineEmbedding implements EmbeddingProvider {
  readonly kind = "atlas-auto" as const
  readonly isInline = true
  readonly model: string
  readonly dim: number
  constructor(cfg: EmbeddingConfig) { this.model = cfg.model; this.dim = cfg.dim }
  async embed(): Promise<number[][]> {
    throw new ProviderConfigError(
      "embed() sa pri atlas-auto nevolá — embedding je súčasť $vectorSearch"
    )
  }
}

function makeEmbedding(cfg: EmbeddingConfig): EmbeddingProvider {
  switch (cfg.kind) {
    case "atlas-auto":
      return new AtlasInlineEmbedding(cfg)
    case "infinity":
    case "tei":
      return new HttpEmbeddingProvider(cfg)
    default:
      throw new ProviderConfigError(`Neznámy embedding.kind: ${(cfg as EmbeddingConfig).kind}`)
  }
}

// ── Rerank ───────────────────────────────────────────────────────────────────

/** $rerank ako stage v agregačnej pipeline — rieši mongoSearch, nie aplikácia. */
class AtlasStageRerank implements RerankProvider {
  readonly kind = "atlas-stage" as const
  readonly isPipelineStage = true
  readonly model?: string
  constructor(cfg: RerankConfig) { this.model = cfg.model }
  async rerank(_q: string, candidates: ChunkResult[], topK: number) {
    return candidates.slice(0, topK)   // už zoradené pipeline-om
  }
}

/** Bez rerankingu — poradie z $rankFusion sa berie ako finálne. */
class NoRerank implements RerankProvider {
  readonly kind = "none" as const
  readonly isPipelineStage = false
  async rerank(_q: string, candidates: ChunkResult[], topK: number) {
    return candidates.slice(0, topK)
  }
}

function makeRerank(cfg: RerankConfig): RerankProvider {
  switch (cfg.kind) {
    case "atlas-stage": return new AtlasStageRerank(cfg)
    case "none":        return new NoRerank()
    case "infinity":
    case "tei":
      return new HttpRerankProvider(cfg)
    default:
      throw new ProviderConfigError(`Neznámy rerank.kind: ${(cfg as RerankConfig).kind}`)
  }
}

// ── Generovanie ──────────────────────────────────────────────────────────────

function makeGeneration(cfg: GenerationConfig): GenerationProvider {
  switch (cfg.kind) {
    case "anthropic": return new AnthropicGenerationProvider(cfg)
    case "openai":    return new OpenAICompatGenerationProvider(cfg)
    default:
      throw new ProviderConfigError(`Neznámy generation.kind: ${(cfg as GenerationConfig).kind}`)
  }
}

// ── Export ───────────────────────────────────────────────────────────────────

export function getProviders(profile: TenantProfile): Providers {
  const generation = makeGeneration(profile.providers.generation)
  // Bez vlastnej utility konfigurácie použijeme hlavný model — funkčné,
  // len drahšie. Nastaviť lacnejší (napr. Haiku) sa oplatí, viď O2.
  const utility = profile.providers.utility
    ? makeGeneration(profile.providers.utility)
    : generation

  return {
    embedding:  makeEmbedding(profile.providers.embedding),
    rerank:     makeRerank(profile.providers.rerank),
    generation,
    utility,
    profile,
  }
}
