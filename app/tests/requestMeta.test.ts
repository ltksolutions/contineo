/**
 * requestMeta.test.ts — IP klienta do dôkazného záznamu.
 *
 * Ide o údaj, ktorý sa do záznamu zapíše raz a nikdy sa neopravuje (D24).
 * Zle prečítaná hlavička znamená, že všetky potvrdenia budú mať adresu
 * poslednej proxy — teda tú istú pre celú organizáciu — a nikto si toho
 * nevšimne, kým sa na záznam niekto nespýta.
 */

import { describe, it, expect } from "vitest"
import { clientIp } from "../src/lib/requestMeta"

/** Náhrada `Headers` — testujeme čítanie, nie implementáciu prehliadača. */
function headers(map: Record<string, string>) {
  return { get: (name: string) => map[name.toLowerCase()] ?? null }
}

describe("clientIp()", () => {
  it("z `x-forwarded-for` berie prvú adresu, nie poslednú", () => {
    // Prvá je pôvodný klient, ďalšie sú proxy. Posledná by bola adresa
    // Vercelu — rovnaká pre všetkých ľudí vo všetkých organizáciách.
    expect(clientIp(headers({ "x-forwarded-for": "89.173.10.4, 10.0.0.1, 10.0.0.2" })))
      .toBe("89.173.10.4")
  })

  it("obstrihne medzery okolo adresy", () => {
    expect(clientIp(headers({ "x-forwarded-for": "  89.173.10.4  " }))).toBe("89.173.10.4")
  })

  it("padá na `x-real-ip`, keď `x-forwarded-for` nie je", () => {
    expect(clientIp(headers({ "x-real-ip": "89.173.10.4" }))).toBe("89.173.10.4")
  })

  it("prázdna hlavička sa berie ako chýbajúca", () => {
    // Prázdny reťazec v zázname by vyzeral ako zapísaná hodnota. `null`
    // hovorí pravdu: adresa nebola k dispozícii.
    expect(clientIp(headers({ "x-forwarded-for": "" }))).toBeNull()
    expect(clientIp(headers({ "x-forwarded-for": "   " }))).toBeNull()
    expect(clientIp(headers({ "x-real-ip": "  " }))).toBeNull()
  })

  it("bez hlavičiek vráti null, nie prázdny reťazec", () => {
    expect(clientIp(headers({}))).toBeNull()
  })

  it("prázdna prvá položka nezhltne tú ďalšiu", () => {
    // `, 10.0.0.1` je pokazená hlavička. Vrátiť `10.0.0.1` by znamenalo
    // zapísať adresu proxy ako adresu človeka — radšej nič.
    expect(clientIp(headers({ "x-forwarded-for": ", 10.0.0.1" }))).toBeNull()
  })
})
