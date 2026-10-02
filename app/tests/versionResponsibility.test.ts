/**
 * versionResponsibility.test.ts — zodpovedná osoba a právny základ (D91, O15).
 *
 * Čisté pravidlá bez databázy: kto smie určiť právny základ a čo musí mať.
 */
import { describe, it, expect } from "vitest"
import {
  canSetLegalBasis, isLegalBasis, legalBasisChoiceProblem, legalBasisProblem, responsibleChangeProblem,
  tidyReference, MAX_LEGAL_REFERENCE, legalBasisFields, sameBasisKeys, legalBasisFromDraft, versionBasisTasks,
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

  it("správca obsahu smie aj pri aktívnej zodpovednej osobe (D155)", () => {
    expect(canSetLegalBasis({
      actorPersonId: "p-spravca", isContentManager: true, responsible: GARANT, responsibleActive: true,
    })).toBe(true)
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

describe("polia znenia z vybraných základov (ADR-017)", () => {
  const BOZP = { basis: "legal_obligation" as const, key: "bozp", label: "BOZP", reference: "§ 7 zákona č. 124/2006 Z. z." }
  const SMERNICA = { basis: "legitimate_interest" as const, key: "interna_smernica", label: "Interná smernica", reference: null }

  it("zákonná povinnosť má prednosť, názvy a kľúče sa spoja v poradí výberu", () => {
    const f = legalBasisFields([SMERNICA, BOZP])
    expect(f.legalBasis).toBe("legal_obligation")
    expect(f.legalBasisKey).toBe("interna_smernica,bozp")
    expect(f.legalBasisLabel).toBe("Interná smernica + BOZP")
    expect(f.legalBasisReference).toBe("§ 7 zákona č. 124/2006 Z. z.")
    expect(f.legalBases).toHaveLength(2)
  })

  it("bez odkazu je odkaz null, nie prázdny reťazec", () => {
    expect(legalBasisFields([SMERNICA]).legalBasisReference).toBeNull()
  })

  it("rovnaký výber v inom poradí je ten istý výber", () => {
    expect(sameBasisKeys(["bozp", "interna_smernica"], ["interna_smernica", "bozp"])).toBe(true)
    expect(sameBasisKeys(["bozp"], ["bozp", "interna_smernica"])).toBe(false)
  })
})

describe("prenos základu z prípravy do znenia (ADR-023, D139)", () => {
  const AT = new Date("2026-09-20T08:00:00Z")
  const BOZP = { basis: "legal_obligation" as const, key: "bozp", label: "BOZP", reference: "§ 7 zákona č. 124/2006 Z. z." }
  const SMERNICA = { basis: "legitimate_interest" as const, key: "interna_smernica", label: "Interná smernica", reference: null }

  it("bez určenia v príprave sa neprenáša nič — základ sa určí po zverejnení", () => {
    expect(legalBasisFromDraft(null)).toBeNull()
    expect(legalBasisFromDraft(undefined)).toBeNull()
    expect(legalBasisFromDraft({ entries: [], at: AT, by: "g@futbalsfz.sk" })).toBeNull()
  })

  it("znenie dostane zoznam, rozhodujúci druh a históriu s tým, kto a kedy určil", () => {
    const v = legalBasisFromDraft({ entries: [SMERNICA, BOZP], at: AT, by: "garant@futbalsfz.sk" })!
    expect(v.legalBasis).toBe("legal_obligation")
    expect(v.legalBases).toHaveLength(2)
    expect(v.legalBasisReference).toBe("§ 7 zákona č. 124/2006 Z. z.")
    expect(v.legalBasisChanges).toEqual([{
      at: AT, by: "garant@futbalsfz.sk",
      from: null, fromReference: null, fromKey: null,
      to: "legal_obligation", toReference: "§ 7 zákona č. 124/2006 Z. z.",
      toKey: "interna_smernica,bozp", toLabel: "Interná smernica + BOZP",
      inPreparation: true,
    }])
  })

  it("bez odkazu pole odkazu v znení vôbec nie je — nie null", () => {
    const v = legalBasisFromDraft({ entries: [SMERNICA], at: AT, by: "g@futbalsfz.sk" })!
    expect("legalBasisReference" in v).toBe(false)
    expect(v.legalBasis).toBe("legitimate_interest")
  })

  it("neznámy druh v uloženom koncepte sa neprenesie", () => {
    const zly = { basis: "consent", key: "x", label: "X", reference: null } as never
    expect(legalBasisFromDraft({ entries: [zly], at: AT, by: "g@futbalsfz.sk" })).toBeNull()
  })
})

describe("úlohy zodpovednej osoby na karte v správe (D151)", () => {
  const now = new Date("2026-09-30T12:00:00Z")
  const other = { personId: "p-iny", fullName: "Iný", email: "iny@futbalsfz.sk" }
  const v = (versionId: string, from: string, over: Record<string, unknown> = {}) => ({
    versionId, isActive: false, effectiveFrom: new Date(from), responsiblePerson: GARANT, ...over,
  })

  it("platné znenie a novela vopred, v tomto poradí", () => {
    const versions = [v("v1", "2024-01-01"), v("v2", "2026-07-01"), v("v3", "2027-01-01", { isActive: true })]
    const tasks = versionBasisTasks("p-garant", versions, "v2", now)
    expect(tasks.map(t => [t.version.versionId, t.upcoming])).toEqual([["v2", false], ["v3", true]])
  })

  it("úloha patrí človeku, nie roli — cudzie znenia sa nevrátia", () => {
    const versions = [v("v2", "2026-07-01", { responsiblePerson: other }), v("v3", "2027-01-01", { isActive: true })]
    expect(versionBasisTasks("p-garant", versions, "v2", now).map(t => t.version.versionId)).toEqual(["v3"])
    expect(versionBasisTasks("p-iny", versions, "v2", now).map(t => t.version.versionId)).toEqual(["v2"])
  })

  it("znenie bez zodpovednej osoby nie je nikoho úloha", () => {
    expect(versionBasisTasks("p-garant", [v("v2", "2026-07-01", { responsiblePerson: null })], "v2", now)).toEqual([])
    expect(versionBasisTasks("", [v("v2", "2026-07-01", { responsiblePerson: { ...GARANT, personId: "" } })], "v2", now)).toEqual([])
  })

  it("staršie ani nezverejnené znenie úlohou nie je", () => {
    const versions = [v("v1", "2024-01-01"), v("v4", "2028-01-01", { isActive: false })]
    expect(versionBasisTasks("p-garant", versions, null, now)).toEqual([])
  })
})
