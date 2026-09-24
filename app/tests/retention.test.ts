/**
 * retention.test.ts — lehoty reťaze dôkazov (ADR-012, D100–D102).
 *
 * Pravidlá sa testujú ako čisté funkcie; výmaz nad malou náhradou Monga,
 * ktorá filtre naozaj vyhodnocuje — test, ktorý len overí, že sa zavolal
 * `deleteMany`, by nepovedal, **čo** by sa zmazalo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Náhrada Monga: rovnosť, bodkové cesty, $in, $ne ─────────────────────────
type Row = Record<string, unknown>
const get = (r: Row, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o as Row | undefined)?.[k], r)
function matches(r: Row, f: Row): boolean {
  return Object.entries(f).every(([k, cond]) => {
    const v = get(r, k)
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Row
      if ("$in" in c) return (c.$in as unknown[]).some(x => x === v)
      if ("$ne" in c) return v !== c.$ne
    }
    return v === cond
  })
}
const db = vi.hoisted(() => ({ data: {} as Record<string, Record<string, unknown>[]> }))
function collection(name: string) {
  const rows = () => (db.data[name] ??= [])
  return {
    find: (f: Row) => ({ toArray: async () => rows().filter(r => matches(r, f)) }),
    findOne: async (f: Row) => rows().find(r => matches(r, f)) ?? null,
    countDocuments: async (f: Row) => rows().filter(r => matches(r, f)).length,
    deleteMany: async (f: Row) => {
      const before = rows().length
      db.data[name] = rows().filter(r => !matches(r, f))
      return { deletedCount: before - db.data[name].length }
    },
    updateOne: async (f: Row, u: { $unset?: Row }, o?: { arrayFilters?: Row[] }) => {
      const doc = rows().find(r => matches(r, f))
      const vid = o?.arrayFilters?.[0]?.["v.versionId"]
      for (const v of (doc?.versions as Row[] | undefined) ?? []) {
        if (v.versionId !== vid) continue
        for (const k of Object.keys(u.$unset ?? {})) delete v[k.replace("versions.$[v].", "")]
      }
      return { matchedCount: doc ? 1 : 0 }
    },
    insertOne: async (d: Row) => { rows().push(d); return { acknowledged: true } },
    createIndex: async () => "ok",
    aggregate: () => ({ toArray: async () => [] }),
  }
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async (name: string) => collection(name)) }))

import {
  retentionDecision, isStaleActive, addYears, retentionMode,
} from "../src/lib/retention"
import { deletePersonEvidence } from "../src/lib/retentionDb"

const NOW = new Date("2030-06-01T00:00:00Z")
const Y = (s: string) => new Date(`${s}T00:00:00Z`)

describe("retentionDecision (D100)", () => {
  it("aktívnej osobe sa nemaže nič, ani po 20 rokoch", () => {
    expect(retentionDecision({ status: "active", lastEventAt: Y("2005-01-01") }, NOW).due).toBe(false)
  })
  it("vyradená so skončením: 3 roky od skončenia", () => {
    const d = retentionDecision({ status: "inactive", endedAt: Y("2027-05-31"), deactivatedAt: Y("2027-06-10") }, NOW)
    expect(d).toEqual({ due: true, basis: "endedAt", dueAt: Y("2030-05-31") })
  })
  it("skončenie má prednosť pred vyradením, aj keď je neskôr", () => {
    const d = retentionDecision({ status: "inactive", endedAt: Y("2027-07-01"), deactivatedAt: Y("2027-05-01") }, NOW)
    expect(d.basis).toBe("endedAt")
    expect(d.due).toBe(false)
  })
  it("bez skončenia: 3 roky od vyradenia (poistka 1)", () => {
    expect(retentionDecision({ status: "inactive", deactivatedAt: Y("2027-06-02") }, NOW))
      .toEqual({ due: false, basis: "deactivatedAt", dueAt: Y("2030-06-02") })
  })
  it("bez oboch dátumov: 5 rokov od poslednej udalosti (strop)", () => {
    expect(retentionDecision({ status: "inactive", lastEventAt: Y("2025-06-01") }, NOW))
      .toEqual({ due: true, basis: "cap", dueAt: Y("2030-06-01") })
  })
  it("vyradená bez dátumov aj bez udalosti — nie je čo mazať", () => {
    expect(retentionDecision({ status: "inactive" }, NOW)).toEqual({ due: false, basis: null, dueAt: null })
  })
})

describe("pomocné pravidlá", () => {
  it("aktívna bez udalosti 5 rokov sa ukáže HR; vyradená nie", () => {
    expect(isStaleActive({ status: "active", lastEventAt: Y("2025-05-31") }, NOW)).toBe(true)
    expect(isStaleActive({ status: "active", lastEventAt: Y("2025-06-02") }, NOW)).toBe(false)
    expect(isStaleActive({ status: "inactive", lastEventAt: Y("2000-01-01") }, NOW)).toBe(false)
  })
  it("29. február + 3 roky = 28. február", () => {
    expect(addYears(Y("2028-02-29"), 3)).toEqual(Y("2031-02-28"))
  })
  it("mazanie sa zapína len výslovne", () => {
    expect(retentionMode(undefined)).toBe("report")
    expect(retentionMode("DELETE")).toBe("delete")
    expect(retentionMode("yes")).toBe("report")
  })
})

// ── Výmaz ────────────────────────────────────────────────────────────────────
const PERSON = { id: "p1", companyCode: "SFZ", email: "jan@sfz.sk", status: "inactive" as const, emailHistory: [{ email: "Old@SFZ.sk", until: Y("2020-01-01"), changedBy: "x" }] }

function seed() {
  db.data = {
    acknowledgements: [
      { _id: "a1", companyCode: "SFZ", personId: "p1", documentId: "d-old", versionId: "v1" },
      { _id: "a2", companyCode: "SFZ", personId: "p1", documentId: "d-cur", versionId: "v2" },
      { _id: "a3", companyCode: "SFZ", personId: "p2", documentId: "d-shared", versionId: "v3" },
      { _id: "a4", companyCode: "SFZ", personId: "p1", documentId: "d-shared", versionId: "v3" },
      { _id: "a5", companyCode: "LTK", personId: "p1", documentId: "d-old", versionId: "v1" },
    ],
    document_opens: [
      { _id: "o1", companyCode: "SFZ", personId: "p1", documentId: "d-old", versionId: "v1" },
      { _id: "o2", companyCode: "SFZ", personId: "p2", documentId: "d-old", versionId: "v1" },
    ],
    reading_times: [{ _id: "r1", companyCode: "SFZ", personId: "p1", documentId: "d-old", versionId: "v1" }],
    assignments: [
      { _id: "s1", companyCode: "SFZ", audience: { kind: "person", value: "old@sfz.sk" }, subject: { documentId: "d-old", versionId: "v1" } },
      { _id: "s2", companyCode: "SFZ", audience: { kind: "group", value: "jan@sfz.sk" }, subject: { documentId: "d-old", versionId: "v1" } },
      { _id: "s3", companyCode: "SFZ", audience: { kind: "person", value: "iny@sfz.sk" }, subject: { documentId: "d-old", versionId: "v1" } },
    ],
    approval_rounds: [
      { _id: "k1", companyCode: "SFZ", documentId: "d-old", versionId: "v1" },
      { _id: "k2", companyCode: "SFZ", documentId: "d-cur", versionId: "v2" },
      { _id: "k3", companyCode: "SFZ", documentId: "d-shared", versionId: "v3" },
    ],
    documents: [
      { companyCode: "SFZ", documentId: "d-old", versions: [
        { versionId: "v1", isActive: false, effectiveFrom: Y("2020-01-01"), effectiveTo: Y("2021-01-01"), responsiblePerson: { personId: "g" }, responsibleChanges: [{}] },
        { versionId: "v9", isActive: true, effectiveFrom: Y("2021-01-01"), effectiveTo: null },
      ] },
      { companyCode: "SFZ", documentId: "d-cur", versions: [
        { versionId: "v2", isActive: true, effectiveFrom: Y("2020-01-01"), effectiveTo: null, responsiblePerson: { personId: "g" } },
      ] },
    ],
    objections: [
      { _id: "n1", companyCode: "SFZ", personId: "p1" },
      { _id: "n2", companyCode: "SFZ", personId: "p2" },
    ],
    retention_log: [],
  }
}

beforeEach(seed)

describe("deletePersonEvidence (D101)", () => {
  it("výkaz spočíta, ale nezmaže nič a nezapíše záznam o výmaze", async () => {
    const c = await deletePersonEvidence(PERSON, "endedAt", "report", NOW)
    expect(c).toEqual({ acknowledgements: 3, documentOpens: 1, readingTimes: 1, assignments: 1, approvalRounds: 1, responsibleCleared: 1, objections: 1 })
    expect(db.data.acknowledgements).toHaveLength(5)
    expect(db.data.retention_log).toHaveLength(0)
  })

  it("výmaz: doklady osoby zmiznú, cudzie a inej organizácie zostanú", async () => {
    await deletePersonEvidence(PERSON, "endedAt", "delete", NOW)
    expect(db.data.acknowledgements.map(a => a._id).sort()).toEqual(["a3", "a5"])
    expect(db.data.document_opens.map(o => o._id)).toEqual(["o2"])
    expect(db.data.reading_times).toHaveLength(0)
  })

  it("pridelenie osobe (aj na starú adresu) zmizne, skupine a inému človeku zostane", async () => {
    await deletePersonEvidence(PERSON, "endedAt", "delete", NOW)
    expect(db.data.assignments.map(a => a._id).sort()).toEqual(["s2", "s3"])
  })

  it("kolo a zodpovedná osoba neplatného znenia bez dokladov zmiznú (B4a, B11)", async () => {
    await deletePersonEvidence(PERSON, "endedAt", "delete", NOW)
    const ids = db.data.approval_rounds.map(k => k._id).sort()
    expect(ids).not.toContain("k1")
    const v1 = (db.data.documents[0].versions as Row[])[0]
    expect(v1.responsiblePerson).toBeUndefined()
    expect(v1.responsibleChanges).toBeUndefined()
  })

  it("platné znenie si kolo aj zodpovednú osobu drží (D27)", async () => {
    await deletePersonEvidence(PERSON, "endedAt", "delete", NOW)
    expect(db.data.approval_rounds.map(k => k._id)).toContain("k2")
    expect((db.data.documents[1].versions as Row[])[0].responsiblePerson).toBeDefined()
  })

  it("kolo znenia, ku ktorému má doklad ešte niekto iný, zostane", async () => {
    await deletePersonEvidence(PERSON, "endedAt", "delete", NOW)
    expect(db.data.approval_rounds.map(k => k._id)).toContain("k3")
  })

  it("záznam o výmaze bez mena a adresy", async () => {
    await deletePersonEvidence(PERSON, "cap", "delete", NOW)
    expect(db.data.retention_log).toHaveLength(1)
    const log = db.data.retention_log[0]
    expect(log).toMatchObject({ companyCode: "SFZ", personId: "p1", reason: "cap", at: NOW })
    expect(JSON.stringify(log)).not.toContain("@")
  })

  it("obmedzenie na znenia (námietka) zmaže len vybrané a námietku nechá", async () => {
    await deletePersonEvidence(PERSON, "objection", "delete", NOW, new Set(["d-old|v1"]))
    expect(db.data.acknowledgements.map(a => a._id).sort()).toEqual(["a2", "a3", "a4", "a5"])
    expect(db.data.objections).toHaveLength(2)
  })

  it("po lehote zmizne aj námietka osoby, cudzia zostane (D105)", async () => {
    await deletePersonEvidence(PERSON, "endedAt", "delete", NOW)
    expect(db.data.objections.map(o => o._id)).toEqual(["n2"])
  })
})
