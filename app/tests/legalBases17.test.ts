/** legalBases17.test.ts — viac právnych základov pri znení (ADR-017, D115, D116). */
import { describe, it, expect } from "vitest"
import { basesOf, dominantBasis, legalBasesChoiceProblem } from "../src/lib/versionResponsibility"
import { objectionScope } from "../src/lib/objections"

describe("basesOf", () => {
  it("staré znenie s jedným základom je zoznam s jednou položkou", () => {
    expect(basesOf({ legalBasis: "legitimate_interest", legalBasisKey: "interna_smernica" }))
      .toEqual([{ basis: "legitimate_interest", key: "interna_smernica", label: null, reference: null }])
    expect(basesOf({})).toEqual([])
  })
  it("nový zoznam má prednosť", () => {
    const list = [{ basis: "legal_obligation" as const, key: "bozp" }, { basis: "legitimate_interest" as const, key: "eticky_kodex" }]
    expect(basesOf({ legalBases: list, legalBasis: "legal_obligation" })).toBe(list)
  })
})

describe("dominantBasis — zákonná povinnosť má prednosť", () => {
  it("kombinácia je zákonná povinnosť", () => {
    expect(dominantBasis([{ basis: "legitimate_interest" }, { basis: "legal_obligation" }])).toBe("legal_obligation")
  })
  it("len oprávnený záujem", () => {
    expect(dominantBasis([{ basis: "legitimate_interest" }])).toBe("legitimate_interest")
    expect(dominantBasis([])).toBeNull()
  })
})

describe("legalBasesChoiceProblem", () => {
  it("prázdny výber alebo neznámy kľúč neprejde", () => {
    expect(legalBasesChoiceProblem({ options: [], currentKeys: [], hasCurrent: false })).toBe("legalBasis.unknownKey")
    expect(legalBasesChoiceProblem({ options: [{ key: "bozp" }, null], currentKeys: [], hasCurrent: false })).toBe("legalBasis.unknownKey")
  })
  it("ten istý výber v inom poradí nie je zmena", () => {
    expect(legalBasesChoiceProblem({
      options: [{ key: "b" }, { key: "a" }], currentKeys: ["a", "b"], hasCurrent: true, reason: "x",
    })).toBe("legalBasis.noChange")
  })
  it("zmena už určeného výberu chce dôvod", () => {
    expect(legalBasesChoiceProblem({ options: [{ key: "a" }], currentKeys: ["a", "b"], hasCurrent: true })).toBe("legalBasis.reasonRequired")
    expect(legalBasesChoiceProblem({ options: [{ key: "a" }], currentKeys: [], hasCurrent: false })).toBeNull()
  })
})

describe("námietka pri kombinácii (D116)", () => {
  it("potvrdenie s rozhodujúcou zákonnou povinnosťou sa nezmaže", () => {
    // Pracovný poriadok má BOZP aj internú smernicu → rozhodujúca je zákonná
    // povinnosť (tak ju zapíše `dominantBasis()` do potvrdenia).
    const r = objectionScope([
      { documentId: "pp", versionId: "v1", legalBasis: dominantBasis([{ basis: "legal_obligation" }, { basis: "legitimate_interest" }]) },
      { documentId: "ek", versionId: "v2", legalBasis: "legitimate_interest" },
    ])
    expect([...r.versions]).toEqual(["ek|v2"])
  })
})
