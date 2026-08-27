/**
 * visibility.test.ts — kto na ktorý dokument vidí (D32).
 *
 * Toto pravidlo rozhoduje o prístupe k interným smerniciam, takže sa testuje
 * podrobnejšie, než by sa pri jednej funkcii čakalo. Podstatné je, čo prístup
 * **neudeľuje**: príbuznosť v strome tenantov.
 */
import { describe, it, expect } from "vitest"
import { canSeeDocument } from "../src/lib/documents"

const person = { companyCode: "SsFZ" }

describe("canSeeDocument", () => {
  it("verejný dokument vidí každý", () => {
    expect(canSeeDocument(person, { accessLevel: "public", companyCode: "SFZ" })).toBe(true)
  })

  it("vlastný interný obsah tenanta vidí", () => {
    expect(canSeeDocument(person, { accessLevel: "internal", companyCode: "SsFZ" })).toBe(true)
  })

  it("cudzí interný obsah nevidí", () => {
    expect(canSeeDocument(person, { accessLevel: "internal", companyCode: "ZsFZ" })).toBe(false)
  })

  it("menovite zdieľaný obsah vidí", () => {
    expect(canSeeDocument(person, {
      accessLevel: "internal", companyCode: "SFZ", sharedWithCompanyCodes: ["SsFZ", "ZsFZ"],
    })).toBe(true)
  })

  it("zdieľanie s niekým iným mu prístup nedá", () => {
    expect(canSeeDocument(person, {
      accessLevel: "internal", companyCode: "SFZ", sharedWithCompanyCodes: ["ZsFZ"],
    })).toBe(false)
  })

  // Jadro rozhodnutia D32. Keby toto zlyhalo, personálna smernica centrály
  // by sa objavila brigádnikovi v dcérskej prevádzke — a nikto by sa to
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

  it("osoba bez companyCode nevidí nič interné", () => {
    expect(canSeeDocument({ companyCode: "" }, {
      accessLevel: "internal", companyCode: "SFZ",
    })).toBe(false)
  })

  it("chýbajúci accessLevel sa správa ako interný, nie ako verejný", () => {
    expect(canSeeDocument(person, { companyCode: "ZsFZ" })).toBe(false)
  })
})
