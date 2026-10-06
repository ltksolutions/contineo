/**
 * helpdeskAgents.ts — brána riešiteľa helpdesku (ADR-028, D167).
 *
 * Rovnaký tvar ako `evaluationContext()` a `dpoContext()`: organizácia
 * z hostiteľa, osoba z prihlásenia, rola z osoby. Navyše sú tu kanály,
 * ktorých je osoba riešiteľom — ticket cudzieho kanála nevidí ani s rolou
 * (D161: podmienka v dotaze, nie kontrola nad ním).
 */

import { currentTenant, currentPerson } from "./session"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"
import { HELPDESK_ROLE, channelsForAgent, type HelpdeskChannel } from "./channels"

export type HelpdeskContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant; channels: HelpdeskChannel[] }

export function isHelpdeskAgent(person: Person | null): boolean {
  return Boolean(person?.roles?.includes(HELPDESK_ROLE))
}

export async function helpdeskContext(): Promise<HelpdeskContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[helpdesk] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }
  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isHelpdeskAgent(person)) return { state: "forbidden" }
  const channels = await channelsForAgent(tenant.companyCode, person.id)
  return { state: "ready", person, tenant, channels }
}
