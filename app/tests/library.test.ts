/**
 * kniznica.test.ts — číselníky a identifikátor dokumentu (D53).
 *
 * Testuje sa to, čo rozhoduje, čo sa vôbec dostane do databázy. Zápis
 * a chunkovanie sa netestujú tu — chunker má vlastné testy a zápis je
 * databáza.
 */

import { AppError } from "../src/lib/appError"
import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"
import { checkValue, checkList, CodelistError, KEY_PATTERN } from "../src/lib/codelists"
import { makeDocumentId, checkMetadata, LibraryError, MAX_INTERNAL_NUMBER } from "../src/lib/libraryWrite"
import { versionFixProblem } from "../src/lib/textFix"

describe("ciselniky", () => {
  it("uzavrety ciselnik neprijme nic navyse", () => {
    // scope je closed: true — nova hodnota by znamenala filter, ktoremu
    // nikde inde nikto nerozumie.
    expect(checkValue("scope", "company")).toBe("company")
    expect(() => checkValue("scope", "vesmir")).toThrow(CodelistError)
  })

  it("otvoreny ciselnik prijme novy kluc v spravnom tvare", () => {
    expect(checkValue("sectionKey", "novy_poriadok")).toBe("novy_poriadok")
  })

  it("otvoreny ciselnik neprijme vetu ani diakritiku", () => {
    // Kluc ide do documentId a odtial do adries a exportov.
    for (const invalid of ["Nový poriadok", "novy poriadok", "NOVY", "a", "x".repeat(70)]) {
      expect(() => checkValue("sectionKey", invalid), invalid).toThrow(CodelistError)
    }
  })

  it("tvar kluca je uzky zamerne", () => {
    expect(KEY_PATTERN.test("sutazny_poriadok")).toBe(true)
    expect(KEY_PATTERN.test("_zaciatok")).toBe(false)
    expect(KEY_PATTERN.test("s-pomlckou")).toBe(false)
  })

  it("prazdna hodnota je chyba, nie ticho preskocena", () => {
    expect(() => checkValue("language", "  ")).toThrow(CodelistError)
  })

  it("zoznam zahodi prazdne a duplicity", () => {
    expect(checkList("tags", ["poriadok", "", "poriadok", "stanovy"]))
      .toEqual(["poriadok", "stanovy"])
  })
})

describe("identifikator dokumentu", () => {
  it("je z organizacie a kluca, nie z nazvu suboru", () => {
    expect(makeDocumentId({ companyCode: "SFZ", sectionKey: "stanovy" })).toBe("sfz:stanovy")
  })

  it("velke pismena organizacie nerobia druhy dokument", () => {
    expect(makeDocumentId({ companyCode: "sfz", sectionKey: "stanovy" }))
      .toBe(makeDocumentId({ companyCode: "SFZ", sectionKey: "stanovy" }))
  })

  // D80 — identita je documentKey, zaradenie je sectionKey.
  it("documentKey ma prednost pred sectionKey", () => {
    expect(makeDocumentId({
      companyCode: "SFZ", sectionKey: "smernice", documentKey: "smernica_gdpr",
    })).toBe("sfz:smernica_gdpr")
  })

  it("bez documentKey plati sectionKey — dokumentom spred D80 sa identita nemeni", () => {
    // Toto je ta najpodstatnejsia veta celej migracie: documentId je cudzi
    // kluc v siestich kolekciach a zmenit sa nesmie ani jednemu dokumentu.
    for (const key of ["stanovy", "sutazny_poriadok", "volebny_poriadok"]) {
      expect(makeDocumentId({ companyCode: "SFZ", sectionKey: key }))
        .toBe(makeDocumentId({ companyCode: "SFZ", sectionKey: key, documentKey: key }))
    }
  })

  it("dva dokumenty v tom istom zaradeni maju roznu identitu", () => {
    // Presne to, co sa pred D80 nedalo: desat zapisnic pod jednym zaradenim.
    const a = makeDocumentId({ companyCode: "SFZ", sectionKey: "zapisnice", documentKey: "zapisnica_vv_2026_03" })
    const b = makeDocumentId({ companyCode: "SFZ", sectionKey: "zapisnice", documentKey: "zapisnica_vv_2026_04" })
    expect(a).not.toBe(b)
  })
})

describe("metadata z formulara", () => {
  const base = {
    title: "Stanovy",
    sectionKey: "stanovy",
    companyCode: "SFZ",
    scope: "company",
    accessLevel: "internal",
    language: "sk",
  }

  it("uplne metadata prejdu", () => {
    const m = checkMetadata(base)
    expect(m.title).toBe("Stanovy")
    expect(m.tags).toEqual([])
  })

  it("documentKey sa doplni zo sectionKey, ked chyba (D80)", () => {
    expect(checkMetadata(base).documentKey).toBe("stanovy")
  })

  it("documentKey sa da zadat vlastny a nemusi byt v ciselniku", () => {
    // Kluc dokumentu je identita, ktoru voli kurator — nie polozka slovnika.
    const m = checkMetadata({ ...base, sectionKey: "smernice", documentKey: "smernica_gdpr" })
    expect(m.documentKey).toBe("smernica_gdpr")
    expect(m.sectionKey).toBe("smernice")
  })

  it("documentKey sa normalizuje na male pismena", () => {
    expect(checkMetadata({ ...base, documentKey: "STANOVY" }).documentKey).toBe("stanovy")
  })

  it("documentKey v zlom tvare je chyba s prelozitelnym kodom", () => {
    for (const invalid of ["s pomlckou a medzerou", "diakritika_ľš", "s-pomlckou", "_zaciatok"]) {
      try {
        checkMetadata({ ...base, documentKey: invalid })
        throw new Error("malo to zlyhat: " + invalid)
      } catch (e) {
        expect((e as AppError).code, invalid).toBe("library.documentKeyShape")
      }
    }
  })

  it("nepovinne polia chybaju, ked ich nikto nevyplnil", () => {
    // Nevyplnene nepovinne pole nesmie vzniknut ako prazdny retazec: v zozname
    // by potom bola prazdna bunka, ktora vyzera ako chybajuci udaj, a nie ako
    // udaj, ktory dokument nema.
    const m = checkMetadata(base)
    expect(m.ownerDepartmentId).toBeUndefined()
    expect(m.internalNumber).toBeUndefined()
  })

  it("interne cislo sa oreze a prazdne zmizne", () => {
    expect(checkMetadata({ ...base, internalNumber: "  12/2024  " }).internalNumber).toBe("12/2024")
    expect(checkMetadata({ ...base, internalNumber: "   " }).internalNumber).toBeUndefined()
  })

  it("interne cislo dlhsie nez limit je chyba s prelozitelnym kodom", () => {
    // Do stlpca v zozname patri oznacenie, nie veta.
    try {
      checkMetadata({ ...base, internalNumber: "x".repeat(MAX_INTERNAL_NUMBER + 1) })
      throw new Error("malo to zlyhat")
    } catch (e) {
      expect((e as AppError).code).toBe("library.internalNumberTooLong")
    }
  })

  it("oddelenie sa tu neoveruje proti ciselniku, len oreze", () => {
    // Oddelenia su strom v databaze, iny pre kazdu organizaciu. Ze existuje,
    // overuje `checkOwnerDepartment()` v zapise — `checkMetadata()` je cista
    // funkcia a ma nou zostat.
    expect(checkMetadata({ ...base, ownerDepartmentId: " abc " }).ownerDepartmentId).toBe("abc")
    expect(checkMetadata({ ...base, ownerDepartmentId: "" }).ownerDepartmentId).toBeUndefined()
  })

  it("bez nazvu to neprejde", () => {
    // Bez nazvu je v zozname len kluc a v potvrdzovacej formulke prazdno.
    expect(() => checkMetadata({ ...base, title: "   " })).toThrow(LibraryError)
  })

  it("chybajuce povinne pole je chyba s nazvom pola", () => {
    try {
      checkMetadata({ ...base, accessLevel: "" })
      throw new Error("malo to zlyhat")
    } catch (e) {
      expect((e as Error).message).toContain("accessLevel")
    }
  })

  it("hodnota mimo uzavreteho ciselnika sa odmietne aj tu", () => {
    // Chyba prejde von taka, aka je (CodelistError) — prebalovanie do
    // LibraryError zahadzovalo kod, a bez kodu sa veta neda prelozit.
    // Pre okraj je podstatne, ze je to AppError; ktora presne, uz nie.
    expect(() => checkMetadata({ ...base, accessLevel: "tajne" })).toThrow(AppError)
    try {
      checkMetadata({ ...base, accessLevel: "tajne" })
    } catch (e) {
      expect((e as AppError).code).toBe("codelist.notAllowed")
    }
  })
})

describe("vyber poli pri stave preindexovania", () => {
  it("projekcia neobsahuje zaroven versions aj versions.$", () => {
    // Mongo taky vyber odmieta chybou "Path collision at versions" a padala
    // na tom cela zalozka Clenenie. Positional $ sa navyse bez podmienky na
    // to pole ani pouzit neda.
    const source = readFileSync(
      new URL("../src/lib/libraryWrite.ts", import.meta.url), "utf8",
    )
    expect(source).not.toContain('"versions.$": 1')
  })
})

/**
 * Zamknutie údajov znenia (D82).
 *
 * Označenie a dátum platnosti sú v podpísanej formulke (D28), takže po prvom
 * platnom potvrdení sa zamykajú. Text vo formulke nie je — ten sa opravuje
 * naďalej (ADR-007). Deliaca čiara nie je „malá vs. veľká zmena".
 */
describe("zamknutie udajov znenia", () => {
  const base = { acknowledgements: 0, changesLabel: false, changesEffectiveFrom: false, reason: "preklep" }

  it("bez potvrdeni sa da menit vsetko", () => {
    expect(versionFixProblem({ ...base, changesLabel: true, changesEffectiveFrom: true })).toBeNull()
  })

  it("s potvrdeniami sa datum menit neda", () => {
    expect(versionFixProblem({ ...base, acknowledgements: 40, changesEffectiveFrom: true }))
      .toBe("versionFix.locked")
  })

  it("s potvrdeniami sa oznacenie menit neda", () => {
    // Oznacenie je vo formulke rovnako ako datum -- preklep v nom je rovnaky
    // problem, aj ked vyzera nevinnejsie.
    expect(versionFixProblem({ ...base, acknowledgements: 1, changesLabel: true }))
      .toBe("versionFix.locked")
  })

  it("poznamka a zdroj datumu sa daju menit aj s potvrdeniami", () => {
    // Ani jedno nie je vo formulke, takze podpis nimi neprestane byt pravdivy.
    expect(versionFixProblem({ ...base, acknowledgements: 40 })).toBeNull()
  })

  it("dovod je povinny vzdy, aj bez potvrdeni", () => {
    expect(versionFixProblem({ ...base, reason: "   " })).toBe("versionFix.reasonRequired")
  })

  it("dovod sa pyta skor nez zamknutie", () => {
    // Poradie kontrol je sucast pravidla: bez dovodu sa nema zapisat nic,
    // takze sa netreba ani dozvediet, ci je zaznam zamknuty.
    expect(versionFixProblem({ ...base, acknowledgements: 40, changesEffectiveFrom: true, reason: "" }))
      .toBe("versionFix.reasonRequired")
  })
})
