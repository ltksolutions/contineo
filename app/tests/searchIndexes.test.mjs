/**
 * searchIndexes.test.mjs — definície search indexov a filtre hľadania sa
 * nesmú rozísť (plán „znenia v indexe", krok 3).
 *
 * Filter na pole, ktoré index nepozná, nezlyhá — vráti prázdny výsledok bez
 * chyby. Preto sa tu overuje, že každé pole z `vectorFilter()`
 * a `searchFilterClauses()` je v oboch indexoch.
 */
import { describe, it, expect } from "vitest"
import { vectorDefinition, TEXT_DEFINITION, FILTER_PATHS, definitionDiff } from "../scripts/lib/searchIndexes.mjs"
import { vectorFilter, searchFilterClauses } from "../src/lib/mongoSearch.ts"

const vectorFilters = () => vectorDefinition("voyage-4", "text").fields.filter(f => f.type === "filter").map(f => f.path)

/** Stav živých indexov podľa kroku 0 (2026-09-28) = pôvodný `atlas_init.mjs`. */
const LIVE_VECTOR = {
  fields: [
    { type: "autoEmbed", modality: "text", path: "text", model: "voyage-4" },
    ...["companyCode", "sectionKey", "accessLevel", "scope", "isActive", "language"].map(p => ({ type: "filter", path: p })),
  ],
}
const LIVE_TEXT = {
  mappings: {
    dynamic: false,
    fields: {
      text: { type: "string", analyzer: "lucene.standard" },
      heading: { type: "string", analyzer: "lucene.standard" },
      articleRef: { type: "string", analyzer: "lucene.keyword" },
      companyCode: { type: "token" }, sectionKey: { type: "token" }, accessLevel: { type: "token" },
      scope: { type: "token" }, language: { type: "token" }, isActive: { type: "boolean" },
    },
  },
}

/** Polia z MQL filtra `$vectorSearch`, aj vnútri `$or` / `$and`. */
const vectorPaths = f => Object.entries(f).flatMap(([k, v]) =>
  k.startsWith("$") ? v.flatMap(vectorPaths) : [k])

/** Polia z klauzúl `$search`, aj vnútri `compound`. */
const searchPaths = clauses => clauses.flatMap(c => c.compound
  ? ["filter", "must", "should", "mustNot"].flatMap(k => searchPaths(c.compound[k] ?? []))
  : [c.equals?.path ?? c.in?.path].filter(Boolean))

describe("definície indexov", () => {
  it("nesú znenie, príznak nahradeného členenia a druh zdroja, sectionKey už nie", () => {
    for (const p of ["versionId", "superseded", "sourceType"]) {
      expect(vectorFilters()).toContain(p)
      expect(TEXT_DEFINITION.mappings.fields[p]).toBeDefined()
    }
    expect(vectorFilters()).not.toContain("sectionKey")
    expect(TEXT_DEFINITION.mappings.fields.sectionKey).toBeUndefined()
  })

  it("každé pole, podľa ktorého hľadanie filtruje, je v oboch indexoch", () => {
    // Obe vetvy rozsahu naraz (znenia aj overené odpovede) — vtedy je filter
    // vnorený v `$or` a `compound.should` a pole sa ľahko prehliadne.
    const opts = { companyCode: "SFZ", accessLevel: "public", query: "x", versionIds: ["v1"], verifiedAnswers: true }
    const used = new Set([...vectorPaths(vectorFilter(opts)), ...searchPaths(searchFilterClauses(opts))])
    expect([...used].sort()).toEqual(["accessLevel", "companyCode", "isActive", "sourceType", "superseded", "versionId"])
    for (const p of used) {
      expect(FILTER_PATHS, p).toContain(p)
      expect(TEXT_DEFINITION.mappings.fields[p], p).toBeDefined()
    }
  })
})

describe("rozdiel živej definície oproti repozitáru", () => {
  it("vektorový index zo stavu kroku 0: pribudne znenie, príznak a druh zdroja, odíde sectionKey", () => {
    const d = definitionDiff(LIVE_VECTOR, vectorDefinition("voyage-4", "text"))
    expect(d.differs).toBe(true)
    expect(d.added.sort()).toEqual(["filter:sourceType", "filter:superseded", "filter:versionId"])
    expect(d.removed).toEqual(["filter:sectionKey"])
  })

  it("fulltextový index zo stavu kroku 0: to isté", () => {
    const d = definitionDiff(LIVE_TEXT, TEXT_DEFINITION)
    expect(d.added.sort()).toEqual(["sourceType", "superseded", "versionId"])
    expect(d.removed).toEqual(["sectionKey"])
  })

  it("rovnaká definícia v inom poradí a s doplnenými predvolenými hodnotami Atlasu nie je zmena", () => {
    const want = vectorDefinition("voyage-4", "text")
    const live = { fields: [...want.fields].reverse().map(f => (f.type === "autoEmbed" ? { ...f, quantization: "none" } : f)) }
    expect(definitionDiff(live, want).differs).toBe(false)
    expect(definitionDiff(JSON.parse(JSON.stringify(TEXT_DEFINITION)), TEXT_DEFINITION).differs).toBe(false)
  })

  it("chýbajúci index je rozdiel", () => {
    expect(definitionDiff(undefined, TEXT_DEFINITION).differs).toBe(true)
  })
})
