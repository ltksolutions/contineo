/**
 * objections.test.ts — námietka podľa čl. 21 (ADR-012, D105).
 *
 * Čo tu môže spôsobiť škodu: zmazať doklad pri zákonnej povinnosti, zmazať
 * niečo pred rozhodnutím, alebo rozhodnúť dvakrát. Testuje sa to nad malou
 * náhradou Monga, ktorá filtre naozaj vyhodnocuje.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

type Row = Record<string, unknown>
const get = (r: Row, path: string): unknown => path.split(".").reduce<unknown>((o, k) => {
  if (Array.isArray(o)) return o.map(x => (x as Row)?.[k])
  return (o as Row | undefined)?.[k]
}, r)
function matches(r: Row, f: Row): boolean {
  return Object.entries(f).every(([k, cond]) => {
    if (k === "$or") return (cond as Row[]).some(c => matches(r, c))
    const v = get(r, k)
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Row
      if ("$in" in c) return (c.$in as unknown[]).some(x => x === v)
      if ("$ne" in c) return v !== c.$ne
    }
    return Array.isArray(v) ? v.includes(cond) : v === cond
  })
}
const db = vi.hoisted(() => ({ data: {} as Record<string, Record<string, unknown>[]> }))
function collection(name: string) {
  const rows = () => (db.data[name] ??= [])
  const cursor = (list: Row[]) => ({ toArray: async () => list, sort: () => cursor(list) })
  return {
    find: (f: Row) => cursor(rows().filter(r => matches(r, f))),
    findOne: async (f: Row) => rows().find(r => matches(r, f)) ?? null,
    countDocuments: async (f: Row) => rows().filter(r => matches(r, f)).length,
    deleteMany: async (f: Row) => { db.data[name] = rows().filter(r => !matches(r, f)); return {} },
    updateOne: async (f: Row, u: { $set?: Row }) => {
      const doc = rows().find(r => matches(r, f))
      if (doc && u.$set) Object.assign(doc, u.$set)
      return { matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0 }
    },
    insertOne: async (d: Row) => { rows().push(d); return {} },
    createIndex: async () => "ok",
  }
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async (name: string) => collection(name)) }))
const audit = vi.hoisted(() => ({ writeAudit: vi.fn(async () => {}) }))
vi.mock("../src/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: audit.writeAudit,
}))

import { checkNewObjection, checkDecision, objectionScope } from "../src/lib/objections"
import { recordObjection, decideObjection } from "../src/lib/objectionsDb"

const NOW = new Date("2026-09-24T10:00:00Z")

beforeEach(() => {
  vi.clearAllMocks()
  db.data = {
    persons: [{ id: "p1", companyCode: "SFZ", email: "jan@sfz.sk", fullName: "Ján", status: "active", emailHistory: [{ email: "stary@sfz.sk" }] }],
    acknowledgements: [
      { _id: "a1", companyCode: "SFZ", personId: "p1", documentId: "etika", versionId: "v1", legalBasis: "legitimate_interest" },
      { _id: "a2", companyCode: "SFZ", personId: "p1", documentId: "bozp", versionId: "v1", legalBasis: "legal_obligation" },
      { _id: "a3", companyCode: "SFZ", personId: "p1", documentId: "stary", versionId: "v1" },
    ],
    documents: [], approval_rounds: [], document_opens: [], reading_times: [], assignments: [], objections: [], retention_log: [],
  }
})

describe("pravidlá", () => {
  it("prázdne znenie, budúci dátum a zlé rozhodnutie sa odmietnu", () => {
    expect(() => checkNewObjection({ receivedAt: NOW, channel: "email", text: " " }, NOW)).toThrow(/Chýba/)
    expect(() => checkNewObjection({ receivedAt: new Date("2026-10-01"), channel: "email", text: "x" }, NOW)).toThrow(/budúcnosti/)
    expect(() => checkDecision("maybe", "x")).toThrow()
    expect(() => checkDecision("upheld", "")).toThrow(/odôvodnenie/)
  })
  it("neznámy kanál je „inak“", () => {
    expect(checkNewObjection({ receivedAt: NOW, channel: "fax", text: "x" }, NOW).channel).toBe("other")
  })
  it("rozsah vyhovenia: len oprávnený záujem; bez základu sa počíta, nemaže", () => {
    const s = objectionScope(db.data.acknowledgements as never)
    expect([...s.versions]).toEqual(["etika|v1"])
    expect(s.unknownBasis).toBe(1)
  })
})

describe("zápis a rozhodnutie", () => {
  it("osoba sa nájde aj podľa predošlej adresy; zápis nič nemaže", async () => {
    const o = await recordObjection("SFZ", "Stary@SFZ.sk", { receivedAt: NOW, channel: "email", text: "Namietam." }, "dpo@sfz.sk", NOW)
    expect(o).toMatchObject({ personId: "p1", personName: "Ján", status: "pending" })
    expect(db.data.acknowledgements).toHaveLength(3)
    // Do auditu nejde znenie námietky.
    expect(JSON.stringify(audit.writeAudit.mock.calls)).not.toContain("Namietam")
  })

  it("osoba z inej organizácie sa nenájde", async () => {
    await expect(recordObjection("LTK", "jan@sfz.sk", { receivedAt: NOW, channel: "email", text: "x" }, "d", NOW))
      .rejects.toMatchObject({ code: "objection.personNotFound" })
  })

  it("vyhovenie zmaže len oprávnený záujem; zákonná povinnosť a neznámy základ zostanú", async () => {
    const o = await recordObjection("SFZ", "jan@sfz.sk", { receivedAt: NOW, channel: "email", text: "x" }, "d", NOW)
    const r = await decideObjection("SFZ", o.id, "upheld", "Neprevažujú závažné dôvody.", "dpo@sfz.sk", NOW)
    expect(db.data.acknowledgements.map(a => a._id).sort()).toEqual(["a2", "a3"])
    expect(r.deleted).toMatchObject({ acknowledgements: 1, unknownBasis: 1 })
    // Námietka zostáva ako doklad o rozhodnutí.
    expect(db.data.objections).toHaveLength(1)
    expect(db.data.objections[0]).toMatchObject({ status: "upheld", decidedBy: "dpo@sfz.sk" })
  })

  it("zamietnutie nemaže nič", async () => {
    const o = await recordObjection("SFZ", "jan@sfz.sk", { receivedAt: NOW, channel: "email", text: "x" }, "d", NOW)
    await decideObjection("SFZ", o.id, "rejected", "Prevažuje obhajoba nárokov.", "dpo@sfz.sk", NOW)
    expect(db.data.acknowledgements).toHaveLength(3)
  })

  it("rozhoduje sa raz", async () => {
    const o = await recordObjection("SFZ", "jan@sfz.sk", { receivedAt: NOW, channel: "email", text: "x" }, "d", NOW)
    await decideObjection("SFZ", o.id, "rejected", "a", "dpo@sfz.sk", NOW)
    await expect(decideObjection("SFZ", o.id, "upheld", "b", "dpo@sfz.sk", NOW))
      .rejects.toMatchObject({ code: "objection.notPending" })
    expect(db.data.acknowledgements).toHaveLength(3)
  })
})
