/**
 * priecinky.test.ts — virtuálne priečinky knižnice (D56).
 *
 * Tvar je zámerne ten istý ako pri útvaroch, tak sa testuje to isté: strom,
 * cesta, presuny. Duplicita testov je tu na mieste — sú to dve nezávislé
 * štruktúry a keby sa jedna pokazila, druhá by o tom nevedela.
 */

import { describe, it, expect } from "vitest"
import {
  children, pathTo, pathIdsTo, subtree, depth, canMove, flattenTree, MAX_DEPTH,
  type Folder,
} from "../src/lib/folders"

function p(id: string, nazov: string, parentId: string | null): Folder {
  return { companyCode: "SFZ", id, nazov, parentId, createdAt: new Date("2026-01-01"), createdBy: "test" }
}

const strom: Folder[] = [
  p("normy", "Normy", null),
  p("sutaz", "Sutazne", "normy"),
  p("disc", "Disciplinarne", "normy"),
  p("mladez", "Mladez", "sutaz"),
  p("interne", "Interne smernice", null),
]

describe("strom priecinkov", () => {
  it("deti su len priame podpriecinky", () => {
    expect(children(strom, "normy").map(x => x.id).sort()).toEqual(["disc", "sutaz"])
    expect(children(strom, null).map(x => x.id).sort()).toEqual(["interne", "normy"])
  })

  it("cesta ide od korena po vlastny priecinok", () => {
    expect(pathIdsTo(strom, "mladez")).toEqual(["normy", "sutaz", "mladez"])
  })

  it("nezaradeny dokument ma prazdnu cestu", () => {
    // Prazdna cesta znamena, ze ho ziadny filter na priecinok nenajde --
    // a to je spravne: nie je nikde.
    expect(pathIdsTo(strom, null)).toEqual([])
    expect(pathIdsTo(strom, "neexistuje")).toEqual([])
  })

  it("cesta sa nezacykli na pokazenych datach", () => {
    const zle: Folder[] = [p("a", "A", "b"), p("b", "B", "a")]
    expect(pathTo(zle, "a").length).toBeLessThanOrEqual(MAX_DEPTH + 2)
  })

  it("podstrom obsahuje aj sam seba", () => {
    expect([...subtree(strom, "sutaz")].sort()).toEqual(["mladez", "sutaz"])
  })

  it("hlbka sa pocita od jednotky", () => {
    expect(depth(strom, null)).toBe(0)
    expect(depth(strom, "normy")).toBe(1)
    expect(depth(strom, "mladez")).toBe(3)
  })

  it("splostenie da rodica pred deti", () => {
    const riadky = flattenTree(strom)
    const kde = (id: string) => riadky.findIndex(r => r.priecinok.id === id)
    expect(riadky).toHaveLength(strom.length)
    expect(kde("normy")).toBeLessThan(kde("sutaz"))
    expect(kde("sutaz")).toBeLessThan(kde("mladez"))
    expect(riadky[kde("mladez")].uroven).toBe(3)
  })
})

describe("presun priecinka", () => {
  it("do seba ani do vlastneho podpriecinka to nejde", () => {
    expect(canMove(strom, "normy", "normy")).not.toBeNull()
    expect(canMove(strom, "normy", "mladez")).not.toBeNull()
  })

  it("na koren a k surodencovi to ide", () => {
    expect(canMove(strom, "mladez", null)).toBeNull()
    expect(canMove(strom, "mladez", "disc")).toBeNull()
  })

  it("hlbsie nez povolene sa odmietne", () => {
    const hlboky: Folder[] = []
    let rodic: string | null = null
    for (let i = 1; i <= MAX_DEPTH; i++) {
      hlboky.push(p("u" + i, "U" + i, rodic))
      rodic = "u" + i
    }
    hlboky.push(p("x", "X", null))
    expect(canMove(hlboky, "x", "u" + MAX_DEPTH)).not.toBeNull()
    expect(canMove(hlboky, "x", "u" + (MAX_DEPTH - 1))).toBeNull()
  })
})

describe("poradie priecinkov (D60)", () => {
  function pp(id: string, nazov: string, parentId: string | null, poradie?: number): Folder {
    return {
      companyCode: "SFZ", id, nazov, parentId, poradie,
      createdAt: new Date("2026-01-01"), createdBy: "test",
    }
  }

  it("bez urceneho poradia rozhoduje nazov", () => {
    const v = [pp("i", "Interne", null), pp("n", "Normy", null)]
    expect(children(v, null).map(x => x.id)).toEqual(["i", "n"])
  })

  it("urcene poradie prebije abecedu", () => {
    // Priecinky su usporiadanie, ktore si niekto premyslel: Normy pred
    // Internymi smernicami, nie naopak preto, ze I je pred N.
    const v = [pp("i", "Interne", null, 1), pp("n", "Normy", null, 0)]
    expect(children(v, null).map(x => x.id)).toEqual(["n", "i"])
  })

  it("kto ma poradie, stoji pred tymi bez neho", () => {
    const v = [pp("a", "Alfa", null), pp("z", "Zeta", null, 0)]
    expect(children(v, null).map(x => x.id)).toEqual(["z", "a"])
  })

  it("poradie plati len v ramci jednej urovne", () => {
    const v = [
      pp("k", "Koreň", null, 0),
      pp("d1", "Dieťa A", "k", 1),
      pp("d2", "Dieťa B", "k", 0),
    ]
    expect(children(v, "k").map(x => x.id)).toEqual(["d2", "d1"])
  })
})
