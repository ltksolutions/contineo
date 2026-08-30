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

function osoba(z: Partial<Person> = {}): Person {
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
    department: "Legislativa",
    photoVersion: "abc",
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
  it("kompletna osoba uz nic nepotrebuje", () => {
    expect(missingFromDirectory(osoba())).toBe(false)
  })

  it("chybajuce meno, utvar alebo fotka staci na jedno volanie", () => {
    expect(missingFromDirectory(osoba({ givenName: undefined }))).toBe(true)
    expect(missingFromDirectory(osoba({ department: undefined }))).toBe(true)
    expect(missingFromDirectory(osoba({ photoVersion: undefined }))).toBe(true)
  })

  it("meno rovne adrese sa berie ako chybajuce", () => {
    // Tak vyzera osoba zalozena automaticky, ked meno nebolo odkial vziat.
    expect(missingFromDirectory(osoba({ fullName: "jan.letko@futbalsfz.sk" }))).toBe(true)
    expect(missingFromDirectory(osoba({ fullName: "Jan.Letko@futbalsfz.sk" }))).toBe(true)
  })

  it("neznama osoba sa berie ako chybajuca", () => {
    expect(missingFromDirectory(null)).toBe(true)
  })
})
