/**
 * residency.test.ts — pravidlá dátovej rezidencie (ADR-002).
 *
 * Zmyslom týchto testov je, aby sa nedalo omylom nasadiť profil, ktorý
 * posiela text zákazníka tam, kam nemá. Preto sú tu aj testy na to, že
 * NEOVERENÁ lokalita sa v prísnom režime správa ako zakázaná.
 */
import {
  checkResidency, locationOverview, checkIsolation, isolationOverview,
} from "../src/lib/residency"
import { validateProfile } from "../src/lib/tenantProfile"
import type { TenantProfile } from "../src/lib/providers/types"

import { t } from "./helper"

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
  checkResidency(profil({ dataResidency: "global" })).length === 0)
t("eu-data prepustí cloudovú trojicu — dáta ležia v EÚ, spracovanie smie von",
  checkResidency(profil({ dataResidency: "eu-data" })).length === 0)

// ── eu-full je hranica, kde sa cloud láme ────────────────────────────────────

const euFull = checkResidency(profil({ dataResidency: "eu-full" }))
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
  checkResidency(vlastne({ dataResidency: "eu-full" })).length === 0,
  JSON.stringify(checkResidency(vlastne({ dataResidency: "eu-full" })).map(v => v.sprava)))

// ── on-prem a air-gap ────────────────────────────────────────────────────────

t("on-prem prepustí vlastnú trojicu",
  checkResidency(vlastne({ dataResidency: "on-prem" })).length === 0)
t("air-gap prepustí vlastnú trojicu",
  checkResidency(vlastne({ dataResidency: "air-gap" })).length === 0)
t("air-gap odmietne atlas-auto",
  checkResidency(profil({ dataResidency: "air-gap" }))
    .some(v => v.adapter === "embedding"))
t("air-gap odmietne Claude",
  checkResidency(profil({ dataResidency: "air-gap" }))
    .some(v => v.adapter === "generation"))

// ── rerank "none" je vždy v poriadku ─────────────────────────────────────────

t("rerank none prejde aj v air-gap",
  !checkResidency(vlastne({
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
  checkResidency(cudzia).some(v => v.adapter === "generation" && v.lokalita === "neznama"),
  JSON.stringify(locationOverview(cudzia)))

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
    locationOverview(p).generation === cakame, locationOverview(p).generation)
}

// ── neplatná hodnota rezidencie ──────────────────────────────────────────────

t("neznáma rezidencia sa nahlási ako porušenie",
  checkResidency(profil({ dataResidency: "vymyslena" as never })).length === 1)

// ── Druhá os: izolácia infraštruktúry (tier) ─────────────────────────────────
//
// Tier bol dlho mŕtve pole — deklarované, nikdy nečítané. Tieto testy
// existujú preto, aby sa to nezopakovalo: keby ho niekto odpojil od
// validácie, spadnú.

t("T1 prepustí zdieľanú cloudovú trojicu",
  checkIsolation(profil({ tier: "T1" })).length === 0)

const t2Cloud = checkIsolation(profil({ tier: "T2" }))
t("T2 odmietne zdieľané adaptéry", t2Cloud.length === 3,
  JSON.stringify(t2Cloud.map(v => v.adapter)))
t("T2 pomenuje Automated Embedding",
  t2Cloud.some(v => v.adapter === "embedding" && v.izolacia === "zdielana"))
t("T2 pomenuje $rerank",
  t2Cloud.some(v => v.adapter === "rerank" && v.izolacia === "zdielana"))
t("T2 pomenuje priame Anthropic API",
  t2Cloud.some(v => v.adapter === "generation" && v.izolacia === "zdielana"))

t("T2 prepustí vlastnú trojicu",
  checkIsolation(vlastne({ tier: "T2" })).length === 0,
  JSON.stringify(checkIsolation(vlastne({ tier: "T2" })).map(v => v.sprava)))

// Vyhradený účet nie je vyhradený hardvér — Bedrock beží na infraštruktúre
// AWS spoločnej pre zákazníkov, takže na T2 neprejde ani v EU regióne.
const t2Bedrock = checkIsolation(vlastne({
  tier: "T2",
  providers: {
    embedding:  { kind: "tei", url: "http://tei:8080", model: "m", dim: 1024, vectorPath: "embedding" },
    rerank:     { kind: "none", model: "-", topK: 8 },
    generation: { kind: "bedrock", region: "eu-central-1", model: "claude-sonnet-5", citations: true, maxTokens: 1024 },
  },
} as Partial<TenantProfile>))
t("T2 odmietne Bedrock aj v EU regióne",
  t2Bedrock.some(v => v.adapter === "generation"),
  JSON.stringify(t2Bedrock.map(v => v.sprava)))

// Cudzia adresa pri openai — nevieme, či inštancia patrí len nám.
const t2Cudzia = checkIsolation(vlastne({
  tier: "T2",
  providers: {
    embedding:  { kind: "tei", url: "http://tei:8080", model: "m", dim: 1024, vectorPath: "embedding" },
    rerank:     { kind: "none", model: "-", topK: 8 },
    generation: { kind: "openai", url: "https://api.nejaky-cloud.com/v1", model: "x", citations: false, maxTokens: 1024 },
  },
} as Partial<TenantProfile>))
t("T2 odmietne openai na cudzej adrese ako neznámu izoláciu",
  t2Cudzia.some(v => v.adapter === "generation" && v.izolacia === "neznama"),
  JSON.stringify(t2Cudzia.map(v => v.sprava)))

// ── T3 musí sedieť s air-gapom ───────────────────────────────────────────────

const t3Bez = checkIsolation(vlastne({ tier: "T3", dataResidency: "eu-full" }))
t("T3 bez air-gapu je porušenie",
  t3Bez.some(v => v.adapter === "profil"),
  JSON.stringify(t3Bez.map(v => v.sprava)))
t("T3 + air-gap + vlastná trojica prejde",
  checkIsolation(vlastne({ tier: "T3", dataResidency: "air-gap" })).length === 0)

t("neznámy tier sa nahlási ako porušenie",
  checkIsolation(profil({ tier: "T9" as never })).length === 1)

// ── osi sú naozaj nezávislé ──────────────────────────────────────────────────
//
// Toto je jadro návrhu: geografia a zdieľanosť sa nesmú zlievať. Keby sa
// zliali, jedna z nich by prestala niečo znamenať.

t("T2 + global: prísna izolácia, voľná geografia",
  checkIsolation(vlastne({ tier: "T2", dataResidency: "global" })).length === 0 &&
  checkResidency(vlastne({ tier: "T2", dataResidency: "global" })).length === 0)

t("T1 + eu-full: voľná izolácia, prísna geografia",
  checkIsolation(vlastne({ tier: "T1", dataResidency: "eu-full" })).length === 0 &&
  checkResidency(vlastne({ tier: "T1", dataResidency: "eu-full" })).length === 0)

t("prehľad izolácie vypíše všetky tri adaptéry",
  Object.keys(isolationOverview(profil())).length === 3 &&
  isolationOverview(profil()).rerank === "zdielana",
  JSON.stringify(isolationOverview(profil())))

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

let spadloT = false, spravaT = ""
try { validateProfile(profil({ tier: "T2" })) }
catch (e) { spadloT = true; spravaT = (e as Error).message }
t("validateProfile odmietne T2 so zdieľanými adaptérmi", spadloT)
t("chybová hláška menuje izoláciu", /izol/i.test(spravaT), spravaT.slice(0, 200))
t("chybová hláška menuje tier", /T2/.test(spravaT))

t("validateProfile prepustí T3 s air-gapom a vlastnou trojicou", (() => {
  try { validateProfile(vlastne({ tier: "T3", dataResidency: "air-gap" })); return true }
  catch { return false }
})())

