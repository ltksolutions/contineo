/**
 * requestMeta.ts — údaje o požiadavke, ktoré vstupujú do dôkazného záznamu.
 *
 * Existuje samostatne, lebo potvrdenie dokumentu vzniká **dvomi cestami**:
 * serverovou akciou z formulára (čítanie hlavičiek cez `headers()`) a starším
 * `POST /api/acknowledgements` (hlavičky z `Request`). Obe musia zapísať tú
 * istú IP tým istým spôsobom — dve rôzne čítania tej istej hlavičky by
 * znamenali dva rôzne tvary údaja v jednej kolekcii a pri audite by sa
 * nedalo povedať, ktorý je ten správny.
 *
 * Je to čistá funkcia nad rozhraním `Headers`, takže sa dá otestovať bez
 * servera aj bez požiadavky.
 */

/** Len to, čo z `Headers` naozaj potrebujeme — kvôli testom. */
export interface HeaderSource {
  get(name: string): string | null
}

/**
 * Adresa klienta spoza reverznej proxy.
 *
 * Prvá položka `x-forwarded-for` je pôvodný klient, ďalšie sú proxy, ktorými
 * požiadavka prešla. Berie sa teda **prvá**, nie posledná: posledná je adresa
 * poslednej proxy, čo je pri Verceli vždy tá istá hodnota pre všetkých ľudí.
 *
 * `null` pri chýbajúcej hlavičke, nie prázdny reťazec: v zázname má byť
 * vidieť rozdiel medzi „adresa nebola k dispozícii" a „adresa je prázdna".
 */
export function clientIp(headers: HeaderSource): string | null {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0].trim()
    if (first) return first
  }
  const real = headers.get("x-real-ip")?.trim()
  return real ? real : null
}
