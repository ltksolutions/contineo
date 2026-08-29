/**
 * audit.test.ts — stopa o správcovských zmenách (D51).
 *
 * Testuje sa `rozdiel()`: je to jediné miesto, kde sa rozhoduje, čo sa
 * o zmene zapíše — a chyba tu znamená buď zamlčanú zmenu, alebo tajomstvo
 * v audite.
 */

import { describe, it, expect } from "vitest"
import { rozdiel } from "../src/lib/audit"

describe("rozdiel dvoch stavov", () => {
  it("zapisuje len to, co sa naozaj zmenilo", () => {
    const r = rozdiel({ meno: "Jan", jazyk: "sk" }, { meno: "Jan", jazyk: "en" })
    expect(Object.keys(r)).toEqual(["jazyk"])
    expect(r.jazyk).toEqual({ z: "sk", na: "en" })
  })

  it("prazdny rozdiel je prazdny objekt", () => {
    expect(rozdiel({ a: 1 }, { a: 1 })).toEqual({})
    expect(rozdiel(null, null)).toEqual({})
  })

  it("pribudnute a odobrane pole je tiez zmena", () => {
    expect(rozdiel({}, { rola: "hr" })).toEqual({ rola: { z: null, na: "hr" } })
    expect(rozdiel({ rola: "hr" }, {})).toEqual({ rola: { z: "hr", na: null } })
  })

  it("zoznamy sa porovnavaju podla obsahu aj poradia", () => {
    expect(rozdiel({ g: ["a", "b"] }, { g: ["a", "b"] })).toEqual({})
    // Zmena poradia je zmena zapisanej hodnoty a nech je vidiet: falosny
    // zaznam navyse je mensia skoda nez zamlcana zmena.
    expect(Object.keys(rozdiel({ g: ["a", "b"] }, { g: ["b", "a"] }))).toEqual(["g"])
  })

  it("undefined a null su to iste, nie zmena", () => {
    // Inak by kazde ulozenie formulara hlasilo zmenu pola, ktore nikto nemal.
    expect(rozdiel({ x: undefined }, { x: null })).toEqual({})
  })

  it("tajomstvo sa nikdy nezapise, ani stare ani nove", () => {
    const r = rozdiel({ clientSecret: "stare" }, { clientSecret: "nove" })
    expect(r.clientSecret).toEqual({ na: "(zmenené)" })
    expect(JSON.stringify(r)).not.toContain("stare")
    expect(JSON.stringify(r)).not.toContain("nove")
  })

  it("tajomstvo sa rozpozna aj vnorene v nazve pola", () => {
    for (const pole of ["oauth.azure.clientSecret", "heslo", "apiToken", "TAJOMSTVO"]) {
      const r = rozdiel({ [pole]: "a" }, { [pole]: "b" })
      expect(JSON.stringify(r), pole).not.toContain("\"a\"")
    }
  })
})
