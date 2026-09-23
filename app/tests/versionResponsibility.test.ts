/**
 * versionResponsibility.test.ts — zodpovedná osoba a právny základ (D91, O15).
 *
 * Čisté pravidlá bez databázy: kto smie určiť právny základ a čo musí mať.
 */
import { describe, it, expect } from "vitest"
import {
  canSetLegalBasis, isLegalBasis, legalBasisChoiceProblem, legalBasisProblem, responsibleChangeProblem,
  tidyReference, MAX_LEGAL_REFERENCE,
} from "../src/lib/versionResponsibility"

const GARANT = { personId: "p-garant", fullName: "Garant Predpisu", email: "garant@futbalsfz.sk" }

describe("kto smie určiť právny základ", () => {
  it("zodpovedná osoba svojho znenia áno", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-garant", isContentManager: false, responsible: GARANT, responsibleActive: true,
    })).toBe(true)
  })

  it("iný človek nie — ani keď je zodpovedný za iné predpisy", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-iny", isContentManager: false, responsible: GARANT, responsibleActive: true,
    })).toBe(false)
  })

  it("správca obsahu NEPREBÍJA aktívnu zodpovednú osobu", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-spravca", isContentManager: true, responsible: GARANT, responsibleActive: true,
    })).toBe(false)
  })

  it("správca obsahu ako náhradník, keď zodpovedná osoba odišla", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-spravca", isContentManager: true, responsible: GARANT, responsibleActive: false,
    })).toBe(true)
  })

  it("správca obsahu ako náhradník pri znení spred D91 bez zodpovednej osoby", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-spravca", isContentManager: true, responsible: null, responsibleActive: false,
    })).toBe(true)
  })

  it("odídená zodpovedná osoba už nesmie", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-garant", isContentManager: false, responsible: GARANT, responsibleActive: false,
    })).toBe(false)
  })

  it("bez zodpovednej osoby a bez roly nikto", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-iny", isContentManager: false, responsible: undefined, responsibleActive: false,
    })).toBe(false)
  })
})

describe("čo musí mať právny základ", () => {
  it("pozná len dve hodnoty — súhlas zámerne nie", () => {
    expect(isLegalBasis("legal_obligation")).toBe(true)
    expect(isLegalBasis("legitimate_interest")).toBe(true)
    expect(isLegalBasis("consent")).toBe(false)
    expect(legalBasisProblem({ basis: "consent" })).toBe("legalBasis.invalid")
  })

  it("zákonná povinnosť bez odkazu na predpis neprejde", () => {
    expect(legalBasisProblem({ basis: "legal_obligation", reference: "   " })).toBe("legalBasis.referenceRequired")
    expect(legalBasisProblem({ basis: "legal_obligation", reference: "§ 7 zák. 124/2006 Z. z." })).toBeNull()
  })

  it("oprávnený záujem odkaz nepotrebuje", () => {
    expect(legalBasisProblem({ basis: "legitimate_interest" })).toBeNull()
  })

  it("odkaz má strop", () => {
    expect(legalBasisProblem({ basis: "legitimate_interest", reference: "x".repeat(MAX_LEGAL_REFERENCE + 1) }))
      .toBe("legalBasis.referenceTooLong")
  })

  it("prvé určenie nepýta dôvod, zmena áno", () => {
    expect(legalBasisProblem({ basis: "legitimate_interest", current: null })).toBeNull()
    expect(legalBasisProblem({ basis: "legal_obligation", reference: "§ 7", current: "legitimate_interest" }))
      .toBe("legalBasis.reasonRequired")
    expect(legalBasisProblem({
      basis: "legal_obligation", reference: "§ 7", current: "legitimate_interest", reason: "novela zákona",
    })).toBeNull()
  })

  it("rovnaký základ s rovnakým odkazom nie je zmena", () => {
    expect(legalBasisProblem({
      basis: "legal_obligation", reference: " § 7 ", current: "legal_obligation", currentReference: "§ 7", reason: "x",
    })).toBe("legalBasis.noChange")
  })

  it("odkaz sa upraví, prázdny je žiadny", () => {
    expect(tidyReference("  § 7   ods. 3 ")).toBe("§ 7 ods. 3")
    expect(tidyReference("   ")).toBeNull()
    expect(tidyReference(undefined)).toBeNull()
  })
})

describe("zmena zodpovednej osoby", () => {
  it("osoba je povinná", () => {
    expect(responsibleChangeProblem({ personId: "", current: GARANT, reason: "odchod" }))
      .toBe("responsibility.personRequired")
  })

  it("tá istá osoba nie je zmena", () => {
    expect(responsibleChangeProblem({ personId: "p-garant", current: GARANT, reason: "x" }))
      .toBe("responsibility.samePerson")
  })

  it("dôvod je povinný — aj pri doplnení k zneniu spred D91", () => {
    expect(responsibleChangeProblem({ personId: "p-novy", current: null, reason: " " }))
      .toBe("responsibility.reasonRequired")
    expect(responsibleChangeProblem({ personId: "p-novy", current: GARANT, reason: "pôvodná osoba odišla" }))
      .toBeNull()
  })
})

describe("výber z číselníka (D92)", () => {
  it("bez položky z ponuky neprejde", () => {
    expect(legalBasisChoiceProblem({ option: null })).toBe("legalBasis.unknownKey")
  })
  it("prvý výber bez dôvodu, zmena s dôvodom, tá istá položka nie je zmena", () => {
    expect(legalBasisChoiceProblem({ option: { key: "bozp" } })).toBeNull()
    expect(legalBasisChoiceProblem({ option: { key: "bozp" }, current: "legitimate_interest", currentKey: "interna_smernica" }))
      .toBe("legalBasis.reasonRequired")
    expect(legalBasisChoiceProblem({ option: { key: "bozp" }, current: "legal_obligation", currentKey: "bozp", reason: "x" }))
      .toBe("legalBasis.noChange")
  })
  it("ručne zadaný základ spred číselníka sa dá nahradiť — so zdôvodnením", () => {
    expect(legalBasisChoiceProblem({ option: { key: "bozp" }, current: "legal_obligation", currentKey: null }))
      .toBe("legalBasis.reasonRequired")
    expect(legalBasisChoiceProblem({ option: { key: "bozp" }, current: "legal_obligation", currentKey: null, reason: "prechod na číselník" }))
      .toBeNull()
  })
})
