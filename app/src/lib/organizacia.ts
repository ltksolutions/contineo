/**
 * organizacia.ts — brána k vlastnému nastaveniu organizácie (D48).
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
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export type OrganizaciaContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export async function organizaciaContext(): Promise<OrganizaciaContext> {
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
