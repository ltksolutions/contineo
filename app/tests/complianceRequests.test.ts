import { describe, it, expect } from "vitest"
import { linkedChecks, hierarchyRequestRows } from "../src/lib/complianceRequests"
import { parentsMapOf } from "../src/lib/documentHierarchy"

const MANUALS = ["m0", "m1"]
const NORMS = ["rapp", "sp", "dp"]

describe("čo skontrolovať pri novom znení (ADR-032, D200)", () => {
  it("nová norma → všetky dokumenty, ktoré sa proti nej kontrolujú, proti ich normám", () => {
    const links = MANUALS.map(subjectId => ({ subjectId, referenceIds: NORMS }))
    expect(linkedChecks("rapp", links, [])).toEqual({ subjectIds: MANUALS, referenceIds: NORMS })
  })
  it("nový kontrolovaný dokument → on sám proti svojim normám", () => {
    const links = MANUALS.map(subjectId => ({ subjectId, referenceIds: NORMS }))
    expect(linkedChecks("m1", links, [])).toEqual({ subjectIds: ["m1"], referenceIds: NORMS })
  })
  it("história behov sa počíta tiež; kontrolovaný dokument nie je zároveň normou", () => {
    const history = [{ subjectIds: ["rozpis"], referenceIds: ["sp", "m0"] }]
    const r = linkedChecks("sp", [{ subjectId: "m0", referenceIds: ["sp"] }], history)
    expect(r.subjectIds.sort()).toEqual(["m0", "rozpis"])
    expect(r.referenceIds).toEqual(["sp"])
  })
  it("nič neprepojené → prázdne", () => {
    expect(linkedChecks("volebny", [{ subjectId: "m0", referenceIds: ["sp"] }], [])).toEqual({ subjectIds: [], referenceIds: [] })
  })
})

describe("nové znenie, ktoré je výsledkom kontroly", () => {
  it("dokument aktuálny od kontroly sa sám nekontroluje; normy jeho väzieb sa nepýtajú", () => {
    const links = [{ subjectId: "m1", referenceIds: ["rapp", "sp"] }]
    expect(linkedChecks("m1", links, [], true)).toEqual({ subjectIds: [], referenceIds: [] })
  })
  it("ak je zároveň normou iných, ich kontrola ostáva", () => {
    const links = [{ subjectId: "m1", referenceIds: ["rapp"] }, { subjectId: "rozpis", referenceIds: ["m1"] }]
    expect(linkedChecks("m1", links, [], true)).toEqual({ subjectIds: ["rozpis"], referenceIds: ["m1"] })
  })
})

describe("požiadavka z hierarchie (D248): len priamo podradené", () => {
  const map = parentsMapOf([
    { documentId: "zakon" },
    { documentId: "stanovy", parentIds: ["zakon"] },
    { documentId: "rapp", parentIds: ["stanovy"] },
    { documentId: "sp", parentIds: ["stanovy"] },
    { documentId: "issf04", parentIds: ["rapp", "sp"] },
  ])
  const binding = new Set(["zakon", "stanovy", "rapp", "sp"])

  it("nový zákon: kontrolujú sa Stanovy, nie celá vetva", () => {
    const r = linkedChecks("zakon", hierarchyRequestRows("zakon", map, binding), [])
    expect(r).toEqual({ subjectIds: ["stanovy"], referenceIds: ["zakon"] })
  })

  it("nové Stanovy: samy proti zákonu a poriadky proti svojim predkom, manuál nie", () => {
    const r = linkedChecks("stanovy", hierarchyRequestRows("stanovy", map, binding), [])
    expect(r.subjectIds.sort()).toEqual(["rapp", "sp", "stanovy"])
    expect(r.subjectIds).not.toContain("issf04")
  })
})
