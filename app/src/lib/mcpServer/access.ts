/**
 * access.ts — smie organizácia ponúkať MCP server a čo cez neho ide
 * (ADR-038, D251, D252).
 *
 * Čisté funkcie bez databázy: rozhodnutie o prístupe sa má dať prečítať
 * a otestovať bez behu. Zapnutie je nastavenie organizácie (predvolene
 * vypnuté); rezidencia ho vie prebiť — `on-prem` a `air-gap` sľubujú, že
 * obsah neopustí perimeter, a model klienta je mimo neho.
 */

import type { DataResidency } from "../residency"
import type { Tenant } from "../tenants"

/** Režimy, v ktorých sa MCP server zapnúť nedá (D251). */
export const ASSISTANTS_BLOCKED: readonly DataResidency[] = ["on-prem", "air-gap"]
/** Režim, kde sa zapnúť dá, ale s poznámkou: organizácia ručí za výber klienta. */
export const ASSISTANTS_WITH_NOTE: readonly DataResidency[] = ["eu-full"]

/**
 * Stropy úsekov pre `search_library` (Ján 25. 10. 2026): koľko úsekov pošle
 * MCP server modelu klienta z jedného zdroja. Strop musí byť na serveri —
 * text, ktorý odišiel, si model spätne neustráži — ale organizácia si ho
 * nastaví sama posuvníkom v Prístup → AI asistenti.
 *
 * Z čoho sú rozsahy:
 *   · **dokumenty** (knižnica a každý konektor): úsek knižnice má cieľ
 *     300–900 tokenov (ADR-035); pod 3 úseky chýba kontext na citáciu, nad
 *     15 (≈ 13 000 tokenov) jedno hľadanie zaberie podstatnú časť kontextu.
 *     Predvolene 8 ≈ 2 500–7 000 tokenov; na portáli ide modelu Continea 5.
 *   · **Legislatíva**: paragraf zákona býva dlhý (aj 2 000–3 000 znakov);
 *     1–8, predvolene 4 — ten istý strop ako na portáli (`lawSearch`).
 * Po mesiaci prevádzky sa dajú overiť z `mcp_calls.size`.
 */
export const SEARCH_CAP_RANGE = {
  documents: { min: 3, max: 15, default: 8 },
  law: { min: 1, max: 8, default: 4 },
} as const

export interface SearchCaps {
  /** Knižnica a každý konektor zvlášť. */
  documents: number
  /** Legislatíva (Slov-Lex). */
  law: number
}

/** Hodnota z formulára alebo z databázy → celé číslo v rozsahu; čokoľvek iné = predvoľba. */
export function clampCap(raw: unknown, range: { min: number; max: number; default: number }): number {
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN
  if (!Number.isFinite(n)) return range.default
  return Math.min(range.max, Math.max(range.min, Math.round(n)))
}

export function searchCaps(raw: { documents?: unknown; law?: unknown } | null | undefined): SearchCaps {
  return {
    documents: clampCap(raw?.documents, SEARCH_CAP_RANGE.documents),
    law: clampCap(raw?.law, SEARCH_CAP_RANGE.law),
  }
}

export interface AssistantsState {
  /** Prepínač organizácie. */
  enabled: boolean
  /** Rezidencia dovoľuje zapnutie. */
  allowed: boolean
  /** Rezidencia dovoľuje, ale s upozornením (eu-full). */
  note: boolean
  /** Server sa naozaj ponúka: zapnutý a dovolený. */
  active: boolean
  /** Cez MCP ide len verejný obsah (D252). */
  publicOnly: boolean
  residency: DataResidency
  /** Stropy úsekov pre `search_library`. */
  caps: SearchCaps
}

export function assistantsState(tenant: Pick<Tenant, "assistants">, residency: DataResidency): AssistantsState {
  const enabled = Boolean(tenant.assistants?.enabled)
  const allowed = !ASSISTANTS_BLOCKED.includes(residency)
  return {
    enabled, allowed, note: ASSISTANTS_WITH_NOTE.includes(residency), active: enabled && allowed,
    publicOnly: Boolean(tenant.assistants?.publicOnly), residency,
    caps: searchCaps(tenant.assistants?.searchCaps),
  }
}

/**
 * Úroveň prístupu cez MCP: osoba organizácie vidí `internal` ako na webe
 * (`accessLevelFor()`), kým správca nezapne „len verejný obsah".
 */
export function mcpAccessLevel(state: Pick<AssistantsState, "publicOnly">): "public" | "internal" {
  return state.publicOnly ? "public" : "internal"
}
