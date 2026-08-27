import { validateProfile, defaultProfile } from "../src/lib/tenantProfile"
import { getProviders } from "../src/lib/providers/factory"
import { TenantProfile, ProviderConfigError } from "../src/lib/providers/types"

import { t } from "./helper"

function hodi(fn: () => unknown): string | null {
  try { fn(); return null } catch (e) { return e instanceof Error ? e.message : String(e) }
}

function profil(over: any = {}): TenantProfile {
  const p = defaultProfile("TEST")
  return {
    ...p, ...over,
    providers: {
      embedding:  { ...p.providers.embedding,  ...(over.providers?.embedding  ?? {}) },
      rerank:     { ...p.providers.rerank,     ...(over.providers?.rerank     ?? {}) },
      generation: { ...p.providers.generation, ...(over.providers?.generation ?? {}) },
    },
  }
}

// ── validacia ────────────────────────────────────────────────────────────
t("platny predvoleny profil prejde", hodi(() => validateProfile(profil())) === null,
  String(hodi(() => validateProfile(profil()))))

let e = hodi(() => validateProfile(profil({ providers: { generation: { kind: "openai", url: undefined } } })))
t("openai bez url spadne", !!e && e.includes("url"), String(e))

e = hodi(() => validateProfile(profil({ providers: { generation: { kind: "anthropic", url: "http://x" } } })))
t("anthropic s url spadne", !!e && e.includes("url"), String(e))

e = hodi(() => validateProfile(profil({ providers: { generation: { kind: "openai", url: "http://v/v1", citations: true } } })))
t("citations pri openai spadnu", !!e && e.includes("citations"), String(e))

e = hodi(() => validateProfile(profil({ dataResidency: "air-gap" })))
t("air-gap s atlas-auto spadne", !!e && e.includes("air-gap"), String(e))

e = hodi(() => validateProfile(profil({
  dataResidency: "air-gap",
  providers: {
    embedding: { kind: "infinity", url: "http://inf:7997", vectorPath: "embedding" },
    generation: { kind: "anthropic" },
  },
})))
t("air-gap s Claude spadne", !!e && e.includes("air-gap"), String(e))

e = hodi(() => validateProfile(profil({ providers: { embedding: { dim: 0 } } })))
t("nulova dimenzia spadne", !!e && e.includes("dim"), String(e))

// vectorPath — najcastejsia ticha chyba pri Automated Embedding
e = hodi(() => validateProfile(profil({ providers: { embedding: { vectorPath: "embedding" } } })))
t("atlas-auto s vectorPath 'embedding' spadne", !!e && e.includes("vectorPath"), String(e))

e = hodi(() => validateProfile(profil({
  dataResidency: "on-prem",
  providers: {
    embedding: { kind: "tei", url: "http://tei:8080", vectorPath: "text" },
    generation: { kind: "openai", url: "http://vllm:8000/v1", citations: false },
  },
})))
t("tei s vectorPath 'text' spadne", !!e && e.includes("vectorPath"), String(e))

t("predvoleny profil ma vectorPath 'text'", defaultProfile("X").providers.embedding.vectorPath === "text",
  String(defaultProfile("X").providers.embedding.vectorPath))

// ── factory ──────────────────────────────────────────────────────────────
process.env.ANTHROPIC_API_KEY = "test-key"

const pr = getProviders(profil())
t("factory: anthropic adapter", pr.generation.kind === "anthropic")
t("factory: anthropic podporuje citacie", pr.generation.supportsCitations === true)
t("factory: atlas embedding je inline", pr.embedding.isInline === true)
t("factory: $rerank je pipeline stage", pr.rerank.isPipelineStage === true)

const pr2 = getProviders(profil({
  providers: { generation: { kind: "openai", url: "http://vllm:8000/v1", model: "Qwen3-8B", citations: false } },
}))
t("factory: openai adapter", pr2.generation.kind === "openai")
t("factory: openai NEpodporuje overitelne citacie", pr2.generation.supportsCitations === false)
t("factory: openai model", pr2.generation.model === "Qwen3-8B")

// HTTP adaptéry (ADR-001, krok 4) — bez url musia spadnúť, s url sa postavia
e = hodi(() => getProviders(profil({ providers: { embedding: { kind: "infinity" } } })))
t("factory: embedding infinity bez url spadne", !!e && e.includes("url"), String(e))

e = hodi(() => getProviders(profil({ providers: { rerank: { kind: "tei" } } })))
t("factory: rerank tei bez url spadne", !!e && e.includes("url"), String(e))

const prOnprem = getProviders(profil({
  providers: {
    embedding: { kind: "tei", url: "http://tei:8080", model: "voyage-4-nano", dim: 1024 },
    rerank:    { kind: "infinity", url: "http://inf:7997", model: "BAAI/bge-reranker-v2-m3" },
    generation: { kind: "openai", url: "http://vllm:8000/v1", model: "Qwen3-8B", citations: false },
  },
}))
t("factory: on-prem trojica sa postavi", prOnprem.embedding.kind === "tei"
  && prOnprem.rerank.kind === "infinity" && prOnprem.generation.kind === "openai")
t("factory: HTTP embedding nie je inline", prOnprem.embedding.isInline === false)
t("factory: HTTP rerank nie je pipeline stage", prOnprem.rerank.isPipelineStage === false)
t("factory: on-prem rerank sa robi v aplikacii, nie v DB",
  prOnprem.rerank.isPipelineStage === false && getProviders(profil()).rerank.isPipelineStage === true)

delete process.env.ANTHROPIC_API_KEY
e = hodi(() => getProviders(profil()))
t("factory: chybajuci API kluc spadne", !!e && e.includes("ANTHROPIC_API_KEY"), String(e))

