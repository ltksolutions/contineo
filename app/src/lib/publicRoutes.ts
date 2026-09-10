/**
 * publicRoutes.ts — cesty prístupné bez prihlásenia.
 *
 * **Prečo samostatný súbor a nie konštanta v `middleware.ts`:** zoznam je
 * pravidlo, ktoré sa dá pokaziť ticho. Presne to sa aj stalo — `/api/cron/`
 * v ňom chýbala, takže middleware odmietol naplánovaný beh skôr, než sa
 * spustil, a **cron sa nikdy nevykonal**. Vercel neúspešný beh ticho zahodí,
 * takže to nebolo vidieť nikde: ani v aplikácii, ani v audite.
 *
 * V `middleware.ts` sa to otestovať nedá — modul ťahá `next-auth/jwt`
 * a beží v edge prostredí. Tu je to čistá funkcia a má testy.
 *
 * Zoznam je zámerne krátky a ku každej ceste patrí dôvod. Pravidlo je
 * „všetko okrem…", nie výpočet chráneného: nová stránka je tak chránená
 * automaticky.
 */

export const PUBLIC_PATHS = [
  "/sign-in",
  // Samotné prihlasovanie.
  "/api/auth",
  /*
   * Logá tenantov. Prihlasovacia stránka nesie logo organizácie a načítava ho
   * ďalšou požiadavkou, ktorá v tej chvíli ešte nie je prihlásená. Sú to
   * verejné značkové súbory, nie obsah noriem; jediné, čo prezradia, je že tá
   * organizácia tu má portál — a to prezradí už samotná doména.
   */
  "/tenants/",
  /** Nahraté logá. Ten istý dôvod ako `/tenants/`. */
  "/api/brand/",
  /*
   * Naplánované behy. **Nie je to diera, je to iná brána.**
   *
   * Vercel volá cron obyčajným HTTP dotazom s hlavičkou
   * `Authorization: Bearer <CRON_SECRET>` a nemá — ani nemôže mať — sedenie
   * prihláseného človeka. Route si autorizáciu robí sama a bez tajomstva
   * vracia 401, vrátane prípadu, keď premenná nie je nastavená vôbec.
   * Prepustiť cestu sem teda neznamená otvoriť ju; znamená to nechať
   * rozhodnúť tú bránu, ktorá vie, o čo ide.
   */
  "/api/cron/",
] as const

/** Je táto cesta prístupná bez prihlásenia? */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}
