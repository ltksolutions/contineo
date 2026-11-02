/**
 * documentAliases.test.ts — starý identifikátor dokumentu v adrese (ADR-044).
 *
 * Po migrácii na UUID žijú staré identifikátory ďalej v odoslaných e-mailoch
 * a záložkách. `proxy.ts` sa databázy pýta len vtedy, keď adresa nesie
 * identifikátor starého tvaru — tu sa overuje, že to rozpozná správne
 * a nepýta sa pri každej stránke knižnice.
 */
import { describe, it, expect } from "vitest"
import { documentIdInPath, mayBeOldDocumentId } from "../src/lib/documentAliases"

describe("mayBeOldDocumentId", () => {
  it("starý tvar áno, nový UUID nie", () => {
    expect(mayBeOldDocumentId("sfz:stanovy")).toBe(true)
    expect(mayBeOldDocumentId("sfz:7194b66e9a894231b52ae1a56a6f8ba9")).toBe(false)
  })
  it("cesty bez dvojbodky nie sú identifikátory", () => {
    expect(mayBeOldDocumentId("new")).toBe(false)
    expect(mayBeOldDocumentId("hierarchy")).toBe(false)
  })
})

describe("documentIdInPath", () => {
  it("rozloží cestu knižnice, detailu aj PDF", () => {
    expect(documentIdInPath("/library/sfz%3Astanovy/edit")).toEqual({ prefix: "library", id: "sfz:stanovy", rest: "/edit" })
    expect(documentIdInPath("/library/sfz:stanovy")).toEqual({ prefix: "library", id: "sfz:stanovy", rest: "" })
    expect(documentIdInPath("/documents/sfz:stanovy")).toEqual({ prefix: "documents", id: "sfz:stanovy", rest: "" })
    expect(documentIdInPath("/api/documents/sfz:stanovy/pdf")).toEqual({ prefix: "api/documents", id: "sfz:stanovy", rest: "/pdf" })
  })
  it("nový identifikátor a iné stránky knižnice nechá tak", () => {
    expect(documentIdInPath("/library/sfz:7194b66e9a894231b52ae1a56a6f8ba9/edit")).toBeNull()
    expect(documentIdInPath("/library/new")).toBeNull()
    expect(documentIdInPath("/library")).toBeNull()
    expect(documentIdInPath("/organisation/signin")).toBeNull()
  })
  it("pokazené kódovanie nezhodí bránu", () => {
    expect(documentIdInPath("/library/%E0%A4%A")).toBeNull()
  })
})
