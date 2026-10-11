import { describe, it, expect } from "vitest"
import { linkedChecks } from "../src/lib/complianceRequests"

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
