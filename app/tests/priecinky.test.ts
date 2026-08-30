/**
 * priecinky.test.ts — virtuálne priečinky knižnice (D56).
 *
 * Tvar je zámerne ten istý ako pri útvaroch, tak sa testuje to isté: strom,
 * cesta, presuny. Duplicita testov je tu na mieste — sú to dve nezávislé
 * štruktúry a keby sa jedna pokazila, druhá by o tom nevedela.
 */

import { describe, it, expect } from "vitest"
import {
  deti, cesta, cestaIds, podstrom, hlbka, smieSaPresunut, splostiStrom, MAX_HLBKA,
  type Priecinok,
} from "../src/lib/priecinky"

function p(id: string, nazov: string, parentId: string | null): Priecinok {
  return { companyCode: "SFZ", id, nazov, parentId, createdAt: new Date("2026-01-01"), createdBy: "test" }
}

const strom: Priecinok[] = [
  p("normy", "Normy", null),
  p("sutaz", "Sutazne", "normy"),
  p("disc", "Disciplinarne", "normy"),
  p("mladez", "Mladez", "sutaz"),
  p("interne", "Interne smernice", null),
]

describe("strom priecinkov", () => {
  it("deti su len priame podpriecinky", () => {
    expect(deti(strom, "normy").map(x => x.id).sort()).toEqual(["disc", "sutaz"])
    expect(deti(strom, null).map(x => x.id).sort()).toEqual(["interne", "normy"])
  })

  it("cesta ide od korena po vlastny priecinok", () => {
    expect(cestaIds(strom, "mladez")).toEqual(["normy", "sutaz", "mladez"])
  })

  it("nezaradeny dokument ma prazdnu cestu", () => {
    // Prazdna cesta znamena, ze ho ziadny filter na priecinok nenajde --
    // a to je spravne: nie je nikde.
    expect(cestaIds(strom, null)).toEqual([])
    expect(cestaIds(strom, "neexistuje")).toEqual([])
  })

  it("cesta sa nezacykli na pokazenych datach", () => {
    const zle: Priecinok[] = [p("a", "A", "b"), p("b", "B", "a")]
    expect(cesta(zle, "a").length).toBeLessThanOrEqual(MAX_HLBKA + 2)
  })

  it("podstrom obsahuje aj sam seba", () => {
    expect([...podstrom(strom, "sutaz")].sort()).toEqual(["mladez", "sutaz"])
  })

  it("hlbka sa pocita od jednotky", () => {
    expect(hlbka(strom, null)).toBe(0)
    expect(hlbka(strom, "normy")).toBe(1)
    expect(hlbka(strom, "mladez")).toBe(3)
  })

  it("splostenie da rodica pred deti", () => {
    const riadky = splostiStrom(strom)
    const kde = (id: string) => riadky.findIndex(r => r.priecinok.id === id)
    expect(riadky).toHaveLength(strom.length)
    expect(kde("normy")).toBeLessThan(kde("sutaz"))
    expect(kde("sutaz")).toBeLessThan(kde("mladez"))
    expect(riadky[kde("mladez")].uroven).toBe(3)
  })
})

describe("presun priecinka", () => {
  it("do seba ani do vlastneho podpriecinka to nejde", () => {
    expect(smieSaPresunut(strom, "normy", "normy")).not.toBeNull()
    expect(smieSaPresunut(strom, "normy", "mladez")).not.toBeNull()
  })

  it("na koren a k surodencovi to ide", () => {
    expect(smieSaPresunut(strom, "mladez", null)).toBeNull()
    expect(smieSaPresunut(strom, "mladez", "disc")).toBeNull()
  })

  it("hlbsie nez povolene sa odmietne", () => {
    const hlboky: Priecinok[] = []
    let rodic: string | null = null
    for (let i = 1; i <= MAX_HLBKA; i++) {
      hlboky.push(p("u" + i, "U" + i, rodic))
      rodic = "u" + i
    }
    hlboky.push(p("x", "X", null))
    expect(smieSaPresunut(hlboky, "x", "u" + MAX_HLBKA)).not.toBeNull()
    expect(smieSaPresunut(hlboky, "x", "u" + (MAX_HLBKA - 1))).toBeNull()
  })
})
