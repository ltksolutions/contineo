/**
 * searchTenant.test.ts — vyhľadávanie nikdy neprekročí hranicu organizácie (D90).
 *
 * `/api/chat` do 2026-09-17 hľadal bez `companyCode`, lebo filter bol
 * nepovinný a nikto ho nevyplnil. Tieto testy strážia, že filter organizácie
 * je v oboch indexoch **vždy** a že bez neho sa nehľadá vôbec.
 */
import { describe, it, expect } from "vitest"
import {
  MissingTenantError, searchFilterClauses, tenantFilter, vectorFilter,
} from "../src/lib/mongoSearch"
import type { SearchOptions } from "../src/lib/mongoSearch"

const base: SearchOptions = { query: "lehota", accessLevel: "internal", companyCode: "SFZ" }

describe("tenantFilter", () => {
  it("vráti organizáciu", () => {
    expect(tenantFilter(base)).toBe("SFZ")
  })

  it.each([
    ["chýba", undefined],
    ["prázdny reťazec", ""],
    ["len medzery", "   "],
    ["nie je reťazec", ["SFZ"]],
  ])("vyhodí výnimku, keď organizácia %s", (_label, value) => {
    expect(() => tenantFilter({ companyCode: value as never })).toThrow(MissingTenantError)
  })
})

describe("vectorFilter", () => {
  it("má organizáciu ako rovnosť, nie zoznam", () => {
    expect(vectorFilter(base).companyCode).toBe("SFZ")
  })

  it("organizácia je tam aj pri verejnom režime", () => {
    const f = vectorFilter({ ...base, accessLevel: "public" })
    expect(f).toMatchObject({ companyCode: "SFZ", accessLevel: "public" })
  })

  it("bez organizácie sa filter nezostaví", () => {
    expect(() => vectorFilter({ ...base, companyCode: "" })).toThrow(MissingTenantError)
  })
})

describe("searchFilterClauses", () => {
  it("prvá klauzula je organizácia", () => {
    expect(searchFilterClauses(base)[0]).toEqual({ equals: { path: "companyCode", value: "SFZ" } })
  })

  it("organizácia je tam aj pri verejnom režime", () => {
    const clauses = searchFilterClauses({ ...base, accessLevel: "public" })
    expect(clauses).toContainEqual({ equals: { path: "companyCode", value: "SFZ" } })
    expect(clauses).toContainEqual({ equals: { path: "accessLevel", value: "public" } })
  })

  it("bez organizácie sa klauzuly nezostavia", () => {
    expect(() => searchFilterClauses({ ...base, companyCode: undefined as never })).toThrow(MissingTenantError)
  })
})
