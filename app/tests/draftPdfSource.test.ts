/**
 * draftPdfSource.test.ts — PDF konceptu bez vlastného zdroja sa vyrobí zo
 * zdroja `.md` zverejneného znenia (ISSF-00, 24. 10. 2026).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const db = vi.hoisted(() => ({ doc: null as Record<string, unknown> | null, sets: [] as Record<string, unknown>[], rendered: 0 }))
vi.mock("../src/lib/mongodb", () => ({
  getCollection: async () => ({
    findOne: async () => db.doc,
    updateOne: async (_f: unknown, u: { $set?: Record<string, unknown> }) => { if (u.$set) db.sets.push(u.$set); return { matchedCount: 1 } },
    countDocuments: async () => 0,
    find: () => ({ toArray: async () => [] }),
  }),
}))
vi.mock("../src/lib/fileStore", () => ({
  saveFile: async (_c: string, name: string) => ({ id: `f-${name}`, name, bajtov: 1, sha256: "s" }),
  deleteFile: async () => {}, fileInfo: async () => null, loadFile: async () => null,
}))
vi.mock("../src/lib/documentPdf", () => ({ renderDocumentPdf: async () => { db.rendered++; return new Uint8Array([1]) } }))
vi.mock("../src/lib/tenants", async importOriginal => ({ ...(await importOriginal<typeof import("../src/lib/tenants")>()), tenantByCompanyCode: async () => ({ companyCode: "SFZ" }) }))

import { regenerateDraftPdf } from "../src/lib/libraryWrite"

const md = (name: string) => ({ id: name, name, bytes: 1, sha256: "x", type: "markdown", uploadedAt: new Date(), uploadedBy: "a" })

beforeEach(() => { db.sets = []; db.rendered = 0 })

describe("regenerateDraftPdf", () => {
  it("bez zdroja konceptu použije zdroj .md zverejneného znenia", async () => {
    db.doc = { documentId: "d", companyCode: "SFZ", title: "Manuál", draftMarkdown: "# Text", versions: [{ versionId: "v1", publishedAt: new Date(), source: md("ISSF-00-prehlad.md") }] }
    expect(await regenerateDraftPdf("SFZ", "d", "a")).toBe(true)
    expect(db.rendered).toBe(1)
    expect((db.sets[0].draftPdf as { name: string }).name).toBe("ISSF-00-prehlad.pdf")
  })
  it("dokument bez zdroja .md (sken, Word) sa nemení", async () => {
    db.doc = { documentId: "d", companyCode: "SFZ", draftMarkdown: "# Text", versions: [{ versionId: "v1", source: { ...md("norma.docx"), type: "docx" } }] }
    expect(await regenerateDraftPdf("SFZ", "d", "a")).toBe(false)
    expect(db.rendered).toBe(0)
  })
})
