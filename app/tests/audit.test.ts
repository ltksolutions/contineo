/**
 * audit.test.ts — stopa o správcovských zmenách (D51).
 *
 * Testuje sa `rozdiel()`: je to jediné miesto, kde sa rozhoduje, čo sa
 * o zmene zapíše — a chyba tu znamená buď zamlčanú zmenu, alebo tajomstvo
 * v audite.
 */

import { describe, it, expect } from "vitest"
import { diff } from "../src/lib/audit"

describe("rozdiel dvoch stavov", () => {
  it("zapisuje len to, co sa naozaj zmenilo", () => {
    const r = diff({ meno: "Jan", jazyk: "sk" }, { meno: "Jan", jazyk: "en" })
    expect(Object.keys(r)).toEqual(["jazyk"])
    expect(r.jazyk).toEqual({ from: "sk", to: "en" })
  })

  it("prazdny rozdiel je prazdny objekt", () => {
    expect(diff({ a: 1 }, { a: 1 })).toEqual({})
    expect(diff(null, null)).toEqual({})
  })

  it("pribudnute a odobrane pole je tiez zmena", () => {
    expect(diff({}, { rola: "hr" })).toEqual({ rola: { from: null, to: "hr" } })
    expect(diff({ rola: "hr" }, {})).toEqual({ rola: { from: "hr", to: null } })
  })

  it("zoznamy sa porovnavaju podla obsahu aj poradia", () => {
    expect(diff({ g: ["a", "b"] }, { g: ["a", "b"] })).toEqual({})
    // Zmena poradia je zmena zapisanej hodnoty a nech je vidiet: falosny
    // zaznam navyse je mensia skoda nez zamlcana zmena.
    expect(Object.keys(diff({ g: ["a", "b"] }, { g: ["b", "a"] }))).toEqual(["g"])
  })

  it("undefined a null su to iste, nie zmena", () => {
    // Inak by kazde ulozenie formulara hlasilo zmenu pola, ktore nikto nemal.
    expect(diff({ x: undefined }, { x: null })).toEqual({})
  })

  it("tajomstvo sa nikdy nezapise, ani stare ani nove", () => {
    const r = diff({ clientSecret: "stare" }, { clientSecret: "nove" })
    expect(r.clientSecret).toEqual({ to: "(zmenené)" })
    expect(JSON.stringify(r)).not.toContain("stare")
    expect(JSON.stringify(r)).not.toContain("nove")
  })

  it("tajomstvo sa rozpozna aj vnorene v nazve pola", () => {
    for (const field of ["oauth.azure.clientSecret", "heslo", "apiToken", "TAJOMSTVO"]) {
      const r = diff({ [field]: "a" }, { [field]: "b" })
      expect(JSON.stringify(r), field).not.toContain("\"a\"")
    }
  })
})
