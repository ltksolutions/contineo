/**
 * Profily MCP serverov (ADR-029, D173, D178). Od 9. 10. 2026 je profil
 * predvyplnenie pre známy server: rozpozná sa sám (`detectProfile`) a navrhne
 * nástroj na hľadanie. Server bez profilu je `generic` — nástroj vyberie
 * správca a výsledok sa číta podľa štandardu (`../generic.ts`).
 */

import type { ServerProfile } from "./types"
import { sportnetDocs } from "./sportnetDocs"

export const generic: ServerProfile = {
  key: "generic",
  label: "Všeobecný MCP server",
  filterFields: [],
}

export const PROFILES = {
  "sportnet-docs": sportnetDocs,
  generic,
} as const

export type ProfileKey = keyof typeof PROFILES

export function isProfileKey(x: unknown): x is ProfileKey {
  return typeof x === "string" && x in PROFILES
}

export function profileFor(key: ProfileKey): ServerProfile {
  return PROFILES[key] ?? generic
}

/** Profil podľa adresy, po pripojení aj podľa `serverInfo.name`; inak `generic`. */
export function detectProfile(endpoint: string, serverName?: string): ProfileKey {
  for (const key of Object.keys(PROFILES) as ProfileKey[]) {
    if (PROFILES[key].matches?.(endpoint, serverName)) return key
  }
  return "generic"
}

export type { ServerProfile, LiveArticle, McpToolCaller, ProfileDefaults } from "./types"
