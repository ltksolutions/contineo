/**
 * publicRoutes.ts — cesty prístupné bez prihlásenia.
 *
 * **Prečo samostatný súbor a nie konštanta v `middleware.ts`:** zoznam je
 * pravidlo, ktoré sa dá pokaziť ticho. Presne to sa aj stalo — `/api/cron/`
 * v ňom chýbala, takže middleware odmietol naplánovaný beh skôr, než sa
 * spustil, a **cron sa nikdy nevykonal**. Vercel neúspešný beh ticho zahodí,
 * takže to nebolo vidieť nikde: ani v aplikácii, ani v audite.
 *
 * V `proxy.ts` (do 2026-09-17 `middleware.ts`) sa to otestovať nedá — modul
 * ťahá `next-auth/jwt` a databázu. Tu je to čistá funkcia a má testy.
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

/**
 * Cesty, pri ktorých `proxy.ts` **neoveruje doménu** tenanta.
 *
 * Jediná je naplánovaný beh. Beží naprieč organizáciami (prehľad meškajúcich
 * pre všetkých tenantov) a z akej domény ho Vercel volá, nemáme overené —
 * keby to bola doména nasadenia (`*.vercel.app`), kontrola tenanta by ho
 * odmietla rovnako ticho, ako ho kedysi odmietala brána prihlásenia (viď
 * `/api/cron/` vyššie). Chránený je `CRON_SECRET`, nie doménou.
 *
 * Zoznam je zámerne samostatný, nie odvodený z `PUBLIC_PATHS`: prihlasovacia
 * stránka ani logá výnimku z kontroly domény nedostávajú — na cudzej doméne
 * nemajú čo hľadať.
 */
export const HOST_CHECK_EXEMPT = ["/api/cron/"] as const

export function isHostCheckExempt(pathname: string): boolean {
  return HOST_CHECK_EXEMPT.some(p => pathname.startsWith(p))
}
