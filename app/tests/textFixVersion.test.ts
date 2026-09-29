/**
 * textFixVersion.test.ts — oprava textu cieľového znenia (fáza 3, D150).
 *
 * Dovtedy `fixText()` opravovalo vždy naposledy zverejnené znenie. Pri
 * novele vopred to bolo budúce znenie, hoci karta ukazuje ako platné iné.
 * Databáza je v pamäti; zápis do `versions.$[v]` sa naozaj vykoná, aby bolo
 * vidieť, ktorého znenia sa dotkol.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

type Row = Record<string, unknown>

const matches = (row: Row, filter: Row) => Object.entries(filter).every(([k, v]) => {
  if (v && typeof v === "object" && !(v instanceof Date) && "$ne" in (v as Row)) return row[k] !== (v as Row).$ne
  return row[k] === v
})

const db = vi.hoisted(() => ({
  chunks: [] as Record<string, unknown>[],
  doc: null as Record<string, unknown> | null,
}))

/** `$set` / `$push` s `versions.$[v].pole` a `arrayFilters: [{ "v.versionId": … }]`. */
function applyDocUpdate(u: { $set?: Row; $push?: Row }, opts?: { arrayFilters?: Row[] }) {
  const doc = db.doc!
  const target = opts?.arrayFilters?.[0]?.["v.versionId"]
  const version = (doc.versions as Row[]).find(v => v.versionId === target)
  for (const [k, val] of Object.entries(u.$set ?? {})) {
    if (k.startsWith("versions.$[v].")) version![k.slice(14)] = val
    else doc[k] = val
  }
  for (const [k, val] of Object.entries(u.$push ?? {})) {
    const field = k.slice(14)
    version![field] = [...((version![field] as unknown[]) ?? []), val]
  }
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (name: string) => {
    if (name === "document_chunks") {
      return {
        findOne: async (f: Row) => db.chunks.find(r => matches(r, f)) ?? null,
        countDocuments: async (f: Row) => db.chunks.filter(r => matches(r, f)).length,
        updateMany: async (f: Row, u: { $set: Row }) => {
          const hit = db.chunks.filter(r => matches(r, f))
          for (const r of hit) Object.assign(r, u.$set)
          return { modifiedCount: hit.length }
        },
        insertMany: async (rows: Row[]) => { db.chunks.push(...rows.map(r => ({ ...r }))) },
      }
    }
    if (name === "documents") {
      return {
        findOne: async () => (db.doc ? structuredClone(db.doc) : null),
        updateOne: async (_f: Row, u: { $set?: Row; $push?: Row }, opts?: { arrayFilters?: Row[] }) => {
          applyDocUpdate(u, opts)
          return { matchedCount: 1 }
        },
      }
    }
    return { findOne: async () => null }
  }),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => {}) }))
vi.mock("../src/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: audit.writeAudit,
}))

import { fixText, loadVersionIntoDraft } from "../src/lib/libraryWrite"
import { textFingerprint } from "../src/lib/chunkIdentity"

const text = (lehota: number, poplatok: number) =>
  `Článok 1\nÚčel\nToto je poriadok.\n\nČlánok 2\nLehoty\nLehota je ${lehota} dní.\n\nČlánok 4\nPoplatok\nPoplatok je ${poplatok} eur.`

const d = (s: string) => new Date(`${s}T00:00:00Z`)
// Dnes platí CUR; NEXT je novela vopred (naposledy zverejnená, isActive); OLD je minulé.
const OLD = { versionId: "old", label: "znenie účinné od 1. 1. 2024", isActive: false, effectiveFrom: d("2024-01-01"), effectiveTo: d("2026-07-01"), markdown: text(15, 50) }
const CUR = { versionId: "cur", label: "znenie účinné od 1. 7. 2026", isActive: false, effectiveFrom: d("2026-07-01"), effectiveTo: d("2099-01-01"), markdown: text(30, 50) }
const NEXT = { versionId: "next", label: "znenie účinné od 1. 1. 2099", isActive: true, effectiveFrom: d("2099-01-01"), effectiveTo: null, markdown: text(30, 80) }

const chunksOf = (versionId: string, isActive: boolean) => [1, 2, 3].map(n => ({
  companyCode: "SFZ", documentId: "sfz:x", versionId, isActive, superseded: false, chunkingId: "stary", articleRef: `čl. ${n}`,
}))

beforeEach(() => {
  db.doc = structuredClone({
    documentId: "sfz:x", companyCode: "SFZ", title: "Poriadok", versionId: "next", markdown: NEXT.markdown,
    versions: [OLD, CUR, NEXT],
  })
  db.chunks = [...chunksOf("old", false), ...chunksOf("cur", false), ...chunksOf("next", true)]
  vi.clearAllMocks()
})

const versionOf = (id: string) => (db.doc!.versions as Row[]).find(v => v.versionId === id)!
const fix = (draft: string, versionId?: string) => {
  db.doc!.draftMarkdown = draft
  return fixText("SFZ", "sfz:x", {
    expectedFingerprint: textFingerprint(draft), reason: "preklep", canManageContent: true, versionId,
  }, "kurator")
}

describe("fixText — cieľové znenie", () => {
  it("oprava platného znenia sa nedotkne novely ani kópie textu na dokumente", async () => {
    const draft = CUR.markdown.replace("Toto je poriadok.", "Toto je poriadok,")
    const r = await fix(draft, "cur")
    expect(r.versionId).toBe("cur")
    expect(versionOf("cur").markdown).toBe(draft)
    expect((versionOf("cur").textFixes as Row[])[0].fromMarkdown).toBe(CUR.markdown)
    expect(versionOf("next").markdown).toBe(NEXT.markdown)
    expect(db.doc!.markdown).toBe(NEXT.markdown)
    // Preindexované len platné znenie; aktívne členenie dokumentu (novela) ostalo.
    expect(db.chunks.filter(c => c.versionId === "cur" && c.superseded === false).every(c => c.isActive === false)).toBe(true)
    expect(db.chunks.filter(c => c.versionId === "next").every(c => c.chunkingId === "stary" && c.isActive === true)).toBe(true)
  })

  it("oprava novely vopred prepíše aj kópiu textu na dokumente", async () => {
    const draft = NEXT.markdown.replace("Toto je poriadok.", "Toto je poriadok,")
    await fix(draft, "next")
    expect(versionOf("next").markdown).toBe(draft)
    expect(db.doc!.markdown).toBe(draft)
    expect(versionOf("cur").markdown).toBe(CUR.markdown)
  })

  it("bez versionId sa opraví znenie, ktorému je koncept najbližší", async () => {
    const r = await fix(CUR.markdown.replace("Toto je poriadok.", "Toto je poriadok,"))
    expect(r.versionId).toBe("cur")
  })

  it("minulé znenie sa neopravuje (D78)", async () => {
    await expect(fix(OLD.markdown.replace("Toto", "Tot"), "old")).rejects.toMatchObject({ code: "textFix.pastVersion" })
    expect(versionOf("old").markdown).toBe(OLD.markdown)
  })
})

describe("loadVersionIntoDraft", () => {
  it("nahrá text platného znenia do voľného konceptu", async () => {
    await loadVersionIntoDraft("SFZ", "sfz:x", "cur", "kurator")
    expect(db.doc!.draftMarkdown).toBe(CUR.markdown)
  })

  it("rozpracovaný koncept neprepíše", async () => {
    db.doc!.draftMarkdown = "Úplne nové znenie v príprave."
    await expect(loadVersionIntoDraft("SFZ", "sfz:x", "cur", "kurator")).rejects.toMatchObject({ code: "textFix.draftBusy" })
    expect(db.doc!.draftMarkdown).toBe("Úplne nové znenie v príprave.")
  })

  it("minulé znenie do editora nepustí", async () => {
    await expect(loadVersionIntoDraft("SFZ", "sfz:x", "old", "kurator")).rejects.toMatchObject({ code: "textFix.pastVersion" })
  })
})
