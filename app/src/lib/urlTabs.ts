/**
 * zalozky.ts — preklad starých kľúčov záložiek nastavenia organizácie.
 *
 * `utvary` sa premenovalo na `oddelenia`. Odkazy so starým kľúčom existujú
 * v záložkách prehliadača aj vo formulároch, ktoré si prehliadač vykreslil
 * pred nasadením — presmerovať ich by ich rozbilo, tak sa len preložia.
 *
 * Je to **jedna tabuľka na jednom mieste**: preklad potrebuje aj stránka pri
 * čítaní adresy, aj serverová akcia pri návrate. Dve kópie by sa rozišli
 * presne vtedy, keď sa pridá ďalšie premenovanie.
 *
 * Zmizne, keď staré odkazy prestanú chodiť.
 */
export const STARE_KLUCE: Record<string, string> = {
  utvary: "oddelenia",
}

export function preloz(kluc: string | undefined): string | undefined {
  if (!kluc) return undefined
  return STARE_KLUCE[kluc] ?? kluc
}
