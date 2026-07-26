/**
 * providers/generation/bedrock.ts
 *
 * Claude cez AWS Bedrock. Dôvod existencie je jediný, ale zásadný:
 * **inferencia v EÚ** (ADR-002, O6). Priame Anthropic API spracúva
 * v USA, Bedrock v `eu-central-1` (Frankfurt), `eu-west-1` (Írsko),
 * `eu-west-3` (Paríž) alebo `eu-north-1` (Štokholm).
 *
 * Odomyká tým režim `eu-full` pre generovanie **bez vlastného GPU** —
 * jediný z troch adaptérov, ktorý sa dá do EÚ dostať bez hardvéru.
 *
 * Telo požiadavky je zhodné s Messages API (zdieľame `messagesBody`),
 * takže Citations aj prompt caching by mali fungovať rovnako. Líšia sa
 * dve veci:
 *
 *   1. autentifikácia — podpis SigV4 namiesto API kľúča
 *   2. prenos streamu — binárne rámce namiesto SSE
 *
 * ⚠️ INTEGRAČNE NEOVERENÉ. Nemáme AWS účet, takže tento adaptér nikdy
 * nebežal proti skutočnému Bedrocku. Podpis SigV4 je overený proti
 * oficiálnym testovacím vektorom AWS a parser rámcov proti syntetickým
 * dátam, ale to nenahrádza skutočné volanie. Pred nasadením u zákazníka
 * to treba vyskúšať.
 */

import { ChunkResult } from "../../mongoSearch"
import {
  GenerationConfig, GenerationProvider, GenerationRequest, GenerationEvent,
  CompleteOptions, ProviderConfigError,
} from "../types"
import { anthropicEvent, messagesBody } from "./anthropic"
import { citajEventy } from "./eventStream"
import { signRequest } from "./sigv4"

/** Verzia Messages API, ktorú Bedrock očakáva v tele požiadavky. */
const BEDROCK_VERSION = "bedrock-2023-05-31"

/** Regióny so spracovaním v EÚ — viď residency.ts. */
export const EU_REGIONY = new Set([
  "eu-central-1", "eu-central-2",
  "eu-west-1", "eu-west-2", "eu-west-3",
  "eu-north-1", "eu-south-1", "eu-south-2",
])

export class BedrockGenerationProvider implements GenerationProvider {
  readonly kind = "bedrock" as const
  readonly model: string
  readonly supportsCitations: boolean
  private cfg: GenerationConfig
  private region: string
  private accessKeyId: string
  private secretAccessKey: string
  private sessionToken?: string

  constructor(cfg: GenerationConfig) {
    if (!cfg.region) {
      throw new ProviderConfigError(
        `bedrock vyžaduje región (napr. "eu-central-1") — bez neho nevieme, kde sa text spracúva`
      )
    }
    const id = process.env[cfg.accessKeyEnv ?? "AWS_ACCESS_KEY_ID"]
    const secret = process.env[cfg.secretKeyEnv ?? "AWS_SECRET_ACCESS_KEY"]
    if (!id || !secret) {
      throw new ProviderConfigError(
        `Chýbajú AWS prihlasovacie údaje ` +
        `(${cfg.accessKeyEnv ?? "AWS_ACCESS_KEY_ID"}, ${cfg.secretKeyEnv ?? "AWS_SECRET_ACCESS_KEY"})`
      )
    }
    this.region = cfg.region
    this.accessKeyId = id
    this.secretAccessKey = secret
    this.sessionToken = process.env.AWS_SESSION_TOKEN
    this.model = cfg.model
    this.supportsCitations = cfg.citations !== false
    this.cfg = cfg
  }

  private url(streamovat: boolean): string {
    const akcia = streamovat ? "invoke-with-response-stream" : "invoke"
    return `https://bedrock-runtime.${this.region}.amazonaws.com` +
           `/model/${encodeURIComponent(this.model)}/${akcia}`
  }

  private async posli(url: string, telo: Record<string, unknown>, signal?: AbortSignal) {
    const body = JSON.stringify(telo)
    const headers = await signRequest({
      method: "POST",
      url,
      region: this.region,
      service: "bedrock",
      body,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      sessionToken: this.sessionToken,
      headers: { "content-type": "application/json" },
    })

    const res = await fetch(url, { method: "POST", headers, body, signal })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Bedrock ${res.status}: ${detail.slice(0, 300)}`)
    }
    return res
  }

  async *stream(req: GenerationRequest): AsyncGenerator<GenerationEvent> {
    // Bedrock berie model z URL, nie z tela — a `anthropic_version`
    // vyžaduje namiesto neho.
    const telo = messagesBody(this.cfg, req, this.supportsCitations, this.model)
    delete telo.model
    telo.anthropic_version = BEDROCK_VERSION

    const res = await this.posli(this.url(true), telo)
    if (!res.body) throw new Error("Bedrock: odpoveď bez tela")

    for await (const ev of citajEventy(res.body)) {
      yield* anthropicEvent(ev, req.chunks)
    }
  }

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const telo: Record<string, unknown> = {
      anthropic_version: BEDROCK_VERSION,
      max_tokens: opts.maxTokens ?? 256,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      messages: [{ role: "user", content: prompt }],
    }

    const res = await this.posli(
      this.url(false), telo,
      opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined
    )

    const data: any = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text !== "string") throw new Error("Bedrock: odpoveď bez textu")
    return text.trim()
  }
}

/** Používa tento profil región v EÚ? Rozhoduje o lokalite v residency.ts. */
export function jeEuRegion(region?: string): boolean {
  return !!region && EU_REGIONY.has(region)
}

export type { ChunkResult }
