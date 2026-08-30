/**
 * residency.ts — kde smie tenantov text prebiehať spracovaním.
 *
 * Viď `docs/ADR-002-datova-rezidencia.md`.
 *
 * Myšlienka: každý adaptér má známu LOKALITU SPRACOVANIA. Rezidencia
 * tenanta hovorí, ktoré lokality sú preň prípustné. Kombinácia sa tak
 * nekontroluje sériou podmienok, ale jednou tabuľkou — pribudnutie
 * nového adaptéra znamená doplniť riadok, nie hľadať všetky miesta,
 * kde sa rozhoduje.
 *
 * Dôležité: "neznáma" je horšia než "mimo EÚ". Adaptér, o ktorom nevieme,
 * kde počíta, sa v prísnom režime NEPOVOLÍ — nevedomosť nie je súhlas.
 */

import { isEuRegion } from "./providers/generation/bedrock"
import type {
  TenantProfile, EmbeddingConfig, RerankConfig, GenerationConfig, Tier,
} from "./providers/types"

/**
 * Kam sa dostane text pri spracovaní daným adaptérom.
 *
 *   vlastna  — beží na infraštruktúre, ktorú prevádzkuje zákazník alebo my
 *   eu       — cudzia služba s doloženým spracovaním v EÚ
 *   mimo-eu  — cudzia služba mimo EÚ (doložené)
 *   neznama  — dodávateľ lokalitu neuvádza a nemáme ju potvrdenú
 */
export type DataLocation = "vlastna" | "eu" | "mimo-eu" | "neznama"

/**
 * Úrovne ochrany. Poradie je od najvoľnejšej po najprísnejšiu.
 *
 *   global    — bez obmedzenia
 *   eu-data   — dáta v pokoji v EÚ; volanie modelov von je prijateľné
 *               (právne kryté DPA a SCC), spracovanie môže byť kdekoľvek
 *   eu-full   — žiadny text neopustí EÚ, ani dotazy používateľov
 *   on-prem   — všetko na infraštruktúre zákazníka
 *   air-gap   — ako on-prem a navyše bez konektivity von
 */
export type DataResidency = "global" | "eu-data" | "eu-full" | "on-prem" | "air-gap"

/** Ktoré lokality daná rezidencia pripúšťa. */
const ALLOWED: Record<DataResidency, DataLocation[]> = {
  "global":  ["vlastna", "eu", "mimo-eu", "neznama"],
  "eu-data": ["vlastna", "eu", "mimo-eu", "neznama"],
  "eu-full": ["vlastna", "eu"],
  "on-prem": ["vlastna"],
  "air-gap": ["vlastna"],
}

/** Ľudský popis do chybovej hlášky. */
export const RESIDENCY_LABEL: Record<DataResidency, string> = {
  "global":  "bez obmedzenia",
  "eu-data": "dáta v pokoji v EÚ, spracovanie môže byť mimo EÚ",
  "eu-full": "žiadny text neopustí EÚ",
  "on-prem": "všetko na infraštruktúre zákazníka",
  "air-gap": "uzavretý perimeter bez konektivity von",
}

// ── Lokalita jednotlivých adaptérov ──────────────────────────────────────────
//
// Zdroje sú uvedené zámerne — pri audite sa treba vedieť oprieť o dôkaz,
// nie o dojem. Čokoľvek neoverené patrí do "neznama", nie do "eu".

const EMBEDDING_LOCATION: Record<EmbeddingConfig["kind"], DataLocation> = {
  // O5 UZAVRETÉ 2026-07-26. Zoznam subprocesorov MongoDB uvádza:
  //   "Google LLC — Model hosting services for the optional embedding and
  //    reranking model services included in the Cloud Services — United States"
  // https://www.mongodb.com/products/platform/trust/subprocessors
  "atlas-auto": "mimo-eu",
  "tei":        "vlastna",
  "infinity":   "vlastna",
}

const RERANK_LOCATION: Record<RerankConfig["kind"], DataLocation> = {
  // Atlas to píše priamo v Project Settings: "The model inference platform
  // runs on MongoDB's infrastructure in GCP cloud in a US region."
  "atlas-stage": "mimo-eu",
  "tei":         "vlastna",
  "infinity":    "vlastna",
  "none":        "vlastna",
}

const GENERATION_LOCATION: Record<GenerationConfig["kind"], DataLocation> = {
  // O6 UZAVRETÉ 2026-07-26. Priame Anthropic API spracúva v americkej
  // infraštruktúre. Cesta do EÚ vedie cez AWS Bedrock (eu-central-1,
  // eu-west-1, eu-west-3, eu-north-1) alebo Google Vertex AI v EU regiónoch
  // — na to ale treba samostatný adaptér, ktorý zatiaľ nemáme.
  "anthropic": "mimo-eu",
  // Bedrock — lokalita závisí od regiónu, rieši `lokalitaGenerovania()`.
  "bedrock": "neznama",
  // OpenAI-kompatibilné rozhranie používame na vlastné vLLM/SGLang/Ollama.
  // Ak by tenant nasmeroval url na cudzí cloud, toto tvrdenie prestane
  // platiť — preto to kontroluje aj `lokalitaGenerovania()` nižšie.
  "openai":    "vlastna",
}

/** Hostitelia, ktoré považujeme za vlastnú infraštruktúru. */
const SELF_HOSTED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/

/**
 * Mieri url na stroj, ktorý prevádzkujeme my alebo zákazník?
 *
 * Rozhoduje o oboch osiach naraz — o geografii aj o zdieľanosti — preto
 * je to jedna funkcia. Keby to boli dve, raz sa rozídu.
 */
function isSelfHostedUrl(url?: string): boolean | "neznama" {
  if (!url) return "neznama"
  try {
    const host = new URL(url).hostname
    // Bezdoménové meno je meno služby v Dockeri či Kubernetes.
    if (SELF_HOSTED_HOSTS.test(host) || !host.includes(".")) return true
    return "neznama"
  } catch {
    return "neznama"
  }
}

/**
 * Pri `openai` závisí lokalita od toho, kam url mieri. Interná adresa je
 * vlastná infraštruktúra; čokoľvek verejné je neznáme, kým to niekto
 * nepotvrdí.
 */
function generationLocation(g: GenerationConfig): DataLocation {
  // Bedrock v EU regióne spracúva v EÚ — to je celý dôvod jeho existencie.
  // Región mimo EÚ ale robí presne to isté, čo priame Anthropic API,
  // takže sa nesmie prepustiť len preto, že „ideme cez AWS".
  if (g.kind === "bedrock") return isEuRegion(g.region) ? "eu" : "mimo-eu"
  if (g.kind !== "openai") return GENERATION_LOCATION[g.kind]
  return isSelfHostedUrl(g.url) === true ? "vlastna" : "neznama"
}

// ── Druhá os: izolácia infraštruktúry (tier) ─────────────────────────────────
//
// Rezidencia hovorí, KDE text prebieha. To ale nie je celý príbeh: zákazník,
// ktorý si platí vyhradené prostredie, sa nepýta len na krajinu, ale aj na to,
// či jeho dotazy prechádzajú tým istým procesom ako dotazy niekoho iného.
//
// Osi sú naozaj nezávislé. Zdieľaná služba v EÚ je legitímna (T1 + eu-full),
// rovnako ako vyhradená inštancia kdekoľvek (T2 + global). Preto sa
// nevyhodnocujú spoločne, ale každá zvlášť.

/**
 * S kým adaptér zdieľa výpočet.
 *
 *   dedikovana — inštancia beží len pre tohto tenanta
 *   zdielana   — cudzia multi-tenant služba; náš text ide cez tie isté procesy
 *                ako text ostatných zákazníkov dodávateľa
 *   neznama    — nevieme; rovnako ako pri lokalite sa berie ako to horšie
 */
export type Isolation = "dedikovana" | "zdielana" | "neznama"

const EMBEDDING_ISOLATION: Record<EmbeddingConfig["kind"], Isolation> = {
  // Automated Embedding je služba MongoDB, nie náš proces.
  "atlas-auto": "zdielana",
  "tei":        "dedikovana",
  "infinity":   "dedikovana",
}

const RERANK_ISOLATION: Record<RerankConfig["kind"], Isolation> = {
  // $rerank počíta na inferenčnej platforme MongoDB, spoločnej pre všetkých.
  "atlas-stage": "zdielana",
  "tei":         "dedikovana",
  "infinity":    "dedikovana",
  // Žiadny rerank neznamená žiadny ďalší príjemca textu.
  "none":        "dedikovana",
}

const GENERATION_ISOLATION: Record<GenerationConfig["kind"], Isolation> = {
  "anthropic": "zdielana",
  // Bedrock je vyhradený účet, ale model beží na infraštruktúre AWS
  // spoločnej pre zákazníkov. Vyhradený účet nie je vyhradený hardvér.
  "bedrock":   "zdielana",
  // Vlastné vLLM/SGLang/Ollama — rieši `izolaciaGenerovania()`.
  "openai":    "dedikovana",
}

/** Ktoré úrovne zdieľania daný tier pripúšťa. */
const ALLOWED_ISOLATION: Record<Tier, Isolation[]> = {
  "T1": ["dedikovana", "zdielana", "neznama"],
  "T2": ["dedikovana"],
  "T3": ["dedikovana"],
}

export const TIER_LABEL: Record<Tier, string> = {
  "T1": "zdieľaná infraštruktúra",
  "T2": "vyhradené prostredie pre jedného tenanta",
  "T3": "vyhradené a odpojené od siete",
}

/**
 * T3 je z pohľadu izolácie to isté, čo air-gap z pohľadu geografie.
 * Kým to nie je vynútené, dá sa nastaviť T3 s konektivitou von — čo je
 * presne ten typ profilu, ktorý vyzerá prísne a nie je.
 */
const TIER_REQUIRES_RESIDENCY: Partial<Record<Tier, DataResidency>> = {
  "T3": "air-gap",
}

function generationIsolation(g: GenerationConfig): Isolation {
  if (g.kind !== "openai") return GENERATION_ISOLATION[g.kind]
  return isSelfHostedUrl(g.url) === true ? "dedikovana" : "neznama"
}

export interface IsolationViolation {
  adapter: "embedding" | "rerank" | "generation" | "utility" | "profil"
  kind: string
  isolation: Isolation
  message: string
}

/**
 * Vráti zoznam porušení izolácie. Rovnako ako pri rezidencii nevyhadzuje
 * výnimku — volajúci rozhodne, či ide o tvrdú chybu alebo o hlásenie.
 */
export function checkIsolation(p: TenantProfile): IsolationViolation[] {
  const tier = (p.tier ?? "T1") as Tier
  const allowed = ALLOWED_ISOLATION[tier]
  if (!allowed) {
    return [{
      adapter: "profil", kind: "-", isolation: "neznama",
      message: `neznáma hodnota tier: "${p.tier}"`,
    }]
  }

  const violations: IsolationViolation[] = []

  // Konzistencia oboch osí — T3 bez air-gapu je len vyhradené prostredie.
  const required = TIER_REQUIRES_RESIDENCY[tier]
  if (required && p.dataResidency !== required) {
    violations.push({
      adapter: "profil", kind: tier, isolation: "neznama",
      message: `tier="${tier}" (${TIER_LABEL[tier]}) vyžaduje dataResidency="${required}", ` +
              `nie "${p.dataResidency}" — inak by odpojenie bolo len na papieri`,
    })
  }

  const candidates: Array<[IsolationViolation["adapter"], string, Isolation]> = [
    ["embedding",  p.providers.embedding.kind,  EMBEDDING_ISOLATION[p.providers.embedding.kind]],
    ["rerank",     p.providers.rerank.kind,     RERANK_ISOLATION[p.providers.rerank.kind]],
    ["generation", p.providers.generation.kind, generationIsolation(p.providers.generation)],
  ]
  if (p.providers.utility) {
    candidates.push(["utility", p.providers.utility.kind, generationIsolation(p.providers.utility)])
  }

  for (const [adapter, kind, isolation] of candidates) {
    if (isolation === undefined) continue
    if (allowed.includes(isolation)) continue

    const why = isolation === "neznama"
      ? `nevieme, či inštancia beží len pre tohto tenanta`
      : `ide o cudziu službu spoločnú pre viacerých zákazníkov`

    violations.push({
      adapter, kind, isolation: isolation,
      message: `${adapter}.kind="${kind}" (${isolation}) je v rozpore s tierom ` +
              `"${tier}" (${TIER_LABEL[tier]}): ${why}`,
    })
  }
  return violations
}

/** Izolácia všetkých adaptérov — na výpis do admin prehľadu a do auditu. */
export function isolationOverview(p: TenantProfile): Record<string, Isolation> {
  const v: Record<string, Isolation> = {
    embedding:  EMBEDDING_ISOLATION[p.providers.embedding.kind],
    rerank:     RERANK_ISOLATION[p.providers.rerank.kind],
    generation: generationIsolation(p.providers.generation),
  }
  if (p.providers.utility) v.utility = generationIsolation(p.providers.utility)
  return v
}

export interface ResidencyViolation {
  adapter: "embedding" | "rerank" | "generation" | "utility"
  kind: string
  location: DataLocation
  message: string
}

/**
 * Vráti zoznam porušení. Prázdne pole = profil je z hľadiska rezidencie
 * v poriadku. Zámerne nevyhadzuje výnimku — volajúci sa rozhodne, či ide
 * o tvrdú chybu (načítanie profilu) alebo len o hlásenie (admin prehľad).
 */
export function checkResidency(p: TenantProfile): ResidencyViolation[] {
  const residency = (p.dataResidency ?? "global") as DataResidency
  const allowed = ALLOWED[residency]
  if (!allowed) {
    return [{
      adapter: "embedding", kind: "-", location: "neznama",
      message: `neznáma hodnota dataResidency: "${p.dataResidency}"`,
    }]
  }

  const candidates: Array<[ResidencyViolation["adapter"], string, DataLocation]> = [
    ["embedding",  p.providers.embedding.kind, EMBEDDING_LOCATION[p.providers.embedding.kind]],
    ["rerank",     p.providers.rerank.kind,    RERANK_LOCATION[p.providers.rerank.kind]],
    ["generation", p.providers.generation.kind, generationLocation(p.providers.generation)],
  ]
  if (p.providers.utility) {
    candidates.push(["utility", p.providers.utility.kind, generationLocation(p.providers.utility)])
  }

  const violations: ResidencyViolation[] = []
  for (const [adapter, kind, location] of candidates) {
    if (location === undefined) continue           // neznámy kind rieši iná validácia
    if (allowed.includes(location)) continue

    const why = location === "neznama"
      ? `lokalita spracovania nie je overená — kým ju dodávateľ nepotvrdí, ` +
        `nesmie sa použiť v režime "${residency}"`
      : `spracovanie prebieha ${location === "mimo-eu" ? "mimo EÚ" : "v cudzej službe"}`

    violations.push({
      adapter, kind, location: location,
      message: `${adapter}.kind="${kind}" (${location}) je v rozpore s rezidenciou ` +
              `"${residency}" (${RESIDENCY_LABEL[residency]}): ${why}`,
    })
  }
  return violations
}

/** Lokality všetkých adaptérov — na výpis do admin prehľadu a do auditu. */
export function locationOverview(p: TenantProfile): Record<string, DataLocation> {
  const v: Record<string, DataLocation> = {
    embedding:  EMBEDDING_LOCATION[p.providers.embedding.kind],
    rerank:     RERANK_LOCATION[p.providers.rerank.kind],
    generation: generationLocation(p.providers.generation),
  }
  if (p.providers.utility) v.utility = generationLocation(p.providers.utility)
  return v
}
