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
}

export function assistantsState(tenant: Pick<Tenant, "assistants">, residency: DataResidency): AssistantsState {
  const enabled = Boolean(tenant.assistants?.enabled)
  const allowed = !ASSISTANTS_BLOCKED.includes(residency)
  return {
    enabled, allowed, note: ASSISTANTS_WITH_NOTE.includes(residency), active: enabled && allowed,
    publicOnly: Boolean(tenant.assistants?.publicOnly), residency,
  }
}

/**
 * Úroveň prístupu cez MCP: osoba organizácie vidí `internal` ako na webe
 * (`accessLevelFor()`), kým správca nezapne „len verejný obsah".
 */
export function mcpAccessLevel(state: Pick<AssistantsState, "publicOnly">): "public" | "internal" {
  return state.publicOnly ? "public" : "internal"
}
