/**
 * documentArchive.test.ts — archivácia predpisu (ADR-025, D156).
 *
 * Pravidlá (kedy sa nedá), zápis koncu platnosti so záznamom, odvolanie
 * pridelení dňom účinnosti (hneď alebo v dennom behu) a obnovenie platnosti.
 * Databáza je v pamäti; `versions.$[v]` sa naozaj zapíše.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

type Row = Record<string, unknown>
const d = (s: string) => new Date(`${s}T00:00:00Z`)

const db = vi.hoisted(() => ({
  doc: null as Record<string, unknown> | null,
  roundOpen: false,
  assignments: [] as { _id: string; revokedAt: Date | null }[],
}))

function applyDocUpdate(u: { $set?: Row; $push?: Row }, opts?: { arrayFilters?: Row[] }): number {
  const doc = db.doc!
  const vf = opts?.arrayFilters?.[0] ?? {}
  const version = (doc.versions as Row[]).find(v =>
    v.versionId === vf["v.versionId"] && (!("v.effectiveTo" in vf) || v.effectiveTo == null))
  if (!version) return 0
  const af = opts?.arrayFilters?.[1]
  // Ako Mongo: zhodné prvky sa určia raz, pred zápisom — nie po každom poli.
  const hits = ((version.archives as Row[]) ?? []).filter(a => Object.entries(af ?? {}).every(([fk, fv]) => {
    const key = fk.slice(2)
    return fv === null ? a[key] == null : (a[key] instanceof Date && fv instanceof Date ? a[key].getTime() === fv.getTime() : a[key] === fv)
  }))
  for (const [k, val] of Object.entries(u.$set ?? {})) {
    if (k.startsWith("versions.$[v].archives.$[a].")) {
      const field = k.slice("versions.$[v].archives.$[a].".length)
      for (const a of hits) a[field] = val
    } else if (k.startsWith("versions.$[v].")) version[k.slice(14)] = val
    else doc[k] = val
  }
  for (const [k, val] of Object.entries(u.$push ?? {})) {
    const field = k.slice(14)
    version[field] = [...((version[field] as unknown[]) ?? []), val]
  }
  return 1
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (name: string) => {
    if (name === "documents") {
      return {
        findOne: async () => (db.doc ? structuredClone(db.doc) : null),
        updateOne: async (_f: Row, u: { $set?: Row; $push?: Row }, opts?: { arrayFilters?: Row[] }) => ({ modifiedCount: applyDocUpdate(u, opts) }),
        find: () => ({ toArray: async () => (db.doc ? [structuredClone(db.doc)] : []) }),
      }
    }
    if (name === "approval_rounds") return { findOne: async () => (db.roundOpen ? { outcome: null } : null) }
    if (name === "assignments") {
      return { find: () => ({ toArray: async () => db.assignments.filter(a => a.revokedAt === null).map(a => ({ _id: a._id })) }) }
    }
    return { findOne: async () => null }
  }),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

const spies = vi.hoisted(() => ({
  writeAudit: vi.fn(async () => {}),
  expireCurationFor: vi.fn(async () => 0),
  revoke: vi.fn(async (_c: string, id: string) => {
    const a = db.assignments.find(x => x._id === id && x.revokedAt === null)
    if (a) a.revokedAt = new Date()
    return Boolean(a)
  }),
}))
vi.mock("../src/lib/audit", async orig => ({ ...(await orig<typeof import("../src/lib/audit")>()), writeAudit: spies.writeAudit }))
vi.mock("../src/lib/curation", () => ({ expireCurationFor: spies.expireCurationFor }))
vi.mock("../src/lib/assignments", () => ({ ASSIGNMENTS_COLLECTION: "assignments", revoke: spies.revoke }))

import { archiveProblem, archiveDocument, restoreDocument, settleArchivedDocuments } from "../src/lib/documentArchive"
import { archiveState } from "../src/lib/documentArchiveState"
import { effectiveVersion } from "../src/lib/documents"

const NOW = d("2026-10-02")
const CUR = { versionId: "v1", label: "1.0", isActive: true, effectiveFrom: d("2026-01-01"), effectiveTo: null, markdown: "Text." }
const base = () => ({ companyCode: "SFZ", documentId: "sfz:x", title: "Smernica X", markdown: "Text.", versions: [structuredClone(CUR)] })

beforeEach(() => {
  vi.clearAllMocks()
  db.doc = base()
  db.roundOpen = false
  db.assignments = [{ _id: "a1", revokedAt: null }, { _id: "a2", revokedAt: null }]
})

describe("kedy sa archivovať nedá", () => {
  const problem = (over: Row = {}, until = d("2026-12-31"), reason = "Zrušené uznesením VV.") =>
    archiveProblem({ doc: { ...base(), ...over } as never, until, reason, roundOpen: Boolean(over.roundOpen), now: NOW })

  it("platné znenie bez prekážok — dá sa", () => expect(problem()).toBeNull())
  it("bez dôvodu nie", () => expect(problem({}, d("2026-12-31"), "  ")).toBe("no-reason"))
  it("dátum pred začiatkom platnosti nie", () => expect(problem({}, d("2025-12-31"))).toBe("date-before-start"))
  it("rozpracované nové znenie nie", () => expect(problem({ draftMarkdown: "Iný text." })).toBe("draft"))
  it("koncept zhodný s platným textom prekážkou nie je", () => expect(problem({ draftMarkdown: "Text." })).toBeNull())
  it("bežiace kolo schvaľovania nie", () => expect(problem({ roundOpen: true })).toBe("round-open"))
  it("novela vopred nie — zverejnenie by archiváciu prebilo", () => {
    const old = { ...CUR, isActive: false, effectiveTo: d("2099-01-01") }
    const next = { ...CUR, versionId: "v2", effectiveFrom: d("2099-01-01") }
    expect(problem({ versions: [old, next] })).toBe("upcoming")
  })
})

describe("archivácia k dnešku", () => {
  it("koniec platnosti a záznam pri znení; pridelenia odvolané, overené odpovede ukončené, audit", async () => {
    const r = await archiveDocument({ companyCode: "SFZ", documentId: "sfz:x", until: d("2026-10-02"), reason: "Zrušené.", actor: "jan@sfz.sk", now: NOW })
    expect(r).toEqual({ inEffect: true, revoked: 2 })
    const v = (db.doc!.versions as Row[])[0]
    expect(v.effectiveTo).toEqual(d("2026-10-02"))
    expect(v.isActive).toBe(true)
    expect((v.archives as Row[])[0]).toMatchObject({ by: "jan@sfz.sk", reason: "Zrušené.", settledAt: NOW })
    expect(spies.expireCurationFor).toHaveBeenCalledWith("SFZ", "sfz:x", NOW)
    expect(spies.writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "archived", note: "Zrušené." }))
    // Predpis odvtedy neplatí — asistent, pridelenie aj výkaz DPO ho vynechajú.
    expect(effectiveVersion(db.doc as never, NOW).ok).toBe(false)
    expect(archiveState(db.doc as never, NOW)).toMatchObject({ archived: true, inEffect: true })
  })

  it("druhá archivácia neprejde", async () => {
    await archiveDocument({ companyCode: "SFZ", documentId: "sfz:x", until: NOW, reason: "A", actor: "j", now: NOW })
    await expect(archiveDocument({ companyCode: "SFZ", documentId: "sfz:x", until: NOW, reason: "B", actor: "j", now: NOW }))
      .rejects.toMatchObject({ code: "archive.already-archived" })
  })
})

describe("archivácia v budúcnosti", () => {
  it("dovtedy platí a pridelenia ostávajú; denný beh ich odvolá v deň účinnosti, raz", async () => {
    const r = await archiveDocument({ companyCode: "SFZ", documentId: "sfz:x", until: d("2026-12-31"), reason: "K 31. 12.", actor: "j", now: NOW })
    expect(r).toEqual({ inEffect: false, revoked: 0 })
    expect(effectiveVersion(db.doc as never, NOW).ok).toBe(true)
    expect(archiveState(db.doc as never, NOW)).toMatchObject({ archived: true, inEffect: false })

    expect(await settleArchivedDocuments("SFZ", d("2026-12-30"))).toBe(0)
    expect(db.assignments.every(a => a.revokedAt === null)).toBe(true)

    expect(await settleArchivedDocuments("SFZ", d("2026-12-31"))).toBe(2)
    db.assignments.push({ _id: "a3", revokedAt: null })
    expect(await settleArchivedDocuments("SFZ", d("2027-01-01"))).toBe(0)
  })
})

describe("obnovenie platnosti", () => {
  it("zruší koniec platnosti, záznam uzavrie a nezmaže; audit", async () => {
    await archiveDocument({ companyCode: "SFZ", documentId: "sfz:x", until: NOW, reason: "Omyl.", actor: "j", now: NOW })
    await restoreDocument({ companyCode: "SFZ", documentId: "sfz:x", actor: "k", now: NOW })
    const v = (db.doc!.versions as Row[])[0]
    expect(v.effectiveTo).toBeNull()
    expect((v.archives as Row[])).toHaveLength(1)
    expect((v.archives as Row[])[0]).toMatchObject({ restoredBy: "k", restoredAt: NOW })
    expect(effectiveVersion(db.doc as never, NOW).ok).toBe(true)
    expect(archiveState(db.doc as never, NOW)).toEqual({ archived: false })
    expect(spies.writeAudit).toHaveBeenLastCalledWith(expect.objectContaining({ action: "validity-restored" }))
  })

  it("nearchivovaný predpis obnoviť nejde", async () => {
    await expect(restoreDocument({ companyCode: "SFZ", documentId: "sfz:x", actor: "k", now: NOW }))
      .rejects.toMatchObject({ code: "archive.not-archived" })
  })
})
