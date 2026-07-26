/**
 * providers/types.ts
 *
 * Rozhrania troch nezávislých adaptérov podľa ADR-001.
 * Adaptér sa vyberá profilom tenanta (kolekcia `tenant_profiles`), nie kódom.
 *
 * Zámerne je abstrakčnou hranicou NAŠE rozhranie, nie cudzí drôtový formát.
 * OpenAI-kompatibilita je implementačný detail jedného adaptéra — pri Claude
 * ideme natívne, lebo Citations API a prompt caching cez OpenAI schému neprejdú.
 *
 * Viď docs/ADR-001-provider-adaptery.md
 */

import { ChunkResult } from "../mongoSearch"

// ── Profil tenanta ───────────────────────────────────────────────────────────

export type Tier = "T1" | "T2" | "T3"
export type DataResidency = "eu" | "on-prem" | "air-gap"

export interface EmbeddingConfig {
  /** atlas-auto = embedding je súčasť $vectorSearch, aplikácia ho nerieši */
  kind: "atlas-auto" | "infinity" | "tei"
  model: string
  dim: number
  /** názov vektorového indexu — je viazaný na model, nie na tenanta */
  index?: string
  /**
   * Cesta, na ktorú ukazuje $vectorSearch. Líši sa podľa režimu:
   *   atlas-auto      → TEXTOVÉ pole (napr. "text"); vektory si Atlas drží
   *                     sám v oddelenej internej kolekcii
   *   infinity / tei  → pole s vektorom (napr. "embedding"), ktoré zapisuje
   *                     aplikácia pri ingescii
   * Zámena týchto dvoch je tichá chyba — dotaz nespadne, len nič nenájde.
   */
  vectorPath?: string
  url?: string
  apiKeyEnv?: string
}

export interface RerankConfig {
  /** atlas-stage = $rerank priamo v agregačnej pipeline (Atlas 8.3+) */
  kind: "atlas-stage" | "infinity" | "tei" | "none"
  model?: string
  index?: string
  topK?: number
  url?: string
  apiKeyEnv?: string
}

export interface GenerationConfig {
  kind: "anthropic" | "openai"
  model: string
  /** len pri kind: "anthropic" — overiteľné citácie cez Citations API */
  citations?: boolean
  /** len pri kind: "anthropic" — cache_control na systémovom prompte */
  promptCaching?: boolean
  maxTokens?: number
  temperature?: number
  /** základná URL pri kind: "openai" (vLLM, SGLang, Ollama) */
  url?: string
  apiKeyEnv?: string
}

export interface TenantProfile {
  companyCode: string
  tier: Tier
  displayName?: string
  dataResidency: DataResidency
  providers: {
    embedding: EmbeddingConfig
    rerank: RerankConfig
    generation: GenerationConfig
    /**
     * Lacnejší model pre pomocné volania (klasifikácia, prepis dotazu).
     * Keď chýba, použije sa `generation` — funkčné, ale drahšie.
     * Viď otvorenú otázku O2 v ADR-001.
     */
    utility?: GenerationConfig
  }
  limits?: {
    maxQueriesPerDay?: number
    maxContextChunks?: number
  }
}

// ── Adaptér: embedding ───────────────────────────────────────────────────────

export interface EmbeddingProvider {
  readonly kind: EmbeddingConfig["kind"]
  readonly model: string
  readonly dim: number
  /**
   * true = embedding vzniká priamo v databáze ($vectorSearch s auto-embed),
   * aplikácia ho nepočíta a `embed()` sa nesmie volať.
   */
  readonly isInline: boolean
  embed(texts: string[]): Promise<number[][]>
}

// ── Adaptér: rerank ──────────────────────────────────────────────────────────

export interface RerankProvider {
  readonly kind: RerankConfig["kind"]
  readonly model?: string
  /**
   * true = rerank je stage v agregačnej pipeline (Atlas), rieši ho mongoSearch.
   * false = rerank sa volá až nad výsledkom $rankFusion v aplikačnej vrstve.
   */
  readonly isPipelineStage: boolean
  rerank(query: string, candidates: ChunkResult[], topK: number): Promise<ChunkResult[]>
}

// ── Adaptér: generovanie ─────────────────────────────────────────────────────

/** Jedna citácia vrátená modelom — zatiaľ len Anthropic Citations API. */
export interface GeneratedCitation {
  /** index chunku v poli, ktoré sme modelu poslali */
  chunkIndex: number
  /** doslovný úryvok zo zdroja, o ktorý sa tvrdenie opiera */
  citedText: string
  documentTitle?: string
  articleRef?: string | null
}

export type GenerationEvent =
  | { type: "text"; text: string }
  | { type: "citation"; citation: GeneratedCitation }

export interface GenerationRequest {
  system: string
  query: string
  chunks: ChunkResult[]
  maxTokens?: number
}

export interface CompleteOptions {
  maxTokens?: number
  temperature?: number
  /** Tvrdý strop na odpoveď. Po uplynutí sa volanie zruší. */
  timeoutMs?: number
}

export interface GenerationProvider {
  readonly kind: GenerationConfig["kind"]
  readonly model: string
  /** true = adaptér vracia overiteľné citácie (nie len text s [1], [2]) */
  readonly supportsCitations: boolean
  stream(req: GenerationRequest): AsyncGenerator<GenerationEvent>
  /**
   * Jednorazové nestreamované doplnenie — pre pomocné úlohy ako klasifikácia
   * dotazu alebo jeho prepis. Zámerne oddelené od stream(): tie volania nemajú
   * kontext ani citácie a bežia na lacnejšom modeli (viď `utility` v profile).
   */
  complete(prompt: string, opts?: CompleteOptions): Promise<string>
}

// ── Trojica adaptérov pre jeden request ──────────────────────────────────────

export interface Providers {
  embedding: EmbeddingProvider
  rerank: RerankProvider
  generation: GenerationProvider
  /** Pomocný model na klasifikáciu a prepis dotazu. */
  utility: GenerationProvider
  profile: TenantProfile
}

/** Chyba v konfigurácii profilu — nesmie sa tíško prehltnúť. */
export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProviderConfigError"
  }
}
