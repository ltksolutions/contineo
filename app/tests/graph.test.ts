/**
 * graph.test.ts — údaje z adresára (D52).
 *
 * Testuje sa to, čo rozhoduje o zápise: či sa doplní len chýbajúce a či sa
 * vôbec oplatí do Graphu ísť. Samotné volanie Graphu sa netestuje — je to
 * cudzie API a test, ktorý ho napodobní, overí len našu napodobeninu.
 */

import { describe, it, expect } from "vitest"
import { fullName } from "../src/lib/graph"
import { missingFromDirectory } from "../src/lib/persons"
import type { Person } from "../src/lib/persons"

function person(z: Partial<Person> = {}): Person {
  return {
    id: "p1",
    companyCode: "SFZ",
    email: "jan.letko@futbalsfz.sk",
    fullName: "Jan Letko",
    personType: "employee",
    status: "active",
    language: "sk",
    tracks: [],
    groups: [],
    roles: [],
    givenName: "Jan",
    surname: "Letko",
    department: "Legislativa",
    photoVersion: "abc",
    directorySyncedAt: new Date("2026-09-01"),
    ...z,
  } as Person
}

describe("cele meno z Graphu", () => {
  it("sklada sa z mena a priezviska", () => {
    expect(fullName({ givenName: "Jan", surname: "Letko" })).toBe("Jan Letko")
  })

  it("displayName je az druha volba", () => {
    // V niektorych adresaroch je displayName v tvare "Priezvisko, Meno (utvar)"
    // a to sa v zozname osob cita zle.
    expect(fullName({ givenName: "Jan", surname: "Letko", displayName: "Letko, Jan (LEG)" }))
      .toBe("Jan Letko")
    expect(fullName({ displayName: "Letko, Jan (LEG)" })).toBe("Letko, Jan (LEG)")
  })

  it("bez udajov nevrati prazdny retazec", () => {
    expect(fullName({})).toBeUndefined()
  })
})

describe("oplati sa ist do Graphu", () => {
  it("uz raz doplnena osoba nic nepotrebuje", () => {
    expect(missingFromDirectory(person())).toBe(false)
  })

  it("bez znamky sa ide do Graphu, aj ked je vsetko vyplnene (D88)", () => {
    expect(missingFromDirectory(person({ directorySyncedAt: undefined }))).toBe(true)
  })

  it("rucne doplnene meno uz nezastavi doplnenie z adresara (D88)", () => {
    // Pred D83 plnil givenName vyhradne Graph, takze "ma prazdny givenName"
    // fungovalo ako otazka "bol tu uz adresar?". Odkedy ho vyplna aj
    // personalista, ta otazka prestala platit: prva rucne zalozena osoba by sa
    // z adresara nedozvedela ani poziciu, ani mobil, ani pracovisko.
    const rucne = person({ givenName: "Jan", surname: "Letko", directorySyncedAt: undefined })
    expect(missingFromDirectory(rucne)).toBe(true)
  })

  it("chybajuci utvar ani fotka uz na volanie nestacia", () => {
    // Znamka hovori, ze adresar sme sa uz pytali. Ked utvar aj tak nedal,
    // dalsie volanie ho nedodá — len zaplati dve poziadavky za nic.
    expect(missingFromDirectory(person({ department: undefined }))).toBe(false)
    expect(missingFromDirectory(person({ photoVersion: undefined }))).toBe(false)
  })

  it("meno rovne adrese sa berie ako chybajuce", () => {
    // Tak vyzera osoba zalozena automaticky, ked meno nebolo odkial vziat.
    expect(missingFromDirectory(person({ fullName: "jan.letko@futbalsfz.sk" }))).toBe(true)
    expect(missingFromDirectory(person({ fullName: "Jan.Letko@futbalsfz.sk" }))).toBe(true)
  })

  it("neznama osoba sa berie ako chybajuca", () => {
    expect(missingFromDirectory(null)).toBe(true)
  })
})
