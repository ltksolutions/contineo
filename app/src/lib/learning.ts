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
 * Vypnutý modul vracia `disabled` a podstránky odpovedia `notFound()` (D123).
 * **Výnimka je `/learning`** (SHELL-menu-v-hlavicke, Q5, 30. 9. 2026):
 * Vzdelávanie je v lište aj v menu u každého, takže úvodná stránka povie,
 * že modul organizácia nemá zapnutý — namiesto 404 na odkaze z menu.
 */

import { currentTenant, currentPerson } from "./session"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export const LEARNING_ROLE = "learning-admin"

/**
 * Komu napísať, keď organizácia chce modul zapnúť — veta pre správcu
 * organizácie na `/learning` pri vypnutom module (SHELL-menu-v-hlavicke,
 * Q5). Adresu určil Ján Letko 30. 9. 2026.
 */
export const OPERATOR_CONTACT = "office@ltk.solutions"

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
