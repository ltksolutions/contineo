/**
 * libraryReader.test.ts — Knižnica pre osobu bez roly správy obsahu
 * (SHELL-menu-v-hlavicke, 30. 9. 2026): platné dokumenty vlastnej
 * organizácie, bez konceptov a znení bez účinnosti (D90).
 */

import { describe, it, expect, vi } from "vitest"

const seen = vi.hoisted(() => ({ filter: null as unknown }))
const D = (s: string) => new Date(`${s}T00:00:00Z`)
vi.mock("../src/lib/mongodb", () => ({
  getCollection: async () => ({
    find: (f: unknown) => {
      seen.filter = f
      return {
        toArray: async () => [
          { documentId: "sfz:b", title: "Poriadok B", companyCode: "SFZ", versions: [{ label: "2026/1", isActive: true, effectiveFrom: D("2026-01-01"), effectiveTo: null }] },
          { documentId: "sfz:a", title: "Anketa A", companyCode: "SFZ", versions: [{ label: "1", isActive: true, effectiveFrom: D("2026-05-01"), effectiveTo: null }] },
          { documentId: "sfz:draft", title: "Koncept", companyCode: "SFZ", versions: [{ label: "draft", isActive: false, effectiveFrom: null, effectiveTo: null }] },
          { documentId: "sfz:future", title: "Budúci", companyCode: "SFZ", versions: [{ label: "1", isActive: true, effectiveFrom: D("2027-01-01"), effectiveTo: null }] },
          { documentId: "iny:x", title: "Cudzí", companyCode: "INY", versions: [{ label: "1", isActive: true, effectiveFrom: D("2026-01-01"), effectiveTo: null }] },
        ],
      }
    },
  }),
}))

import { readableDocuments } from "../src/lib/documents"

describe("Knižnica na čítanie", () => {
  it("len platné dokumenty vlastnej organizácie, podľa názvu", async () => {
    const docs = await readableDocuments("SFZ", D("2026-09-30"))
    expect(docs.map(d => d.documentId)).toEqual(["sfz:a", "sfz:b"])
    expect(docs[1]).toMatchObject({ versionLabel: "2026/1", effectiveFrom: D("2026-01-01") })
  })

  it("organizácia je v podmienke dotazu (D90)", async () => {
    await readableDocuments("SFZ")
    expect(seen.filter).toEqual({ companyCode: "SFZ" })
  })

  it("bez organizácie odmietne", async () => {
    await expect(readableDocuments("")).rejects.toThrow()
  })
})
