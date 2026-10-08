/**
 * retention.test.ts — lehoty reťaze dôkazov (ADR-012, D100–D102).
 *
 * Pravidlá sa testujú ako čisté funkcie; výmaz nad malou náhradou Monga,
 * ktorá filtre naozaj vyhodnocuje — test, ktorý len overí, že sa zavolal
 * `deleteMany`, by nepovedal, **čo** by sa zmazalo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Náhrada Monga: rovnosť, bodkové cesty, $in, $ne, $exists, $lte; null = chýba ──
type Row = Record<string, unknown>
const get = (r: Row, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o as Row | undefined)?.[k], r)
const same = (v: unknown, x: unknown) => (x === null ? v === null || v === undefined : v === x)
function matches(r: Row, f: Row): boolean {
  return Object.entries(f).every(([k, cond]) => {
    if (k === "$or") return (cond as Row[]).some(sub => matches(r, sub))
    const v = get(r, k)
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Row
      if ("$in" in c) return (c.$in as unknown[]).some(x => x === v)
      if ("$ne" in c) return !same(v, c.$ne)
      if ("$exists" in c) return (v !== undefined) === c.$exists
      if ("$lte" in c) return v instanceof Date && v.getTime() <= (c.$lte as Date).getTime()
      if ("$lt" in c) return v instanceof Date && v.getTime() < (c.$lt as Date).getTime()
    }
    return same(v, cond)
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
    updateOne: async (f: Row, u: { $unset?: Row; $set?: Row }, o?: { arrayFilters?: Row[] }) => {
      const doc = rows().find(r => matches(r, f))
      if (doc && u.$set) Object.assign(doc, u.$set)
      const vid = o?.arrayFilters?.[0]?.["v.versionId"]
      for (const v of (doc?.versions as Row[] | undefined) ?? []) {
        if (v.versionId !== vid) continue
        for (const k of Object.keys(u.$unset ?? {})) delete v[k.replace("versions.$[v].", "")]
      }
      return { matchedCount: doc ? 1 : 0 }
    },
    updateMany: async (f: Row, u: { $set?: Row; $unset?: Row }) => {
      const hit = rows().filter(r => matches(r, f))
      for (const r of hit) {
        if (u.$set) Object.assign(r, u.$set)
        for (const k of Object.keys(u.$unset ?? {})) delete r[k]
      }
      return { modifiedCount: hit.length }
    },
    insertOne: async (d: Row) => { rows().push(d); return { acknowledged: true } },
    createIndex: async () => "ok",
    aggregate: () => ({ toArray: async () => [] }),
  }
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async (name: string) => collection(name)) }))

import {
  retentionDecision, isStaleActive, addYears, retentionMode, addMonths, learningDetailsDue, retentionSettings,
} from "../src/lib/retention"
import { deletePersonEvidence, trimLearningDetails, purgeAnswers, purgeTickets, purgeExternalPersons } from "../src/lib/retentionDb"
import { courseProgress, type ProgressFacts } from "../src/lib/learningProgress"

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
    expect(c).toEqual({ acknowledgements: 3, documentOpens: 1, readingTimes: 1, assignments: 1, approvalRounds: 1, responsibleCleared: 1, objections: 1, enrollments: 0, partCompletions: 0, videoWatch: 0, testAttempts: 0, answers: 0, tickets: 0, externalPersons: 0 })
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

// ── Vzdelávanie (ADR-021) ────────────────────────────────────────────────────

describe("vzdelávanie po lehote osoby (D130, D132)", () => {
  beforeEach(() => {
    db.data.enrollments = [{ companyCode: "SFZ", id: "e1", personId: "p1" }, { companyCode: "SFZ", id: "e2", personId: "p2" }]
    db.data.part_completions = [{ companyCode: "SFZ", personId: "p1", enrollmentId: "e1" }, { companyCode: "LTK", personId: "p1", enrollmentId: "x" }]
    db.data.video_watch = [{ companyCode: "SFZ", personId: "p1", enrollmentId: "e1" }]
    db.data.test_attempts = [{ companyCode: "SFZ", personId: "p1", id: "t1" }, { companyCode: "SFZ", personId: "p2", id: "t2" }]
    db.data.certificates = [{ companyCode: "SFZ", personId: "p1", holderName: "Ján", registrationNumber: "SFZ-2026-0001" }]
  })

  it("výkaz spočíta, nezmaže", async () => {
    const c = await deletePersonEvidence(PERSON, "endedAt", "report", NOW)
    expect([c.enrollments, c.partCompletions, c.videoWatch, c.testAttempts]).toEqual([1, 1, 1, 1])
    expect(db.data.enrollments).toHaveLength(2)
  })
  it("výmaz: záznamy osoby zmiznú, cudzie a inej organizácie zostanú; certifikát celý zostane", async () => {
    await deletePersonEvidence(PERSON, "endedAt", "delete", NOW)
    expect(db.data.enrollments.map(e => e.id)).toEqual(["e2"])
    expect(db.data.part_completions.map(r => r.companyCode)).toEqual(["LTK"])
    expect(db.data.video_watch).toHaveLength(0)
    expect(db.data.test_attempts.map(t => t.id)).toEqual(["t2"])
    expect(db.data.certificates).toEqual([{ companyCode: "SFZ", personId: "p1", holderName: "Ján", registrationNumber: "SFZ-2026-0001" }])
  })
  it("námietka k predpisom sa vzdelávania netýka", async () => {
    const c = await deletePersonEvidence(PERSON, "objection", "delete", NOW)
    expect(c.enrollments + c.testAttempts).toBe(0)
    expect(db.data.enrollments).toHaveLength(2)
  })
})

describe("orezanie podrobností rok po dokončení (D131)", () => {
  const at = (s: string) => new Date(`${s}T10:00:00Z`)
  const TRIM_NOW = at("2028-01-15")
  const part = { key: "a", title: "A", required: true, tests: [{ testKey: "t", required: true }],
    blocks: [{ id: "v", type: "video", source: { kind: "internal", assetId: "x" }, mustWatch: true, durationSec: 100 }] }
  const enrollment = (id: string, over: Row = {}) => ({ companyCode: "SFZ", id, personId: `p-${id}`, courseKey: "k", versionId: "v1", enrolledAt: at("2026-01-01"), cancelledAt: null, ...over })
  const done = (id: string, when: string) => {
    db.data.part_completions.push({ companyCode: "SFZ", enrollmentId: id, partKey: "a", at: at(when) })
    db.data.video_watch.push({ companyCode: "SFZ", enrollmentId: id, partKey: "a", blockId: "v", watchedRanges: [[0, 100]], durationSec: 100, reachedAt: at(when), updatedAt: at(when) })
    db.data.test_attempts.push({ companyCode: "SFZ", id: `t-${id}`, context: { enrollmentId: id, partKey: "a" }, testKey: "t", passed: true, resetAt: null,
      submittedAt: at(when), percent: 90, questions: [{ questionKey: "q" }], answers: { q: { kind: "choice", ids: ["x"] } } })
  }
  const factsOf = (id: string): ProgressFacts => ({
    completions: db.data.part_completions.filter(r => r.enrollmentId === id) as never,
    watches: db.data.video_watch.filter(r => r.enrollmentId === id) as never,
    passedTests: db.data.test_attempts.filter(r => (r.context as Row).enrollmentId === id && r.passed).map(r => ({ partKey: "a", testKey: "t", at: r.submittedAt as Date })),
  })

  beforeEach(() => {
    db.data.courses = [{ companyCode: "SFZ", key: "k", versions: [{ versionId: "v1", version: 1, state: "published", title: "K", parts: [part], sequential: false }] }]
    db.data.enrollments = [enrollment("old"), enrollment("recent"), enrollment("open"), enrollment("cancelled", { cancelledAt: at("2026-02-01") })]
    db.data.part_completions = []
    db.data.video_watch = []
    db.data.test_attempts = []
    done("old", "2026-11-01")      // dokončený 14 mesiacov pred TRIM_NOW
    done("recent", "2027-06-01")   // dokončený 7 mesiacov pred — ešte nie
    done("cancelled", "2026-01-15")
    // Rozpracovaný: video do polovice, bez dokončenia — neorezáva sa nikdy.
    db.data.video_watch.push({ companyCode: "SFZ", enrollmentId: "open", partKey: "a", blockId: "v", watchedRanges: [[0, 50]], durationSec: 100, reachedAt: null, updatedAt: at("2026-02-01") })
  })

  it("pravidlo: len dokončený a 12 mesiacov po dokončení", () => {
    expect(learningDetailsDue(null, TRIM_NOW)).toBe(false)
    expect(learningDetailsDue(at("2027-01-15"), TRIM_NOW)).toBe(true)
    expect(learningDetailsDue(at("2027-01-16"), TRIM_NOW)).toBe(false)
    expect(addMonths(at("2027-03-31"), -1).toISOString().slice(0, 10)).toBe("2027-02-28")
  })

  it("výkaz spočíta, nič nezmení", async () => {
    const c = await trimLearningDetails("SFZ", "report", TRIM_NOW)
    expect(c).toEqual({ enrollments: 1, testAttempts: 1, videoWatchTrimmed: 1, videoWatchDeleted: 0 })
    expect((db.data.test_attempts[0].questions as unknown[]).length).toBe(1)
  })

  it("ostro: odpovede a úseky preč, výsledok a dopozeranie zostanú, kurz je stále dokončený", async () => {
    const before = courseProgress((db.data.courses[0].versions as never[])[0], factsOf("old"))
    await trimLearningDetails("SFZ", "delete", TRIM_NOW)
    const t = db.data.test_attempts.find(r => r.id === "t-old")!
    expect(t).toMatchObject({ questions: [], answers: {}, percent: 90, passed: true, detailsPurgedAt: TRIM_NOW })
    const w = db.data.video_watch.find(r => r.enrollmentId === "old")!
    expect(w).toMatchObject({ watchedRanges: [], reachedAt: at("2026-11-01"), detailsPurgedAt: TRIM_NOW })
    const after = courseProgress((db.data.courses[0].versions as never[])[0], factsOf("old"))
    expect(after.done).toBe(true)
    expect(after.completedAt).toEqual(before.completedAt)
    expect(db.data.enrollments.find(e => e.id === "old")!.detailsPurgedAt).toEqual(TRIM_NOW)
    expect(db.data.retention_log.at(-1)).toMatchObject({ personId: "p-old", reason: "details" })
  })

  it("nedávno dokončený, rozpracovaný a zrušený zápis sa neorežú; druhý beh nerobí nič", async () => {
    await trimLearningDetails("SFZ", "delete", TRIM_NOW)
    expect(db.data.test_attempts.find(r => r.id === "t-recent")!.detailsPurgedAt).toBeUndefined()
    expect(db.data.test_attempts.find(r => r.id === "t-cancelled")!.detailsPurgedAt).toBeUndefined()
    expect(db.data.video_watch.find(r => r.enrollmentId === "open")!.watchedRanges).toEqual([[0, 50]])
    expect(await trimLearningDetails("SFZ", "delete", TRIM_NOW)).toEqual({ enrollments: 0, testAttempts: 0, videoWatchTrimmed: 0, videoWatchDeleted: 0 })
  })
})

describe("lehoty organizácie (ADR-022, D136)", () => {
  it("predvolené = rozhodnutia DPO SFZ; strop nie kratší než lehota; rozsahy", () => {
    expect(retentionSettings(undefined)).toEqual({ evidenceYears: 3, capYears: 5, learningDetailMonths: 12, answersMonths: 12, ticketMonths: 24 })
    // Tickety helpdesku (D178): 1–120 mesiacov od zavretia.
    expect(retentionSettings({ ticketMonths: 500 }).ticketMonths).toBe(120)
    expect(retentionSettings({ ticketMonths: 0 }).ticketMonths).toBe(24)
    // Otázky a odpovede (ASK-historia-otazok, H2): 1–60 mesiacov.
    expect(retentionSettings({ answersMonths: 99 }).answersMonths).toBe(60)
    expect(retentionSettings({ answersMonths: 0 }).answersMonths).toBe(12)
    expect(retentionSettings({ evidenceYears: 7, capYears: 4 })).toMatchObject({ evidenceYears: 7, capYears: 7 })
    expect(retentionSettings({ evidenceYears: 99, learningDetailMonths: 0 })).toMatchObject({ evidenceYears: 10, learningDetailMonths: 12 })
  })
  it("rozhodnutie a orezanie podľa lehôt organizácie", () => {
    const p = { status: "inactive" as const, endedAt: Y("2028-06-01") }
    expect(retentionDecision(p, NOW).due).toBe(false)
    expect(retentionDecision(p, NOW, { evidenceYears: 2, capYears: 5, learningDetailMonths: 12, answersMonths: 12, ticketMonths: 24 }).due).toBe(true)
    expect(learningDetailsDue(Y("2030-01-01"), NOW, 6)).toBe(false)
    expect(learningDetailsDue(Y("2029-11-01"), NOW, 6)).toBe(true)
  })
})

describe("otázky a odpovede po lehote (ASK-historia-otazok, H2)", () => {
  const seedAnswers = () => {
    db.data.evaluations = [
      { _id: "e1", companyCode: "SFZ", askedBy: "p1", reviewer: "p1", createdAt: Y("2029-01-01"), question: "stará" },
      { _id: "e2", companyCode: "SFZ", askedBy: "p1", createdAt: Y("2030-06-01"), question: "nová" },
      { _id: "e3", companyCode: "SFZ", askedBy: "p1", reviewer: "ev", readerNoteBy: "p1", createdAt: Y("2029-01-01"), question: "kurovaná", curation: { state: "published" } },
      { _id: "e4", companyCode: "INY", askedBy: "p9", createdAt: Y("2029-01-01"), question: "cudzia" },
    ]
    db.data.retention_log = []
  }

  it("výkaz spočíta, nezmaže nič", async () => {
    seedAnswers()
    expect(await purgeAnswers("SFZ", "report", NOW, 12)).toEqual({ deleted: 1, detached: 1 })
    expect(db.data.evaluations).toHaveLength(4)
  })

  it("výmaz: staré zmizne, kurované stratí väzbu na osobu, cudzia organizácia ostane", async () => {
    seedAnswers()
    await purgeAnswers("SFZ", "delete", NOW, 12)
    expect(db.data.evaluations.map(e => e._id).sort()).toEqual(["e2", "e3", "e4"])
    const curated = db.data.evaluations.find(e => e._id === "e3")!
    expect(curated.askedBy).toBeUndefined()
    expect(curated.reviewer).toBeUndefined()
    expect(curated.readerNoteBy).toBeUndefined()
    expect(curated.curation).toEqual({ state: "published" })
    expect(db.data.retention_log).toHaveLength(1)
    expect(db.data.retention_log[0]).toMatchObject({ companyCode: "SFZ", personId: null, reason: "answers" })
  })
})

describe("helpdesk po lehote (ADR-028, D178)", () => {
  beforeEach(() => {
    db.data = {
      tickets: [
        { companyCode: "SFZ", id: "t-old", state: "closed", closedAt: Y("2028-01-01"), asker: { personId: "x-old" } },
        { companyCode: "SFZ", id: "t-recent", state: "closed", closedAt: Y("2029-01-01"), asker: { personId: "x-recent" } },
        { companyCode: "SFZ", id: "t-open", state: "new", closedAt: null, asker: { personId: "x-open" } },
        { companyCode: "SFZ", id: "t-reopened", state: "reopened", closedAt: Y("2027-01-01"), asker: { personId: "x-open" } },
        { companyCode: "INY", id: "t-foreign", state: "closed", closedAt: Y("2020-01-01"), asker: { personId: "y" } },
      ],
      persons: [
        { companyCode: "SFZ", id: "x-old", personType: "external", lastLoginAt: Y("2028-01-01"), createdAt: Y("2027-01-01") },
        { companyCode: "SFZ", id: "x-recent", personType: "external", lastLoginAt: Y("2029-01-01"), createdAt: Y("2027-01-01") },
        { companyCode: "SFZ", id: "x-open", personType: "external", lastLoginAt: Y("2027-01-01"), createdAt: Y("2027-01-01") },
        { companyCode: "SFZ", id: "x-ack", personType: "external", createdAt: Y("2027-01-01") },
        { companyCode: "SFZ", id: "e-old", personType: "employee", lastLoginAt: Y("2020-01-01"), createdAt: Y("2020-01-01") },
      ],
      acknowledgements: [{ companyCode: "SFZ", personId: "x-ack" }],
      retention_log: [],
    }
  })

  it("zavretý ticket po 24 mesiacoch od zavretia zmizne; otvorený, znova otvorený a cudzí nie", async () => {
    expect(await purgeTickets("SFZ", "report", NOW)).toBe(1)
    expect(db.data.tickets).toHaveLength(5)
    expect(await purgeTickets("SFZ", "delete", NOW)).toBe(1)
    expect(db.data.tickets.map(t => t.id)).toEqual(["t-recent", "t-open", "t-reopened", "t-foreign"])
    expect(db.data.retention_log.at(-1)).toMatchObject({ reason: "tickets" })
  })

  it("osoba z widgetu bez aktivity 24 mesiacov zmizne; s otvoreným ticketom, s potvrdením a zamestnanec nie", async () => {
    expect(await purgeExternalPersons("SFZ", "report", NOW)).toBe(1)
    expect(await purgeExternalPersons("SFZ", "delete", NOW)).toBe(1)
    expect(db.data.persons.map(p => p.id)).toEqual(["x-recent", "x-open", "x-ack", "e-old"])
    expect(db.data.retention_log.at(-1)).toMatchObject({ reason: "external" })
  })
})
