/**
 * session.ts — od požiadavky k tomu, s kým a za koho hovoríme.
 *
 * Dve otázky naraz, lebo obe má odpoveď až v kontexte konkrétnej požiadavky:
 *
 *   · **Kto je za touto adresou?** Hostiteľ určuje tenanta (D29). Vie sa to
 *     ešte pred prihlásením — prihlasovacia stránka už musí vedieť, čia je.
 *   · **Kto sa prihlásil?** Relácia (NextAuth) vie len e-mail. Onboarding
 *     potrebuje osobu: jej `companyCode` rozhoduje o tom, na ktoré dokumenty
 *     vidí (D32), `tracks` o tom, čo má prejsť, a `language` o tom, v akej
 *     reči sa s ňou hovorí.
 *
 * Správca, ktorý prešiel núdzovou brzdou (`ALLOWED_EMAILS`), v `persons`
 * byť nemusí — vtedy tu nie je osoba a stránky onboardingu mu nemajú čo
 * ukázať. Nie je to chyba, je to legitímny stav.
 */

import { headers } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { findPerson } from "./persons"
import { resolveTenant, normalizeHostname, personBelongsToTenant } from "./tenants"
import type { Person } from "./persons"
import type { Tenant } from "./tenants"

export async function currentPerson(): Promise<Person | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return null
  try {
    return await findPerson(email)
  } catch (e) {
    // Nahlas — inak by výpadok databázy vyzeral ako „nie si nikto".
    console.error("[session] osobu sa nepodarilo načítať:", e)
    return null
  }
}

/**
 * Adresa z relácie, alebo `null`. Bez dotazu do `persons` — na otázku
 * „je vôbec niekto prihlásený" netreba osobu, a prihlasovacia stránka to
 * potrebuje vedieť pri každom zobrazení.
 */
export async function currentEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.email ?? null
}

/** Hostiteľ, na ktorý prišla táto požiadavka. */
export async function requestHostname(): Promise<string> {
  const h = await headers()
  // Za proxy Vercelu je pôvodný hostiteľ v `x-forwarded-host`; `host` môže
  // byť interná adresa. Poradie je preto takéto a nie opačné.
  return normalizeHostname(h.get("x-forwarded-host") ?? h.get("host"))
}

/** Tenant pre práve spracúvanú požiadavku. `null` = neznámy hostiteľ. */
export async function currentTenant(): Promise<Tenant | null> {
  return resolveTenant(await requestHostname())
}

/**
 * Stav požiadavky ako jedna hodnota, nie ako tri nezávislé kontroly.
 *
 * Keby si každá stránka skladala „tenant + osoba + patria k sebe" sama,
 * jedna z nich raz niektorú časť vynechá a nikto si to nevšimne — chýbajúca
 * kontrola nevyzerá ako chyba, vyzerá ako fungujúca stránka.
 */
export type OnboardingContext =
  /** Doména nevedie na žiadneho aktívneho tenanta. Nič sa neukazuje. */
  | { state: "unknown-host"; hostname: string }
  /** Tenant je známy, človek nie je prihlásený. */
  | { state: "not-signed-in"; tenant: Tenant }
  /**
   * Prihlásený, ale nie je vedený medzi osobami tohto tenanta — buď v
   * `persons` nie je vôbec (správca cez núdzovú brzdu), alebo patrí inému
   * tenantovi a prišiel cez cudziu doménu. Z pohľadu portálu je to to isté:
   * nemá tu čo potvrdzovať.
   */
  | { state: "not-in-tenant"; tenant: Tenant; email: string }
  | { state: "ready"; tenant: Tenant; person: Person }

export async function onboardingContext(): Promise<OnboardingContext> {
  const hostname = await requestHostname()
  const tenant = await resolveTenant(hostname)
  if (!tenant) return { state: "unknown-host", hostname }

  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) return { state: "not-signed-in", tenant }

  const person = await currentPerson()
  if (!person || !personBelongsToTenant(person, tenant)) {
    return { state: "not-in-tenant", tenant, email }
  }
  return { state: "ready", tenant, person }
}
