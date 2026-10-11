/**
 * complianceAccess.ts — brána ku kontrole súladu dokumentov (ADR-032, D196).
 *
 * **Vlastná rola `compliance`** (Ján 11. 10. 2026: „zaveďme na to rolu, nie
 * je to pre každého v spoločnosti"). Kontrola číta aj interné normy a jej
 * nálezy hovoria o slabinách predpisov — to nie je pre každého správcu
 * obsahu. Kontroly sú spoločné: všetci s rolou vidia všetky behy
 * organizácie, nielen svoje.
 *
 * Zápis prijatého znenia do konceptu je úprava dokumentu, preto ho robí len
 * ten, kto má **aj** `content-admin`. Ostatným sa rozhodnutie uloží a znenie
 * vloží správca obsahu (`applied: "manual"`).
 */

import { currentTenant, currentPerson } from "./session"
import { isContentManager } from "./library"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const COMPLIANCE_ROLE = "compliance"

export function isComplianceReviewer(person: Person | null): boolean {
  return Boolean(person?.roles?.includes(COMPLIANCE_ROLE))
}

export type ComplianceContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant; canEditDrafts: boolean }

/**
 * Detail behu vidí aj správca obsahu bez roly `compliance` — dostal
 * upozornenie, že prijaté znenie čaká na zápis do konceptu (D199). Správca
 * obsahu už spravuje všetky dokumenty knižnice vrátane interných, nálezy
 * mu nič nové neodkryjú. Rozhodovať a spúšťať smie len rola `compliance`.
 */
export type ComplianceViewContext =
  | { state: "unknown-host" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant; canEditDrafts: boolean; isReviewer: boolean }

export async function complianceViewContext(): Promise<ComplianceViewContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[kontrola-suladu] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }
  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  const isReviewer = isComplianceReviewer(person)
  const canEditDrafts = isContentManager(person)
  if (person.companyCode !== tenant.companyCode || (!isReviewer && !canEditDrafts)) return { state: "forbidden" }
  return { state: "ready", person, tenant, canEditDrafts, isReviewer }
}

export async function complianceContext(): Promise<ComplianceContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    console.error("[kontrola-suladu] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }
  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  if (person.companyCode !== tenant.companyCode || !isComplianceReviewer(person)) return { state: "forbidden" }
  return { state: "ready", person, tenant, canEditDrafts: isContentManager(person) }
}
