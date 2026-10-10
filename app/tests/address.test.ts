/**
 * address.test.ts — sídlo po častiach (10. 10. 2026): skladanie riadku,
 * rozloženie starého riadku pri migrácii a tvar PSČ.
 */

import { describe, it, expect } from "vitest"
import { addressParts, formatAddress, normalizePostalCode, parseAddress } from "../src/lib/address"

describe("sídlo", () => {
  it("riadok sa skladá z častí", () => {
    expect(formatAddress({ street: "Tomášikova", streetNumber: "30C", postalCode: "821 01", city: "Bratislava" }))
      .toBe("Tomášikova 30C, 821 01 Bratislava")
  })

  it("chýbajúce časti sa vynechajú aj s čiarkou", () => {
    expect(formatAddress({ street: "Hlavná", streetNumber: "1" })).toBe("Hlavná 1")
    expect(formatAddress({ postalCode: "821 01", city: "Bratislava" })).toBe("821 01 Bratislava")
    expect(formatAddress({})).toBe("")
    expect(formatAddress(null)).toBe("")
  })

  it("organizácia pred migráciou: starý riadok sa rozloží a zloží rovnako", () => {
    const legacy = { address: "Tomášikova 30C, 821 01 Bratislava" }
    expect(addressParts(legacy)).toEqual({ street: "Tomášikova", streetNumber: "30C", postalCode: "821 01", city: "Bratislava" })
    expect(formatAddress(legacy)).toBe("Tomášikova 30C, 821 01 Bratislava")
  })

  it("časti majú prednosť pred starým riadkom", () => {
    expect(formatAddress({ address: "Trnavská cesta 100, 821 01 Bratislava", street: "Tomášikova", streetNumber: "30C", postalCode: "821 01", city: "Bratislava" }))
      .toBe("Tomášikova 30C, 821 01 Bratislava")
  })

  it("rozloženie zvládne viacslovnú ulicu, číslo s lomkou a PSČ bez medzery", () => {
    expect(parseAddress("Trnavská cesta 100/A, 82101 Bratislava - Ružinov"))
      .toEqual({ street: "Trnavská cesta", streetNumber: "100/A", postalCode: "821 01", city: "Bratislava - Ružinov" })
  })

  it("nerozpoznaný riadok ostane celý v ulici — nič sa nestratí", () => {
    expect(parseAddress("Obecný úrad")).toEqual({ street: "Obecný úrad" })
  })

  it("PSČ: 5 číslic, tvar „821 01“", () => {
    expect(normalizePostalCode("82101")).toBe("821 01")
    expect(normalizePostalCode("821 01")).toBe("821 01")
    expect(normalizePostalCode("8210")).toBeNull()
    expect(normalizePostalCode("SK-821")).toBeNull()
  })
})
