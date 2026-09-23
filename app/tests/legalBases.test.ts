/**
 * legalBases.test.ts — číselník právnych základov (D92). Čisté pravidlá.
 */
import { describe, it, expect } from "vitest"
import {
  STANDARD_LEGAL_BASES, legalBasisOptions, findLegalBasisOption, newLegalBasisProblem, tidyLegalBasisItem,
} from "../src/lib/legalBases"
import { isLegalBasis } from "../src/lib/versionResponsibility"

const own = (key: string, extra: Record<string, unknown> = {}) => ({
  key, label: key, basis: "legitimate_interest" as const, reference: null,
  createdAt: new Date(), createdBy: "spravca@futbalsfz.sk", ...extra,
})

describe("štandardné položky", () => {
  it("každá má platnú kategóriu a zákonná povinnosť má odkaz", () => {
    expect(STANDARD_LEGAL_BASES.length).toBeGreaterThan(0)
    for (const i of STANDARD_LEGAL_BASES) {
      expect(isLegalBasis(i.basis), i.key).toBe(true)
      if (i.basis === "legal_obligation") expect(i.reference, i.key).toBeTruthy()
    }
  })

  it("kľúče sú jedinečné", () => {
    const keys = STANDARD_LEGAL_BASES.map(i => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe("ponuka organizácie", () => {
  it("bez nastavenia má organizácia všetky štandardné", () => {
    expect(legalBasisOptions(null).map(o => o.key)).toEqual(STANDARD_LEGAL_BASES.map(i => i.key))
  })

  it("skrytá štandardná a vyradená vlastná v ponuke nie sú", () => {
    const opts = legalBasisOptions({
      legalBasesHidden: ["bozp"],
      legalBases: [own("doping"), own("stara", { retiredAt: new Date() })],
    })
    const keys = opts.map(o => o.key)
    expect(keys).not.toContain("bozp")
    expect(keys).not.toContain("stara")
    expect(keys).toContain("doping")
    expect(opts.find(o => o.key === "doping")?.source).toBe("custom")
  })

  it("hľadá len v aktívnej ponuke", () => {
    expect(findLegalBasisOption({ legalBasesHidden: ["bozp"] }, "bozp")).toBeNull()
    expect(findLegalBasisOption(null, " bozp ")?.basis).toBe("legal_obligation")
  })
})

describe("nová vlastná položka", () => {
  it("kľúč v tvare kľúča, názov povinný", () => {
    expect(newLegalBasisProblem(null, { key: "Doping!", label: "x", basis: "legitimate_interest" })).toBe("legalBasis.badKey")
    expect(newLegalBasisProblem(null, { key: "doping", label: " ", basis: "legitimate_interest" })).toBe("legalBasis.labelRequired")
  })

  it("kľúč nesmie kolidovať ani so skrytou štandardnou, ani s vyradenou vlastnou", () => {
    expect(newLegalBasisProblem({ legalBasesHidden: ["bozp"] }, { key: "bozp", label: "x", basis: "legitimate_interest" }))
      .toBe("legalBasis.keyTaken")
    expect(newLegalBasisProblem({ legalBases: [own("stara", { retiredAt: new Date() })] }, { key: "stara", label: "x", basis: "legitimate_interest" }))
      .toBe("legalBasis.keyTaken")
  })

  it("zákonná povinnosť bez odkazu neprejde, súhlas nie je kategória", () => {
    expect(newLegalBasisProblem(null, { key: "doping", label: "Doping", basis: "legal_obligation" }))
      .toBe("legalBasis.referenceRequired")
    expect(newLegalBasisProblem(null, { key: "doping", label: "Doping", basis: "consent" }))
      .toBe("legalBasis.invalid")
    expect(newLegalBasisProblem(null, { key: "doping", label: "Doping", basis: "legal_obligation", reference: "zák. č. 440/2015 Z. z." }))
      .toBeNull()
  })

  it("uprace kľúč aj odkaz", () => {
    expect(tidyLegalBasisItem({ key: " Doping ", label: " Doping ", basis: "legitimate_interest", reference: "  " }))
      .toEqual({ key: "doping", label: "Doping", basis: "legitimate_interest", reference: null })
  })
})
