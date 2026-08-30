/**
 * kniznica.ts — brána k správe obsahu (D53).
 *
 * **Vlastná rola `spravca-obsahu`, nie `hr`.** Kto normy prideľuje, nie je
 * nutne ten istý človek, ktorý ich píše a nahráva — v zväze je to spravidla
 * legislatívec proti personalistovi. Je to ten istý dôvod, pre ktorý je
 * `hr` oddelené od `people-admin` (D46): rola má zodpovedať práci, nie tomu,
 * kto bol náhodou po ruke pri nastavovaní.
 *
 * Rovnaký vzor ako `hrContext()`, `peopleContext()` a `organizaciaContext()`:
 * rola **a** príslušnosť k tenantovi hostiteľa, obe naraz.
 */

import { currentTenant, currentPerson } from "./session"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const CONTENT_ROLE = "spravca-obsahu"

export type LibraryContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant }

export function isContentManager(person: Person | null): boolean {
  return Boolean(person?.roles?.includes(CONTENT_ROLE))
}

export async function libraryContext(): Promise<LibraryContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[kniznica] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isContentManager(person)) {
    return { state: "forbidden" }
  }
  return { state: "ready", person, tenant }
}
