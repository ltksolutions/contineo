/**
 * documentHierarchy.test.ts — nadradené dokumenty (ADR-034, D219): sieť bez
 * cyklov, viac nadradených, predkovia od najbližších.
 */
import { describe, it, expect } from "vitest"
import { ancestorsOf, descendantsOf, parentsMapOf, parentsProblem, hierarchyRows } from "../src/lib/documentHierarchy"

const map = parentsMapOf([
  { documentId: "zakon" },
  { documentId: "stanovy", parentIds: ["zakon"] },
  { documentId: "rapp", parentIds: ["stanovy"] },
  { documentId: "sp", parentIds: ["stanovy"] },
  { documentId: "issf04", parentIds: ["rapp", "sp"] },
])

describe("hierarchia dokumentov", () => {
  it("predkovia od najbližších, každý raz aj pri dvoch cestách", () => {
    expect(ancestorsOf("issf04", map)).toEqual(["rapp", "sp", "stanovy", "zakon"])
    expect(ancestorsOf("zakon", map)).toEqual([])
  })

  it("potomkovia", () => {
    expect(descendantsOf("stanovy", map).sort()).toEqual(["issf04", "rapp", "sp"])
  })

  it("cyklus a sám sebe nadradený sa odmietne", () => {
    expect(parentsProblem("stanovy", ["stanovy"], map)).toBe("hierarchy.self")
    expect(parentsProblem("stanovy", ["issf04"], map)).toBe("hierarchy.cycle")
    expect(parentsProblem("issf04", ["zakon"], map)).toBeNull()
  })

  it("prehľad: dokument s dvoma nadradenými pod každým z nich", () => {
    const rows = hierarchyRows(["zakon", "stanovy", "rapp", "sp", "issf04"], map)
    expect(rows.map(r => `${"-".repeat(r.level)}${r.documentId}`)).toEqual(["zakon", "-stanovy", "--rapp", "---issf04", "--sp", "---issf04"])
    expect(rows.find(r => r.documentId === "issf04")?.otherParents).toEqual(["sp"])
  })

  it("cyklus v dátach nezacyklí", () => {
    const bad = parentsMapOf([{ documentId: "a", parentIds: ["b"] }, { documentId: "b", parentIds: ["a"] }])
    expect(ancestorsOf("a", bad)).toEqual(["b"])
  })
})
