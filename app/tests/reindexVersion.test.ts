/**
 * reindexVersion.test.ts — preindexovanie jedného znenia sa dotkne len jeho
 * úsekov (fáza 2 „znení na karte dokumentu").
 *
 * Doterajšie `reindex()` vyraďovalo aktívne úseky celého dokumentu a nové
 * označilo ako aktívne. Pustené na staršie znenie by vyrobilo dve aktívne
 * členenia a prepísalo `chunkingId` dokumentu. Kolekcia úsekov je tu
 * v pamäti a filtre sa naozaj vyhodnocujú, aby bolo vidieť stav po zápise.
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
  docUpdates: [] as unknown[],
}))

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
        findOne: async () => db.doc,
        updateOne: async (_f: Row, u: unknown) => { db.docUpdates.push(u); return { matchedCount: 1 } },
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

import { reindex, reindexAllVersions, reindexVersion, LibraryError } from "../src/lib/libraryWrite"

const text = (lehota: number) =>
  `Článok 1\nÚčel\nToto je poriadok.\n\nČlánok 2\nLehoty\nLehota je ${lehota} dní.\n\nČlánok 3\nZáver\nKoniec.`

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const OLD = { versionId: "v-old", label: "znenie účinné od 1. 1. 2024", isActive: false, effectiveFrom: d("2024-01-01"), effectiveTo: d("2026-07-01"), markdown: text(15) }
const CUR = { versionId: "v-cur", label: "znenie účinné od 1. 7. 2026", isActive: true, effectiveFrom: d("2026-07-01"), effectiveTo: null, markdown: text(30) }

/** Úseky znenia v stave „narezané starou verziou chunkera" (iný `chunkingId`). */
const stale = (versionId: string, isActive: boolean) => [1, 2, 3].map(n => ({
  companyCode: "SFZ", documentId: "sfz:x", versionId, isActive, superseded: false,
  chunkingId: "stary", articleRef: `čl. ${n}`, text: `úsek ${n}`,
}))

beforeEach(() => {
  db.chunks = [...stale("v-old", false), ...stale("v-cur", true)]
  db.doc = { documentId: "sfz:x", companyCode: "SFZ", title: "Poriadok", chunkingId: "stary", versions: [OLD, CUR] }
  db.docUpdates = []
  vi.clearAllMocks()
})

const of = (versionId: string, over: Row = {}) => db.chunks.filter(r => matches(r, { versionId, ...over }))

describe("reindexVersion — staršie znenie", () => {
  it("nahradí len jeho členenie, nové úseky nie sú aktívne, platné znenie sa nedotkne", async () => {
    const r = await reindexVersion("SFZ", "sfz:x", "v-old", "kurator")
    expect(r.alreadyDone).toBe(false)
    expect(r.archived).toBe(0)
    // Staré členenie staršieho znenia je nahradené, nové je platné a neaktívne.
    expect(of("v-old", { chunkingId: "stary" }).every(c => c.superseded === true)).toBe(true)
    const fresh = of("v-old", { superseded: false })
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.every(c => c.isActive === false)).toBe(true)
    expect(fresh[0].effectiveFrom).toEqual(OLD.effectiveFrom)
    // Platné znenie a jediné aktívne členenie dokumentu ostali ako boli.
    expect(of("v-cur").every(c => c.chunkingId === "stary" && c.isActive === true && c.superseded === false)).toBe(true)
    expect(db.chunks.filter(c => c.isActive === true).every(c => c.versionId === "v-cur")).toBe(true)
    // `chunkingId` dokumentu patrí naposledy zverejnenému — nemení sa.
    expect(JSON.stringify(db.docUpdates)).not.toContain("chunkingId")
    expect(audit.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ note: expect.stringContaining(OLD.label) }))
  })

  it("druhé spustenie nič nezapíše — rovnaké členenie", async () => {
    await reindexVersion("SFZ", "sfz:x", "v-old", "kurator")
    const count = db.chunks.length
    const r = await reindexVersion("SFZ", "sfz:x", "v-old", "kurator")
    expect(r.alreadyDone).toBe(true)
    expect(db.chunks.length).toBe(count)
  })
})

describe("reindex — naposledy zverejnené znenie ako doteraz", () => {
  it("vyradí jeho aktívne úseky, nové sú aktívne, dokument dostane chunkingId", async () => {
    const r = await reindex("SFZ", "sfz:x", "kurator")
    expect(r.archived).toBe(3)
    const fresh = of("v-cur", { superseded: false })
    expect(fresh.every(c => c.isActive === true)).toBe(true)
    expect(of("v-cur", { chunkingId: "stary" }).every(c => c.isActive === false && c.superseded === true)).toBe(true)
    // Staršie znenie sa nedotklo.
    expect(of("v-old").every(c => c.chunkingId === "stary" && c.superseded === false)).toBe(true)
    expect(JSON.stringify(db.docUpdates)).toContain(r.chunkingId)
  })
})

describe("odmietnutia", () => {
  it("znenie bez uloženého textu — text najnovšieho sa nepodstrčí", async () => {
    db.doc = { ...db.doc!, markdown: text(30), versions: [{ ...OLD, markdown: undefined }, CUR] }
    await expect(reindexVersion("SFZ", "sfz:x", "v-old", "kurator")).rejects.toMatchObject({ code: "library.versionHasNoText" })
  })

  it("poistka článkov počíta len toto znenie", async () => {
    // Staršie znenie bez hlavičiek „Článok" — po narezaní by nemalo články.
    db.doc = { ...db.doc!, versions: [{ ...OLD, markdown: "Len súvislý text bez článkov, ktorý sa nedá rozdeliť." }, CUR] }
    await expect(reindexVersion("SFZ", "sfz:x", "v-old", "kurator")).rejects.toBeInstanceOf(LibraryError)
    // Platné znenie tým nie je dotknuté.
    expect(of("v-cur").every(c => c.chunkingId === "stary")).toBe(true)
  })

  it("neznáme znenie", async () => {
    await expect(reindexVersion("SFZ", "sfz:x", "v-nic", "kurator")).rejects.toMatchObject({ code: "library.versionNotFound" })
  })
})

describe("reindexAllVersions", () => {
  it("preindexuje všetky znenia a jedno odmietnuté nezastaví ostatné", async () => {
    db.doc = { ...db.doc!, versions: [{ ...OLD, markdown: undefined }, CUR] }
    const r = await reindexAllVersions("SFZ", "sfz:x", "kurator")
    expect(r.done.map(x => x.label)).toEqual([CUR.label])
    expect(r.refused.map(x => x.label)).toEqual([OLD.label])
    expect(r.unchanged).toBe(0)
  })
})
