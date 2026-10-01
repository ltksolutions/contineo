/**
 * orgSettings.ts — brána k vlastnému nastaveniu organizácie (D48).
 *
 * Rovnaký vzor ako `hrContext()` a `peopleContext()`: rola **a** príslušnosť
 * k tenantovi hostiteľa, obe naraz.
 *
 * Rola je `people-admin`, nie nová. Kto v organizácii zakladá a vyraďuje
 * ľudí, je spravidla ten istý človek, ktorý vie, ako sa organizácia volá a aké
 * má logo — a každá ďalšia rola znamená nastavovať jedného človeka trikrát.
 *
 * **Správca platformy si ponecháva plnú správu všetkých organizácií** cez
 * `/admin` (helpdesk a podpora). Táto obrazovka mu nič neuberá; pridáva
 * zákazníkovi možnosť nečakať na nás.
 */

import { currentTenant, currentPerson } from "./session"
import { PEOPLE_ROLE } from "./people"
import { DPO_ROLE } from "./dpo"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export type OrgContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function orgContext(): Promise<OrgContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[organizacia] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !person.roles?.includes(PEOPLE_ROLE)) {
    return { state: "forbidden" }
  }
  return { state: "ready", person, tenant }
}

/**
 * Brána k **stránke** nastavení (D154): správca osôb celá, DPO len záložka
 * GDPR. Lehoty uchovávania a doplnok na `/privacy` rozhoduje DPO (D136,
 * D137); bývajú v nastaveniach organizácie, ale upravuje ich len on —
 * správca osôb ich vidí na čítanie.
 *
 * Akcie ostatných záložiek ďalej strážia `orgContext()` (len správca osôb),
 * akcie záložky GDPR `dpoContext()` (len DPO).
 */
export type OrgPageContext =
  | Exclude<OrgContext, { state: "ready" }>
  | { state: "ready"; person: Person; tenant: Tenant; canAdmin: boolean; canEditGdpr: boolean }

export async function orgPageContext(): Promise<OrgPageContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[organizacia] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode) return { state: "forbidden" }
  const canAdmin = Boolean(person.roles?.includes(PEOPLE_ROLE))
  const canEditGdpr = Boolean(person.roles?.includes(DPO_ROLE))
  if (!canAdmin && !canEditGdpr) return { state: "forbidden" }
  return { state: "ready", person, tenant, canAdmin, canEditGdpr }
}
