/**
 * draftMetaPdf.test.ts — zmena údajov o znení pregeneruje PDF konceptu z `.md`
 * (ADR-031). Dátum účinnosti je v päte PDF; 13. 10. 2026 išlo ISSF-01 na
 * schválenie so starým dátumom, lebo `saveDraftMeta()` PDF nepregeneroval.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

type Row = Record<string, unknown>
const db = vi.hoisted(() => ({ cols: {} as Record<string, Row[]>, rendered: [] as Row[], saved: [] as string[] }))

function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([k, v]) => {
    const value = row[k]
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      const op = v as Row
      if ("$ne" in op) return value !== op.$ne
      if ("$in" in op) return (op.$in as unknown[]).includes(value)
      if ("$nin" in op) return !(op.$nin as unknown[]).includes(value)
    }
    return value === v
  })
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: async (name: string) => {
    const rows = (db.cols[name] ??= [])
    const found = (f: Row) => rows.filter(r => matches(r, f))
    return {
      findOne: async (f: Row) => found(f)[0] ?? null,
      find: (f: Row) => ({ toArray: async () => found(f), sort: () => ({ toArray: async () => found(f) }) }),
      countDocuments: async (f: Row) => (f.$or ? 1 : found(f).length),
      updateOne: async (f: Row, u: { $set: Row }) => {
        const r = rows.find(x => matches(x, f))
        if (r) Object.assign(r, u.$set)
        return { matchedCount: r ? 1 : 0, modifiedCount: r ? 1 : 0 }
      },
    }
  },
}))
vi.mock("../src/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: async () => {},
}))
vi.mock("../src/lib/notifications", () => ({ notifyPeople: async () => {} }))
vi.mock("../src/lib/fileStore", () => ({
  saveFile: async (_c: string, name: string) => {
    const id = `f${db.saved.push(name)}`
    return { id, name, bajtov: 1, sha256: id }
  },
  deleteFile: async () => {}, fileInfo: async () => null, loadFile: async () => null,
}))
vi.mock("../src/lib/documentPdf", () => ({
  renderDocumentPdf: async (input: Row) => { db.rendered.push(input); return new Uint8Array([1]) },
}))
vi.mock("../src/lib/tenants", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/tenants")>()),
  tenantByCompanyCode: async () => ({ companyCode: "SFZ" }),
}))

import { saveDraftMeta, saveDraftTitle } from "../src/lib/libraryWrite"
import { documentDraftIdentity, normalizeMeta } from "../src/lib/versionMeta"

const Y = (s: string) => new Date(`${s}T00:00:00Z`)
const file = (id: string, name: string) => ({ id, name, sha256: id, type: name.endsWith(".md") ? "markdown" : "pdf" })
const DOC = {
  companyCode: "SFZ", documentId: "sfz:issf_01", title: "Konto a prihlásenie", language: "sk",
  draftMarkdown: "Text bez nadpisu", draftPdf: file("pdf0", "issf_01.pdf"), draftSource: file("md0", "issf_01.md"),
  draftMeta: normalizeMeta({ effectiveFrom: Y("2026-11-01") }), versions: [] as Row[],
}
const round = (versionId: string, extra: Row = {}) => ({
  companyCode: "SFZ", documentId: "sfz:issf_01", versionId, round: 1, submittedBy: "jan@sfz.sk", submittedAt: new Date(),
  approvers: [{ email: "agata@sfz.sk", fullName: "Agáta", decision: null, decidedAt: null }], closedAt: null, outcome: null, ...extra,
})
const doc = () => db.cols.documents[0]

beforeEach(() => {
  db.cols = { documents: [{ ...DOC }], approval_rounds: [], persons: [] }
  db.rendered = []; db.saved = []
})

describe("saveDraftMeta — PDF konceptu z .md", () => {
  it("nový dátum účinnosti vyrobí nové PDF s novou pätou", async () => {
    await saveDraftMeta("SFZ", "sfz:issf_01", normalizeMeta({ effectiveFrom: Y("2026-12-01") }), "jan@sfz.sk")
    expect(db.rendered).toHaveLength(1)
    expect(db.rendered[0].effectiveFrom).toEqual(Y("2026-12-01"))
    expect(doc().draftPdf).toMatchObject({ name: "issf_01.pdf", generatedFromMarkdown: true })
    expect((doc().draftPdf as Row).id).not.toBe("pdf0")
  })

  it("zmena údaja, ktorý v PDF nie je, PDF nemení", async () => {
    await saveDraftMeta("SFZ", "sfz:issf_01", normalizeMeta({ effectiveFrom: Y("2026-11-01"), approvedBy: "VV SFZ" }), "jan@sfz.sk")
    expect(db.rendered).toEqual([])
    expect((doc().draftPdf as Row).id).toBe("pdf0")
  })

  it("koncept so zdrojom iným než .md ostane bez zmeny", async () => {
    doc().draftSource = file("w0", "issf_01.docx")
    await saveDraftMeta("SFZ", "sfz:issf_01", normalizeMeta({ effectiveFrom: Y("2026-12-01") }), "jan@sfz.sk")
    expect(db.rendered).toEqual([])
  })

  it("otvorené kolo starej podoby sa uzavrie, uzavreté (zamietnuté) nie", async () => {
    const stale = documentDraftIdentity({ ...DOC, draftMarkdown: "starší text" })
    db.cols.approval_rounds = [
      round(stale),
      round(stale, { round: 2, outcome: "rejected" }),
    ]
    await saveDraftMeta("SFZ", "sfz:issf_01", normalizeMeta({ effectiveFrom: Y("2026-12-01") }), "jan@sfz.sk")
    expect(db.cols.approval_rounds.map(r => r.outcome)).toEqual(["cancelled", "rejected"])
  })

  it("počas kola sa údaje meniť nedajú — PDF ani kolo sa nedotkne", async () => {
    db.cols.approval_rounds = [round(documentDraftIdentity(DOC))]
    await expect(saveDraftMeta("SFZ", "sfz:issf_01", normalizeMeta({ effectiveFrom: Y("2026-12-01") }), "jan@sfz.sk"))
      .rejects.toMatchObject({ code: "meta.locked" })
    expect(db.rendered).toEqual([])
    expect(db.cols.approval_rounds[0].outcome).toBeNull()
  })
})

describe("saveDraftTitle — názov v hlavičke PDF z .md", () => {
  it("nový názov vyrobí nové PDF s novým názvom", async () => {
    await saveDraftTitle("SFZ", "sfz:issf_01", "Konto, prihlásenie a heslo", "jan@sfz.sk")
    expect(db.rendered).toHaveLength(1)
    expect(db.rendered[0].title).toBe("Konto, prihlásenie a heslo")
  })
})
