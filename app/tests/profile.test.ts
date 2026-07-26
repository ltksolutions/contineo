import { validateProfile, defaultProfile } from "../src/lib/tenantProfile"
import { getProviders } from "../src/lib/providers/factory"
import { TenantProfile, ProviderConfigError } from "../src/lib/providers/types"

const R: [boolean, string][] = []
const t = (n: string, ok: boolean, extra = "") => R.push([ok, n + (ok ? "" : "  → " + extra)])

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
  providers: { embedding: { kind: "infinity" }, generation: { kind: "anthropic" } },
})))
t("air-gap s Claude spadne", !!e && e.includes("air-gap"), String(e))

e = hodi(() => validateProfile(profil({ providers: { embedding: { dim: 0 } } })))
t("nulova dimenzia spadne", !!e && e.includes("dim"), String(e))

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

e = hodi(() => getProviders(profil({ providers: { embedding: { kind: "infinity" } } })))
t("factory: neimplementovany embedding spadne zrozumitelne",
  !!e && e.includes("krok 4"), String(e))

e = hodi(() => getProviders(profil({ providers: { rerank: { kind: "tei" } } })))
t("factory: neimplementovany rerank spadne zrozumitelne",
  !!e && e.includes("krok 4"), String(e))

delete process.env.ANTHROPIC_API_KEY
e = hodi(() => getProviders(profil()))
t("factory: chybajuci API kluc spadne", !!e && e.includes("ANTHROPIC_API_KEY"), String(e))

const zle = R.filter(([ok]) => !ok)
for (const [ok, n] of R) console.log(`${ok ? "OK   " : "CHYBA"} ${n}`)
console.log("\n" + "=".repeat(56))
console.log(zle.length ? `ZLYHALO ${zle.length}/${R.length}` : `${R.length}/${R.length} testov preslo`)
process.exit(zle.length ? 1 : 0)
