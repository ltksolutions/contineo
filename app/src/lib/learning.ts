/**
 * Vzdelávanie (modul `learning`, ADR-018) — zapnutie modulu, rola a brány.
 *
 * Dve brány, lebo modul má dvoch používateľov:
 * - `learningContext()` — **každý prihlásený** v organizácii so zapnutým
 *   modulom (Moje kurzy). Kurz sa nedá prideliť niekomu, kto ho neuvidí.
 * - `learningAdminContext()` — rola `learning-admin` (lektor, metodik):
 *   správa kurzov, banka otázok, testy. Rola zodpovedá práci (D46, D53),
 *   preto nie `content-admin` — kto spravuje predpisy, nemusí robiť kurzy.
 *
 * Vypnutý modul vracia `disabled` a stránka odpovie `notFound()` (D123).
 * Prezradiť „modul existuje, ale nemáš ho" by bolo to isté ako odkaz do
 * sekcie, do ktorej človek nesmie (`appNav.ts`).
 */

import { currentTenant, currentPerson } from "./session"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const LEARNING_ROLE = "learning-admin"

export function learningEnabled(tenant: Pick<Tenant, "modules"> | null): boolean {
  return tenant?.modules?.learning === true
}

export function isLearningAdmin(person: Pick<Person, "roles"> | null): boolean {
  return Boolean(person?.roles?.includes(LEARNING_ROLE))
}

export type LearningContext =
  | { state: "unknown-host" }
  | { state: "disabled" }
  | { state: "not-signed-in" }
  | { state: "forbidden" }
  | { state: "ready"; person: Person; tenant: Tenant; isAdmin: boolean }

async function context(adminOnly: boolean): Promise<LearningContext> {
  let tenant: Tenant | null = null
  try {
    tenant = await currentTenant()
  } catch (e) {
    // Výpadok databázy nesmie obrazovku otvoriť (rovnako ako `dpoContext()`).
    console.error("[learning] tenanta sa nepodarilo načítať:", e)
    return { state: "unknown-host" }
  }
  if (!tenant) return { state: "unknown-host" }
  if (!learningEnabled(tenant)) return { state: "disabled" }

  const person = await currentPerson()
  if (!person) return { state: "not-signed-in" }
  // `companyCode` sa porovnáva aj tu, nielen v dotazoch (D29, D32).
  if (person.companyCode !== tenant.companyCode) return { state: "forbidden" }
  const isAdmin = isLearningAdmin(person)
  if (adminOnly && !isAdmin) return { state: "forbidden" }
  return { state: "ready", person, tenant, isAdmin }
}

/** Moje kurzy — každý prihlásený v organizácii so zapnutým modulom. */
export function learningContext(): Promise<LearningContext> {
  return context(false)
}

/** Správa kurzov a testy — len rola `learning-admin`. */
export function learningAdminContext(): Promise<LearningContext> {
  return context(true)
}
