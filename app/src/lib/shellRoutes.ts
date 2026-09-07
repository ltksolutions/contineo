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
 * **Zhoda je presná, nie na prefix.** `/library` je v shelli, ale
 * `/library/new` a `/library/<id>` zatiaľ nie — prefix by im zobral menu
 * v hlavičke a nedal by im namiesto neho nič. Zoznam rastie tak, ako sa
 * stránky do shellu presúvajú, a keď v ňom budú všetky, menu v hlavičke
 * zmizne úplne.
 */

export const SHELL_ROUTES: string[] = ["/library"]

export function isShellRoute(pathname: string): boolean {
  return SHELL_ROUTES.includes(pathname)
}
