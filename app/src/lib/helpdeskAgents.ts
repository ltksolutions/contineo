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
import { isPeopleAdmin } from "./people"
import { HELPDESK_ROLE, channelsForAgent, listChannels, type HelpdeskChannel } from "./channels"

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

export type ChannelsContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | {
      state: "ready"
      person: Person
      tenant: Tenant
      /** Správca organizácie — vidí všetky kanály a ich nastavenie, nie obsah ticketov (D170). */
      isAdmin: boolean
      /** Kanály s ticketmi, ktorých je osoba riešiteľom — len tieto tickety smie čítať. */
      agentChannels: HelpdeskChannel[]
      /** Kanály v zozname: správcovi všetky, riešiteľovi jeho. */
      visible: HelpdeskChannel[]
    }

/**
 * Brána sekcie Kanály (D170, Ján 7. 10. 2026): jedna položka v menu pre
 * správcu organizácie aj riešiteľa. Každý vidí len kanály, ku ktorým má
 * prístup. **Správca obsah ticketov nevidí** — tickety nesú osobné údaje
 * zvonku (aj maloletých) a správa nastavení na ich čítanie dôvod nedáva;
 * kto ich má čítať, pridá sa medzi riešiteľov.
 */
export async function channelsContext(): Promise<ChannelsContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[channels] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }
  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode) return { state: "forbidden" }
  const isAdmin = isPeopleAdmin(person)
  const agentChannels = isHelpdeskAgent(person) ? await channelsForAgent(tenant.companyCode, person.id) : []
  if (!isAdmin && !agentChannels.length) return { state: "forbidden" }
  const visible = isAdmin ? await listChannels(tenant.companyCode) : agentChannels
  return { state: "ready", person, tenant, isAdmin, agentChannels, visible }
}
