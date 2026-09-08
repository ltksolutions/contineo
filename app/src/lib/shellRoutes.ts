/**
 * shellRoutes.ts — ktoré obrazovky **nemajú** aplikačný shell.
 *
 * Otočený zoznam, a to je celý zmysel zmeny. Kým bol shell opt-in, bol tu
 * zoznam obrazoviek, ktoré ho majú — a hlavička podľa neho skrývala svoje
 * menu, aby nad shellom nestála druhá navigácia. Ten medzistav bol horší
 * než oba konce: polovica systému mala navigáciu v hlavičke, polovica pod
 * ňou, s iným poradím položiek, iným vzhľadom aktívnej položky a iným
 * zarovnaním obsahu.
 *
 * Dnes je shell na každej prihlásenej obrazovke a hlavička navigáciu obsahu
 * nevykresľuje vôbec. Zoznam preto pomenúva **výnimky**, ktorých je málo a
 * budú pribúdať pomaly — celoobrazovkové čítanie alebo tlačová podoba by boli
 * ďalšie. Vymenovať výnimky je lacnejšie než vymenovať pravidlo.
 */

/**
 * Obrazovky bez shellu, vrátane podstránok.
 *
 * Prihlasovacia obrazovka: navigácia obsahu by na nej viedla na miesta, kam
 * sa neprihlásený človek nedostane.
 */
export const WITHOUT_SHELL: string[] = ["/sign-in"]

/** Hranicou je lomka, nie začiatok reťazca — inak by `/sign-inx` bol výnimka. */
export function isShellRoute(pathname: string): boolean {
  return !WITHOUT_SHELL.some(s => pathname === s || pathname.startsWith(s + "/"))
}
