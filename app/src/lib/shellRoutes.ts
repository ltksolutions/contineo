/**
 * shellRoutes.ts — ktoré stránky už bežia v aplikačnom shelli.
 *
 * Shell je **opt-in**: `layout.tsx` sa nemení a stránka si `AppShell` vyžiada
 * sama. Lenže hlavička je spoločná a má vlastné menu — na stránke v shelli by
 * teda boli dve navigácie nad sebou. Preto tento zoznam: `Header` podľa neho
 * svoje menu skryje.
 *
 * Je to jedna tabuľka na jednom mieste zámerne. Keby si každý komponent
 * rozhodoval sám, jedna stránka by raz zostala s dvomi navigáciami a druhá
 * bez akejkoľvek.
 *
 * **Dva zoznamy, nie jeden.** `SHELL_ROUTES` je presná zhoda pre sekcie,
 * z ktorých je v shelli zatiaľ len úvodná stránka: `/library` áno, ale
 * `/library/new` a `/library/<id>` nie — prefix by im zobral menu v hlavičke
 * a nedal by im namiesto neho nič. `SHELL_SECTIONS` je pre sekcie presunuté
 * **celé** aj s podstránkami; tam je prefix presne to, čo treba, lebo inak by
 * detail dokumentu zostal bez akejkoľvek navigácie.
 *
 * Oba zoznamy rastú tak, ako sa stránky do shellu presúvajú. Keď v nich budú
 * všetky, menu v hlavičke zmizne úplne a tento súbor s ním.
 */

/** Sekcie, kde je v shelli len úvodná stránka. Presná zhoda. */
export const SHELL_ROUTES: string[] = ["/library"]

/** Sekcie presunuté celé — vrátane podstránok. Zhoda na prefix. */
export const SHELL_SECTIONS: string[] = ["/documents"]

export function isShellRoute(pathname: string): boolean {
  if (SHELL_ROUTES.includes(pathname)) return true
  // `/documents` aj `/documents/<id>`, ale nie `/documentsomething` —
  // hranicou je lomka, nie začiatok reťazca.
  return SHELL_SECTIONS.some(s => pathname === s || pathname.startsWith(s + "/"))
}
