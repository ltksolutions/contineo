/**
 * residency.test.ts — pravidlá dátovej rezidencie (ADR-002).
 *
 * Zmyslom týchto testov je, aby sa nedalo omylom nasadiť profil, ktorý
 * posiela text zákazníka tam, kam nemá. Preto sú tu aj testy na to, že
 * NEOVERENÁ lokalita sa v prísnom režime správa ako zakázaná.
 */
import { skontrolujRezidenciu, prehladLokalit } from "../src/lib/residency"
import { validateProfile } from "../src/lib/tenantProfile"
import type { TenantProfile } from "../src/lib/providers/types"

const R: [boolean, string][] = []
const t = (n: string, ok: boolean, extra = "") => R.push([ok, n + (ok ? "" : "  → " + extra)])

const profil = (uprav: Partial<TenantProfile> = {}): TenantProfile => ({
  companyCode: "TEST",
  tier: "T1",
  displayName: "Test",
  dataResidency: "global",
  providers: {
    embedding:  { kind: "atlas-auto", model: "voyage-4", dim: 1024, vectorPath: "text" },
    rerank:     { kind: "atlas-stage", model: "rerank-2", topK: 8 },
    generation: { kind: "anthropic", model: "claude-sonnet-5", citations: true, maxTokens: 1024 },
  },
  ...uprav,
} as TenantProfile)

/** Plne vlastná trojica — jediná, ktorá prejde v on-prem a air-gap. */
const vlastne = (uprav: Partial<TenantProfile> = {}): TenantProfile => profil({
  providers: {
    embedding:  { kind: "tei", url: "http://tei:8080", model: "voyage-4-nano", dim: 1024, vectorPath: "embedding" },
    rerank:     { kind: "infinity", url: "http://infinity:7997", model: "BAAI/bge-reranker-v2-m3", topK: 8 },
    generation: { kind: "openai", url: "http://vllm:8000/v1", model: "Qwen3-8B", citations: false, maxTokens: 1024 },
  },
  ...uprav,
})

// ── voľné režimy prepustia všetko ────────────────────────────────────────────

t("global prepustí cloudovú trojicu",
  skontrolujRezidenciu(profil({ dataResidency: "global" })).length === 0)
t("eu-data prepustí cloudovú trojicu — dáta ležia v EÚ, spracovanie smie von",
  skontrolujRezidenciu(profil({ dataResidency: "eu-data" })).length === 0)

// ── eu-full je hranica, kde sa cloud láme ────────────────────────────────────

const euFull = skontrolujRezidenciu(profil({ dataResidency: "eu-full" }))
t("eu-full odmietne cloudovú trojicu", euFull.length === 3,
  JSON.stringify(euFull.map(v => v.adapter)))
t("eu-full pomenuje $rerank ako spracovanie mimo EÚ",
  euFull.some(v => v.adapter === "rerank" && v.lokalita === "mimo-eu"))
// O5 a O6 uzavreté 2026-07-26 — obe sú doložene mimo EÚ, nie neznáme.
t("eu-full odmietne atlas-auto (Google LLC, US — zoznam subprocesorov)",
  euFull.some(v => v.adapter === "embedding" && v.lokalita === "mimo-eu"))
t("eu-full odmietne priame Anthropic API (US infraštruktúra)",
  euFull.some(v => v.adapter === "generation" && v.lokalita === "mimo-eu"))
t("eu-full prepustí vlastnú trojicu",
  skontrolujRezidenciu(vlastne({ dataResidency: "eu-full" })).length === 0,
  JSON.stringify(skontrolujRezidenciu(vlastne({ dataResidency: "eu-full" })).map(v => v.sprava)))

// ── on-prem a air-gap ────────────────────────────────────────────────────────

t("on-prem prepustí vlastnú trojicu",
  skontrolujRezidenciu(vlastne({ dataResidency: "on-prem" })).length === 0)
t("air-gap prepustí vlastnú trojicu",
  skontrolujRezidenciu(vlastne({ dataResidency: "air-gap" })).length === 0)
t("air-gap odmietne atlas-auto",
  skontrolujRezidenciu(profil({ dataResidency: "air-gap" }))
    .some(v => v.adapter === "embedding"))
t("air-gap odmietne Claude",
  skontrolujRezidenciu(profil({ dataResidency: "air-gap" }))
    .some(v => v.adapter === "generation"))

// ── rerank "none" je vždy v poriadku ─────────────────────────────────────────

t("rerank none prejde aj v air-gap",
  !skontrolujRezidenciu(vlastne({
    dataResidency: "air-gap",
    providers: { ...vlastne().providers, rerank: { kind: "none" } },
  } as Partial<TenantProfile>)).some(v => v.adapter === "rerank"))

// ── openai s cudzou url nie je vlastná infraštruktúra ────────────────────────

const cudzia = vlastne({
  dataResidency: "eu-full",
  providers: {
    ...vlastne().providers,
    generation: { kind: "openai", url: "https://api.example.com/v1", model: "x", maxTokens: 100 },
  },
} as Partial<TenantProfile>)
t("openai na verejnú doménu sa NEráta ako vlastná infraštruktúra",
  skontrolujRezidenciu(cudzia).some(v => v.adapter === "generation" && v.lokalita === "neznama"),
  JSON.stringify(prehladLokalit(cudzia)))

for (const [url, cakame] of [
  ["http://vllm:8000/v1", "vlastna"],
  ["http://localhost:8000/v1", "vlastna"],
  ["http://127.0.0.1:8000/v1", "vlastna"],
  ["http://10.1.2.3:8000/v1", "vlastna"],
  ["http://192.168.1.5:8000/v1", "vlastna"],
  ["http://172.16.0.9:8000/v1", "vlastna"],
  ["https://api.openai.com/v1", "neznama"],
] as const) {
  const p = vlastne({
    providers: { ...vlastne().providers,
      generation: { kind: "openai", url, model: "x", maxTokens: 100 } },
  } as Partial<TenantProfile>)
  t(`lokalita generovania pre ${url} = ${cakame}`,
    prehladLokalit(p).generation === cakame, prehladLokalit(p).generation)
}

// ── neplatná hodnota rezidencie ──────────────────────────────────────────────

t("neznáma rezidencia sa nahlási ako porušenie",
  skontrolujRezidenciu(profil({ dataResidency: "vymyslena" as never })).length === 1)

// ── napojenie na validáciu profilu ───────────────────────────────────────────

let spadlo = false, sprava = ""
try { validateProfile(profil({ dataResidency: "eu-full" })) }
catch (e) { spadlo = true; sprava = (e as Error).message }
t("validateProfile odmietne profil v rozpore s rezidenciou", spadlo)
t("chybová hláška menuje konkrétny adaptér", /rerank/.test(sprava), sprava.slice(0, 200))
t("chybová hláška menuje rezidenciu", /eu-full/.test(sprava))

t("validateProfile prepustí vlastnú trojicu v air-gap", (() => {
  try { validateProfile(vlastne({ dataResidency: "air-gap" })); return true }
  catch { return false }
})())

for (const [ok, n] of R) console.log(`${ok ? "OK  " : "ZLE "}  ${n}`)
const zle = R.filter(([ok]) => !ok)
console.log("\n" + "=".repeat(56))
console.log(zle.length ? `ZLYHALO ${zle.length}/${R.length}` : `${R.length}/${R.length} testov preslo`)
process.exit(zle.length ? 1 : 0)
