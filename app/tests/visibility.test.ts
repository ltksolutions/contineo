/**
 * visibility.test.ts — kto na ktorý dokument vidí (D90, D32).
 *
 * Toto pravidlo rozhoduje o prístupe k interným smerniciam, takže sa testuje
 * podrobnejšie, než by sa pri jednej funkcii čakalo. Podstatné je, čo prístup
 * **neudeľuje**: príbuznosť v strome tenantov, verejnosť dokumentu inej
 * organizácie ani (zrušené) menovité zdieľanie. Tenanti sú oddelení galvanicky.
 */
import { describe, it, expect } from "vitest"
import { canSeeDocument } from "../src/lib/documents"

const person = { companyCode: "SsFZ" }

describe("canSeeDocument", () => {
  it("vlastný interný obsah organizácie vidí", () => {
    expect(canSeeDocument(person, { accessLevel: "internal", companyCode: "SsFZ" })).toBe(true)
  })

  it("vlastný verejný obsah organizácie vidí", () => {
    expect(canSeeDocument(person, { accessLevel: "public", companyCode: "SsFZ" })).toBe(true)
  })

  it("cudzí interný obsah nevidí", () => {
    expect(canSeeDocument(person, { accessLevel: "internal", companyCode: "ZsFZ" })).toBe(false)
  })

  // Jadro D90. Do 2026-09-17 tu bolo „verejný dokument vidí každý" — osoba
  // z inej organizácie otvorila verejnú normu SFZ, keď poznala jej
  // identifikátor. `public` znamená verejný v kanáloch vlastnej organizácie.
  it("CUDZÍ VEREJNÝ DOKUMENT NEVIDÍ — verejnosť neprekračuje hranicu organizácie", () => {
    expect(canSeeDocument(person, { accessLevel: "public", companyCode: "SFZ" })).toBe(false)
  })

  // Menovité zdieľanie bolo zrušené (D90). Keby sa pole v dátach niekedy
  // objavilo, nesmie nič otvoriť — funkcia ho zámerne nečíta.
  it("ani pole `sharedWithCompanyCodes` v dátach prístup nedá", () => {
    const doc = { accessLevel: "internal", companyCode: "SFZ", sharedWithCompanyCodes: ["SsFZ"] }
    expect(canSeeDocument(person, doc as never)).toBe(false)
  })

  // D32 platí ďalej. Keby toto zlyhalo, personálna smernica centrály by sa
  // objavila brigádnikovi v dcérskej prevádzke — a nikto by sa to
  // nedozvedel, lebo taká chyba je tichá.
  it("HIERARCHIA NEUDEĽUJE PRÍSTUP — nadradený tenant nestačí", () => {
    expect(canSeeDocument({ companyCode: "SsFZ" }, {
      accessLevel: "internal", companyCode: "SFZ",
    })).toBe(false)
  })

  it("ani opačným smerom — nadradený nevidí obsah podriadeného", () => {
    expect(canSeeDocument({ companyCode: "SFZ" }, {
      accessLevel: "internal", companyCode: "SsFZ",
    })).toBe(false)
  })

  it("osoba bez companyCode nevidí nič — ani verejné", () => {
    expect(canSeeDocument({ companyCode: "" }, { accessLevel: "public", companyCode: "SFZ" })).toBe(false)
  })

  it("dokument bez companyCode nevidí nikto", () => {
    expect(canSeeDocument(person, { accessLevel: "public" })).toBe(false)
  })
})
