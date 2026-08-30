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

function p(id: string, name: string, parentId: string | null): Folder {
  return { companyCode: "SFZ", id, nazov: name, parentId, createdAt: new Date("2026-01-01"), createdBy: "test" }
}

const tree: Folder[] = [
  p("normy", "Normy", null),
  p("sutaz", "Sutazne", "normy"),
  p("disc", "Disciplinarne", "normy"),
  p("mladez", "Mladez", "sutaz"),
  p("interne", "Interne smernice", null),
]

describe("strom priecinkov", () => {
  it("deti su len priame podpriecinky", () => {
    expect(children(tree, "normy").map(x => x.id).sort()).toEqual(["disc", "sutaz"])
    expect(children(tree, null).map(x => x.id).sort()).toEqual(["interne", "normy"])
  })

  it("cesta ide od korena po vlastny priecinok", () => {
    expect(pathIdsTo(tree, "mladez")).toEqual(["normy", "sutaz", "mladez"])
  })

  it("nezaradeny dokument ma prazdnu cestu", () => {
    // Prazdna cesta znamena, ze ho ziadny filter na priecinok nenajde --
    // a to je spravne: nie je nikde.
    expect(pathIdsTo(tree, null)).toEqual([])
    expect(pathIdsTo(tree, "neexistuje")).toEqual([])
  })

  it("cesta sa nezacykli na pokazenych datach", () => {
    const broken: Folder[] = [p("a", "A", "b"), p("b", "B", "a")]
    expect(pathTo(broken, "a").length).toBeLessThanOrEqual(MAX_DEPTH + 2)
  })

  it("podstrom obsahuje aj sam seba", () => {
    expect([...subtree(tree, "sutaz")].sort()).toEqual(["mladez", "sutaz"])
  })

  it("hlbka sa pocita od jednotky", () => {
    expect(depth(tree, null)).toBe(0)
    expect(depth(tree, "normy")).toBe(1)
    expect(depth(tree, "mladez")).toBe(3)
  })

  it("splostenie da rodica pred deti", () => {
    const rows = flattenTree(tree)
    const where = (id: string) => rows.findIndex(r => r.priecinok.id === id)
    expect(rows).toHaveLength(tree.length)
    expect(where("normy")).toBeLessThan(where("sutaz"))
    expect(where("sutaz")).toBeLessThan(where("mladez"))
    expect(rows[where("mladez")].uroven).toBe(3)
  })
})

describe("presun priecinka", () => {
  it("do seba ani do vlastneho podpriecinka to nejde", () => {
    expect(canMove(tree, "normy", "normy")).not.toBeNull()
    expect(canMove(tree, "normy", "mladez")).not.toBeNull()
  })

  it("na koren a k surodencovi to ide", () => {
    expect(canMove(tree, "mladez", null)).toBeNull()
    expect(canMove(tree, "mladez", "disc")).toBeNull()
  })

  it("hlbsie nez povolene sa odmietne", () => {
    const deep: Folder[] = []
    let parent: string | null = null
    for (let i = 1; i <= MAX_DEPTH; i++) {
      deep.push(p("u" + i, "U" + i, parent))
      parent = "u" + i
    }
    deep.push(p("x", "X", null))
    expect(canMove(deep, "x", "u" + MAX_DEPTH)).not.toBeNull()
    expect(canMove(deep, "x", "u" + (MAX_DEPTH - 1))).toBeNull()
  })
})

describe("poradie priecinkov (D60)", () => {
  function pp(id: string, name: string, parentId: string | null, order?: number): Folder {
    return {
      companyCode: "SFZ", id, nazov: name, parentId, poradie: order,
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
