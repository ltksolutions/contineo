/**
 * searchScope.test.ts — asistent hľadá len v zneniach platných k dňu otázky
 * (plán „znenia v indexe", krok 4).
 *
 * Do kroku 4 filtroval `isActive` úseku. Novela zverejnená vopred tak bola
 * v hľadaní skôr, než začala platiť, a nahradené znenie z neho vypadlo skôr,
 * než prestalo platiť (D143).
 */
import { describe, it, expect } from "vitest"
import {
  hasSearchScope, searchFilterClauses, vectorFilter, VERIFIED_ANSWER_SOURCE,
} from "../src/lib/mongoSearch"
import type { SearchOptions } from "../src/lib/mongoSearch"
import { effectiveVersionIdsOf, isSameDay } from "../src/lib/searchVersions"
import type { DocumentRecord } from "../src/lib/documents"
import { QA_SOURCE_TYPE } from "../src/lib/curation"

const base: SearchOptions = {
  query: "lehota", accessLevel: "internal", companyCode: "SFZ", versionIds: ["v1", "v2"], verifiedAnswers: true,
}

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const version = (versionId: string, from: string | null, to: string | null, isActive: boolean) =>
  ({ versionId, label: versionId, effectiveFrom: from ? d(from) : null, effectiveTo: to ? d(to) : null, isActive })
const doc = (documentId: string, versions: ReturnType<typeof version>[]) =>
  ({ documentId, title: documentId, versions }) as unknown as DocumentRecord

describe("vectorFilter — rozsah znení", () => {
  it("dnešok: platné znenia v platnom členení alebo overená odpoveď", () => {
    expect(vectorFilter(base)).toEqual({
      companyCode: "SFZ",
      $or: [
        { versionId: { $in: ["v1", "v2"] }, superseded: false },
        { sourceType: "qa", isActive: true },
      ],
    })
  })

  it("iný deň: bez overených odpovedí, bez $or", () => {
    expect(vectorFilter({ ...base, verifiedAnswers: false })).toEqual({
      companyCode: "SFZ", versionId: { $in: ["v1", "v2"] }, superseded: false,
    })
  })

  it("isActive úseku normy už nerozhoduje", () => {
    const f = vectorFilter({ ...base, verifiedAnswers: false })
    expect(f).not.toHaveProperty("isActive")
  })

  it("žiadne platné znenie: len overené odpovede", () => {
    expect(vectorFilter({ ...base, versionIds: [] })).toEqual({ companyCode: "SFZ", sourceType: "qa", isActive: true })
  })

  it("verejný režim nechá accessLevel mimo $or", () => {
    expect(vectorFilter({ ...base, accessLevel: "public" })).toMatchObject({ companyCode: "SFZ", accessLevel: "public" })
  })
})

describe("searchFilterClauses — rozsah znení", () => {
  it("dnešok: jedna should klauzula s dvomi vetvami", () => {
    const clauses = searchFilterClauses(base)
    expect(clauses[0]).toEqual({ equals: { path: "companyCode", value: "SFZ" } })
    expect(clauses[1]).toEqual({
      compound: {
        should: [
          { compound: { filter: [{ in: { path: "versionId", value: ["v1", "v2"] } }, { equals: { path: "superseded", value: false } }] } },
          { compound: { filter: [{ equals: { path: "sourceType", value: "qa" } }, { equals: { path: "isActive", value: true } }] } },
        ],
        minimumShouldMatch: 1,
      },
    })
  })

  it("iný deň: podmienky priamo vo filtri", () => {
    expect(searchFilterClauses({ ...base, verifiedAnswers: false })).toEqual([
      { equals: { path: "companyCode", value: "SFZ" } },
      { in: { path: "versionId", value: ["v1", "v2"] } },
      { equals: { path: "superseded", value: false } },
    ])
  })
})

describe("prázdny rozsah", () => {
  it("bez znení a bez overených odpovedí sa nehľadá", () => {
    expect(hasSearchScope({ versionIds: [], verifiedAnswers: false })).toBe(false)
    expect(() => vectorFilter({ ...base, versionIds: [], verifiedAnswers: false })).toThrow()
    expect(() => searchFilterClauses({ ...base, versionIds: [], verifiedAnswers: false })).toThrow()
  })

  it("stačí jedno z toho", () => {
    expect(hasSearchScope({ versionIds: ["v1"], verifiedAnswers: false })).toBe(true)
    expect(hasSearchScope({ versionIds: [], verifiedAnswers: true })).toBe(true)
  })
})

describe("effectiveVersionIdsOf", () => {
  it("novela zverejnená vopred ešte neplatí — platí staré znenie (D143)", () => {
    const docs = [doc("stanovy", [
      version("old", "2020-01-01", "2026-12-01", false),
      version("new", "2026-12-01", null, true),
    ])]
    expect(effectiveVersionIdsOf(docs, d("2026-09-29"))).toEqual(["old"])
    expect(effectiveVersionIdsOf(docs, d("2026-12-01"))).toEqual(["new"])
  })

  it("dokument bez platného znenia neprispeje ničím", () => {
    const docs = [
      doc("koncept", [version("c", null, null, false)]),
      doc("buduci", [version("f", "2027-01-01", null, true)]),
      doc("platny", [version("p", "2024-01-01", null, true)]),
    ]
    expect(effectiveVersionIdsOf(docs, d("2026-09-29"))).toEqual(["p"])
  })

  it("najviac jedno znenie na dokument", () => {
    const docs = [doc("x", [version("a", "2020-01-01", null, true), version("b", "2024-01-01", null, true)])]
    expect(effectiveVersionIdsOf(docs, d("2026-09-29"))).toEqual(["b"])
  })
})

describe("isSameDay — dnešok v Bratislave", () => {
  it("polnoc UTC je už ďalší deň v Bratislave", () => {
    // 22:30 UTC 28. 9. = 00:30 29. 9. v Bratislave (letný čas).
    expect(isSameDay(new Date("2026-09-28T22:30:00Z"), new Date("2026-09-29T10:00:00Z"))).toBe(true)
    expect(isSameDay(new Date("2026-09-28T21:30:00Z"), new Date("2026-09-29T10:00:00Z"))).toBe(false)
  })
})

it("označenie overenej odpovede je rovnaké ako v kurácii", () => {
  expect(VERIFIED_ANSWER_SOURCE).toBe(QA_SOURCE_TYPE)
})
