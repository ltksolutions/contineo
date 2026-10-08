/**
 * Profily MCP serverov (ADR-029, D173). Nový server = nový profil tu,
 * nie nová vrstva. `generic` nemá hľadanie — konektor s ním ponúka len
 * nástroje pre asistenta (fáza 3).
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
  return PROFILES[key]
}

export type { ServerProfile, LiveArticle, McpToolCaller } from "./types"
