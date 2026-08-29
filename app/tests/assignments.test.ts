/**
 * assignments.test.ts — pravidlá prideľovania (D37, D38, Fáza 9 rozsah B).
 *
 * Testuje sa to, čo môže prideliť niekomu niečo, čo nemal dostať, alebo
 * naopak neprideliť nikomu a tváriť sa, že je hotovo. Zápis do databázy sa
 * netestuje — testuje sa pravidlo, ktoré o zápise rozhoduje.
 */

import { describe, it, expect } from "vitest"
import { matchesAudience, audienceLabel } from "../src/lib/assignments"
import { normalizeKeys } from "../src/lib/persons"

const osoba = {
  email: "Jan.Letko@futbalsfz.sk",
  groups: ["rozhodcovia", "delegati"],
  tracks: ["zaklad-2026"],
}

describe("komu sa pridelenie tyka", () => {
  it("publikum vsetci znamena naozaj vsetkych", () => {
    expect(matchesAudience({}, { kind: "all" })).toBe(true)
  })

  it("skupina sedí podľa členstva", () => {
    expect(matchesAudience(osoba, { kind: "group", value: "rozhodcovia" })).toBe(true)
    expect(matchesAudience(osoba, { kind: "group", value: "statutari" })).toBe(false)
  })

  it("veľké a malé písmená sú tá istá skupina", () => {
    // Inak by „Rozhodcovia" a „rozhodcovia" boli dve skupiny a jedna
    // z nich by nedostala nič — a v zozname by vyzerali rovnako.
    expect(matchesAudience(osoba, { kind: "group", value: "Rozhodcovia" })).toBe(true)
    expect(matchesAudience({ groups: ["Rozhodcovia"] }, { kind: "group", value: "rozhodcovia" })).toBe(true)
  })

  it("medzery navyše nerozhodujú", () => {
    expect(matchesAudience(osoba, { kind: "group", value: "  rozhodcovia " })).toBe(true)
  })

  it("trasa je iná dimenzia než skupina", () => {
    // Zlúčiť ich by znamenalo, že jednorazovú úlohu nemožno prideliť bez
    // toho, aby vznikla umelá trasa (D38).
    expect(matchesAudience(osoba, { kind: "track", value: "zaklad-2026" })).toBe(true)
    expect(matchesAudience(osoba, { kind: "group", value: "zaklad-2026" })).toBe(false)
  })

  it("adresa sa porovnáva bez ohľadu na veľkosť písmen", () => {
    expect(matchesAudience(osoba, { kind: "person", value: "jan.letko@futbalsfz.sk" })).toBe(true)
  })

  it("prázdna hodnota nesedí nikomu", () => {
    // Prideliť „skupine bez mena" musí znamenať nikomu, nie všetkým.
    expect(matchesAudience(osoba, { kind: "group", value: "" })).toBe(false)
    expect(matchesAudience(osoba, { kind: "group" })).toBe(false)
    expect(matchesAudience(osoba, { kind: "person", value: "   " })).toBe(false)
  })

  it("neznámy druh publika nesedí nikomu", () => {
    // Nový druh, ktorý sa zabudne doplniť, má radšej neprideliť nikomu
    // než všetkým.
    expect(matchesAudience(osoba, { kind: "utvar" as never, value: "x" })).toBe(false)
  })

  it("osoba bez skupín neprepadne do žiadnej", () => {
    expect(matchesAudience({ email: "a@b.sk" }, { kind: "group", value: "rozhodcovia" })).toBe(false)
  })
})

describe("pomenovanie publika", () => {
  it("povie, o aký druh ide, nie len hodnotu", () => {
    expect(audienceLabel({ kind: "group", value: "rozhodcovia" })).toContain("skupina")
    expect(audienceLabel({ kind: "track", value: "zaklad" })).toContain("trasa")
    expect(audienceLabel({ kind: "all" })).toBe("všetci v organizácii")
  })
})

describe("normalizacia klucov", () => {
  it("zjednotí veľkosť písmen a zahodí prázdne", () => {
    expect(normalizeKeys([" Rozhodcovia ", "", "  "])).toEqual(["rozhodcovia"])
  })

  it("nezdvojí to isté zapísané inak", () => {
    expect(normalizeKeys(["Rozhodcovia", "rozhodcovia"])).toEqual(["rozhodcovia"])
  })

  it("z ničoho spraví prázdny zoznam, nie chybu", () => {
    expect(normalizeKeys(undefined)).toEqual([])
  })
})
