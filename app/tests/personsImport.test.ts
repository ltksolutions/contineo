/**
 * personsImport.test.ts — z CSV riadka na osobu.
 *
 * Mapovanie hlavičiek je pravidlo, nie pomôcka: rozhoduje o tom, či sa stĺpec
 * „Útvar" naozaj zapíše ako útvar, alebo sa ticho stratí. A odkedy importuje
 * aj obrazovka, musí byť rovnaké na oboch miestach.
 */

import { describe, it, expect } from "vitest"
import { rowToPerson, csvToPersons, fieldValue, REASONS } from "../src/lib/personsImport"

describe("mapovanie hlaviciek", () => {
  it("rozpozná slovenské aj anglické názvy stĺpcov", () => {
    expect(fieldValue({ utvar: "Legislatíva" }, "department")).toBe("Legislatíva")
    expect(fieldValue({ department: "Legal" }, "department")).toBe("Legal")
    expect(fieldValue({ oddelenie: "Úsek" }, "department")).toBe("Úsek")
  })

  it("chýbajúci stĺpec dá prázdno, nie undefined v strede reťazca", () => {
    expect(fieldValue({}, "department")).toBe("")
  })
})

describe("riadok na osobu", () => {
  it("zoznamy sa rozdelia čiarkou, bodkočiarkou aj zvislou čiarou", () => {
    const o = rowToPerson({ skupiny: "rozhodcovia; delegati|statutari", trasy: "zaklad,druha" })
    expect(o.groups).toEqual(["rozhodcovia", "delegati", "statutari"])
    expect(o.tracks).toEqual(["zaklad", "druha"])
  })

  it("nevyplnený jazyk zostane nevyplnený", () => {
    // Inak by opakovaný import bez stĺpca jazyka prepol každého späť na
    // slovenčinu — a prejavilo by sa to až v e-maile, ktorý už niekomu odišiel.
    expect(rowToPerson({ email: "a@b.sk" }).language).toBeUndefined()
  })

  it("nevyplnené zoznamy zostanú nevyplnené, nie prázdne", () => {
    // `undefined` znamená „nemeň", prázdne pole znamená „zmaž".
    const o = rowToPerson({ email: "a@b.sk" })
    expect(o.groups).toBeUndefined()
    expect(o.tracks).toBeUndefined()
  })
})

describe("cely subor", () => {
  const CSV = "email;meno;útvar;skupiny\na@b.sk;Anna B;Legislatíva;rozhodcovia\nc@d.sk;Cyril D;;delegati\n"

  it("prečíta bodkočiarkou oddelený súbor z Excelu", () => {
    const people = csvToPersons(CSV)
    expect(people).toHaveLength(2)
    expect(people[0]).toMatchObject({ email: "a@b.sk", fullName: "Anna B", department: "Legislatíva" })
    expect(people[1].department).toBeUndefined()
  })

  it("organizácia sa prebije tou, kto import robí", () => {
    // Personalista zväzu nesmie importom založiť človeka do cudzej
    // organizácie (D32) — aj keby to bolo v súbore napísané.
    const csv = "email;meno;organizacia\na@b.sk;Anna B;CUDZI\n"
    expect(csvToPersons(csv, "SFZ")[0].companyCode).toBe("SFZ")
  })

  it("bez prebitia zostane, čo je v súbore", () => {
    const csv = "email;meno;organizacia\na@b.sk;Anna B;LTK\n"
    expect(csvToPersons(csv)[0].companyCode).toBe("LTK")
  })

  it("prázdny súbor dá prázdny zoznam, nie chybu", () => {
    expect(csvToPersons("")).toEqual([])
    expect(csvToPersons("email;meno\n")).toEqual([])
  })
})

describe("dovody odmietnutia", () => {
  it("strojový kľúč má vetu pre človeka", () => {
    // „missing-companyCode" v zozname chýb je informácia pre nás, nie pre
    // personalistu, ktorý má opraviť súbor.
    for (const key of ["invalid-email", "missing-companyCode", "missing-name", "duplicate-in-file"]) {
      expect(REASONS[key]).toBeTruthy()
      expect(REASONS[key]).not.toBe(key)
      // Veta, nie kľúč: `missing-companyCode` sa nedá opraviť v Exceli.
      expect(REASONS[key]).toMatch(/\s/)
    }
  })
})
