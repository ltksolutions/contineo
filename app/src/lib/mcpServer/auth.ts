/**
 * auth.ts — od požiadavky na `/mcp` k tomu, za koho server pracuje
 * (ADR-038, D249).
 *
 * Poradie brán, každá predpokladá predchádzajúcu:
 *   1. doména vedie na organizáciu (D29) a tá má MCP zapnuté a dovolené
 *      rezidenciou (D251) — inak `404`, server sa nemá čím prezradiť;
 *   2. hlavička nesie platný prístupový token vydaný **na tejto doméne**
 *      (organizácia je v podmienke, D32) — inak `401` s odkazom na metadáta
 *      chráneného zdroja, podľa ktorého klient nájde, kde sa prihlásiť;
 *   3. osoba z tokenu je stále aktívna v `persons` — token prežíva
 *      vyradenie osoby nanajvýš hodinu, ale ani tú nie.
 *
 * Výsledok je `McpActor`: všetko, čo nástroje potrebujú, bez ďalších dotazov.
 */

import { getCollection } from "../mongodb"
import { PERSONS_COLLECTION, type Person } from "../persons"
import { getTenantProfile } from "../tenantProfile"
import { currentTenant } from "../session"
import { verifyAccessToken, clientById, type OAuthScope } from "../oauthServer"
import { assistantsState, mcpAccessLevel, type AssistantsState } from "./access"
import { bearerToken, originOf } from "./origin"
import type { Tenant } from "../tenants"

export interface McpActor {
  tenant: Tenant
  person: Person
  origin: string
  scopes: OAuthScope[]
  clientId: string
  clientName: string
  grantId: string
  accessLevel: "public" | "internal"
  state: AssistantsState
}

export type McpGate =
  | { ok: true; actor: McpActor }
  | { ok: false; response: Response }

/** Hlavička, podľa ktorej klient nájde metadáta a autorizačný server (RFC 9728 § 5.1). */
export function unauthorized(origin: string, description?: string): Response {
  const parts = [
    `Bearer realm="Contineo"`,
    `resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
    ...(description ? [`error="invalid_token"`, `error_description="${description.replace(/"/g, "'")}"`] : []),
  ]
  return new Response(null, { status: 401, headers: { "WWW-Authenticate": parts.join(", ") } })
}

export async function tenantForMcp(): Promise<{ tenant: Tenant; state: AssistantsState } | null> {
  const tenant = await currentTenant()
  if (!tenant) return null
  const profile = await getTenantProfile(tenant.companyCode)
  const state = assistantsState(tenant, profile.dataResidency)
  return { tenant, state }
}

export async function mcpGate(req: Request): Promise<McpGate> {
  const origin = originOf(req)
  const found = await tenantForMcp()
  if (!found || !found.state.active) return { ok: false, response: new Response(null, { status: 404 }) }
  const { tenant, state } = found

  const token = bearerToken(req)
  if (!token) return { ok: false, response: unauthorized(origin) }
  const info = await verifyAccessToken(tenant.companyCode, token)
  if (!info) return { ok: false, response: unauthorized(origin, "token neplatí alebo vypršal") }

  const persons = await getCollection<Person>(PERSONS_COLLECTION)
  const person = await persons.findOne({ companyCode: tenant.companyCode, id: info.personId })
  if (!person || person.status === "inactive") return { ok: false, response: unauthorized(origin, "osoba už nemá prístup") }

  const client = await clientById(tenant.companyCode, info.clientId)
  return {
    ok: true,
    actor: {
      tenant, person, origin, scopes: info.scopes, clientId: info.clientId,
      clientName: client?.clientName ?? info.clientId, grantId: info.grantId,
      accessLevel: mcpAccessLevel(state), state,
    },
  }
}
