/**
 * tenantScope.ts — organizácia v podmienke dotazu je povinná (D90).
 *
 * Tenanti sú oddelení galvanicky. Pravidlo „`companyCode` patrí do podmienky
 * dotazu, nie do kontroly nad ním" (D32) sa v kóde dlho plnilo dobrovoľne:
 * parameter bol nepovinný, a keď ho volajúci nevyplnil, dotaz ticho siahol
 * naprieč organizáciami. Tak vznikol únik v `/api/chat` aj zápis posudku do
 * záznamu inej organizácie podľa `_id` (audit `docs/D90_audit_dotazov.md`).
 *
 * Funkcie, ktoré čítajú alebo zapisujú obsah organizácie, si organizáciu
 * vyžiadajú touto funkciou. Bez nej sa nerobí nič — ani „opatrne".
 *
 * Čistý modul bez databázy a bez Nextu: importujú ho aj skripty.
 */

/** Chýba organizácia — programátorská chyba, nie stav pre človeka. */
export class MissingTenantError extends Error {
  constructor(where: string) {
    super(`${where}: chýba companyCode — bez organizácie sa nečíta ani nezapisuje (D90)`)
    this.name = "MissingTenantError"
  }
}

/**
 * Vráti organizáciu, alebo vyhodí `MissingTenantError`.
 *
 * Kontroluje sa aj za behu, nielen typom: skripty v `scripts/` sú `.mjs`
 * a typovú kontrolu neprejdú. Prázdny reťazec je rovnaká chyba ako
 * `undefined` — podmienka `if (companyCode)` by ho pri budúcej úprave ľahko
 * ticho vynechala.
 */
export function requireCompanyCode(value: unknown, where: string): string {
  const code = typeof value === "string" ? value.trim() : ""
  if (!code) throw new MissingTenantError(where)
  return code
}
