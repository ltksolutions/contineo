/**
 * kniznica.test.ts — číselníky a identifikátor dokumentu (D53).
 *
 * Testuje sa to, čo rozhoduje, čo sa vôbec dostane do databázy. Zápis
 * a chunkovanie sa netestujú tu — chunker má vlastné testy a zápis je
 * databáza.
 */

import { readFileSync } from "node:fs"
import { describe, it, expect } from "vitest"
import { checkValue, checkList, CodelistError, KEY_PATTERN } from "../src/lib/codelists"
import { makeDocumentId, checkMetadata, LibraryError } from "../src/lib/libraryWrite"

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
    for (const zle of ["Nový poriadok", "novy poriadok", "NOVY", "a", "x".repeat(70)]) {
      expect(() => checkValue("sectionKey", zle), zle).toThrow(CodelistError)
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
})

describe("metadata z formulara", () => {
  const zaklad = {
    title: "Stanovy",
    sectionKey: "stanovy",
    companyCode: "SFZ",
    scope: "company",
    accessLevel: "internal",
    language: "sk",
  }

  it("uplne metadata prejdu", () => {
    const m = checkMetadata(zaklad)
    expect(m.title).toBe("Stanovy")
    expect(m.tags).toEqual([])
  })

  it("bez nazvu to neprejde", () => {
    // Bez nazvu je v zozname len kluc a v potvrdzovacej formulke prazdno.
    expect(() => checkMetadata({ ...zaklad, title: "   " })).toThrow(LibraryError)
  })

  it("chybajuce povinne pole je chyba s nazvom pola", () => {
    try {
      checkMetadata({ ...zaklad, accessLevel: "" })
      throw new Error("malo to zlyhat")
    } catch (e) {
      expect((e as Error).message).toContain("accessLevel")
    }
  })

  it("hodnota mimo uzavreteho ciselnika sa odmietne aj tu", () => {
    expect(() => checkMetadata({ ...zaklad, accessLevel: "tajne" })).toThrow(LibraryError)
  })
})

describe("vyber poli pri stave preindexovania", () => {
  it("projekcia neobsahuje zaroven versions aj versions.$", () => {
    // Mongo taky vyber odmieta chybou "Path collision at versions" a padala
    // na tom cela zalozka Clenenie. Positional $ sa navyse bez podmienky na
    // to pole ani pouzit neda.
    const zdroj = readFileSync(
      new URL("../src/lib/libraryWrite.ts", import.meta.url), "utf8",
    )
    expect(zdroj).not.toContain('"versions.$": 1')
  })
})
