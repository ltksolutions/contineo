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

import type {
  TenantProfile, EmbeddingConfig, RerankConfig, GenerationConfig,
} from "./providers/types"

/**
 * Kam sa dostane text pri spracovaní daným adaptérom.
 *
 *   vlastna  — beží na infraštruktúre, ktorú prevádzkuje zákazník alebo my
 *   eu       — cudzia služba s doloženým spracovaním v EÚ
 *   mimo-eu  — cudzia služba mimo EÚ (doložené)
 *   neznama  — dodávateľ lokalitu neuvádza a nemáme ju potvrdenú
 */
export type Lokalita = "vlastna" | "eu" | "mimo-eu" | "neznama"

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
const POVOLENE: Record<DataResidency, Lokalita[]> = {
  "global":  ["vlastna", "eu", "mimo-eu", "neznama"],
  "eu-data": ["vlastna", "eu", "mimo-eu", "neznama"],
  "eu-full": ["vlastna", "eu"],
  "on-prem": ["vlastna"],
  "air-gap": ["vlastna"],
}

/** Ľudský popis do chybovej hlášky. */
export const POPIS_REZIDENCIE: Record<DataResidency, string> = {
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

const LOKALITA_EMBEDDING: Record<EmbeddingConfig["kind"], Lokalita> = {
  // O5 UZAVRETÉ 2026-07-26. Zoznam subprocesorov MongoDB uvádza:
  //   "Google LLC — Model hosting services for the optional embedding and
  //    reranking model services included in the Cloud Services — United States"
  // https://www.mongodb.com/products/platform/trust/subprocessors
  "atlas-auto": "mimo-eu",
  "tei":        "vlastna",
  "infinity":   "vlastna",
}

const LOKALITA_RERANK: Record<RerankConfig["kind"], Lokalita> = {
  // Atlas to píše priamo v Project Settings: "The model inference platform
  // runs on MongoDB's infrastructure in GCP cloud in a US region."
  "atlas-stage": "mimo-eu",
  "tei":         "vlastna",
  "infinity":    "vlastna",
  "none":        "vlastna",
}

const LOKALITA_GENERATION: Record<GenerationConfig["kind"], Lokalita> = {
  // O6 UZAVRETÉ 2026-07-26. Priame Anthropic API spracúva v americkej
  // infraštruktúre. Cesta do EÚ vedie cez AWS Bedrock (eu-central-1,
  // eu-west-1, eu-west-3, eu-north-1) alebo Google Vertex AI v EU regiónoch
  // — na to ale treba samostatný adaptér, ktorý zatiaľ nemáme.
  "anthropic": "mimo-eu",
  // OpenAI-kompatibilné rozhranie používame na vlastné vLLM/SGLang/Ollama.
  // Ak by tenant nasmeroval url na cudzí cloud, toto tvrdenie prestane
  // platiť — preto to kontroluje aj `lokalitaGenerovania()` nižšie.
  "openai":    "vlastna",
}

/** Hostitelia, ktoré považujeme za vlastnú infraštruktúru. */
const VLASTNE_HOSTY = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/

/**
 * Pri `openai` závisí lokalita od toho, kam url mieri. Interná adresa je
 * vlastná infraštruktúra; čokoľvek verejné je neznáme, kým to niekto
 * nepotvrdí.
 */
function lokalitaGenerovania(g: GenerationConfig): Lokalita {
  if (g.kind !== "openai") return LOKALITA_GENERATION[g.kind]
  if (!g.url) return "neznama"
  try {
    const host = new URL(g.url).hostname
    // Bezdoménové meno je meno služby v Dockeri či Kubernetes.
    return VLASTNE_HOSTY.test(host) || !host.includes(".") ? "vlastna" : "neznama"
  } catch {
    return "neznama"
  }
}

export interface PorusenieRezidencie {
  adapter: "embedding" | "rerank" | "generation" | "utility"
  kind: string
  lokalita: Lokalita
  sprava: string
}

/**
 * Vráti zoznam porušení. Prázdne pole = profil je z hľadiska rezidencie
 * v poriadku. Zámerne nevyhadzuje výnimku — volajúci sa rozhodne, či ide
 * o tvrdú chybu (načítanie profilu) alebo len o hlásenie (admin prehľad).
 */
export function skontrolujRezidenciu(p: TenantProfile): PorusenieRezidencie[] {
  const rezidencia = (p.dataResidency ?? "global") as DataResidency
  const povolene = POVOLENE[rezidencia]
  if (!povolene) {
    return [{
      adapter: "embedding", kind: "-", lokalita: "neznama",
      sprava: `neznáma hodnota dataResidency: "${p.dataResidency}"`,
    }]
  }

  const kandidati: Array<[PorusenieRezidencie["adapter"], string, Lokalita]> = [
    ["embedding",  p.providers.embedding.kind, LOKALITA_EMBEDDING[p.providers.embedding.kind]],
    ["rerank",     p.providers.rerank.kind,    LOKALITA_RERANK[p.providers.rerank.kind]],
    ["generation", p.providers.generation.kind, lokalitaGenerovania(p.providers.generation)],
  ]
  if (p.providers.utility) {
    kandidati.push(["utility", p.providers.utility.kind, lokalitaGenerovania(p.providers.utility)])
  }

  const porusenia: PorusenieRezidencie[] = []
  for (const [adapter, kind, lokalita] of kandidati) {
    if (lokalita === undefined) continue           // neznámy kind rieši iná validácia
    if (povolene.includes(lokalita)) continue

    const preco = lokalita === "neznama"
      ? `lokalita spracovania nie je overená — kým ju dodávateľ nepotvrdí, ` +
        `nesmie sa použiť v režime "${rezidencia}"`
      : `spracovanie prebieha ${lokalita === "mimo-eu" ? "mimo EÚ" : "v cudzej službe"}`

    porusenia.push({
      adapter, kind, lokalita,
      sprava: `${adapter}.kind="${kind}" (${lokalita}) je v rozpore s rezidenciou ` +
              `"${rezidencia}" (${POPIS_REZIDENCIE[rezidencia]}): ${preco}`,
    })
  }
  return porusenia
}

/** Lokality všetkých adaptérov — na výpis do admin prehľadu a do auditu. */
export function prehladLokalit(p: TenantProfile): Record<string, Lokalita> {
  const v: Record<string, Lokalita> = {
    embedding:  LOKALITA_EMBEDDING[p.providers.embedding.kind],
    rerank:     LOKALITA_RERANK[p.providers.rerank.kind],
    generation: lokalitaGenerovania(p.providers.generation),
  }
  if (p.providers.utility) v.utility = lokalitaGenerovania(p.providers.utility)
  return v
}
