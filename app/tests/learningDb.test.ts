/**
 * learningDb.test.ts — zápisy modulu Vzdelávanie s podvrhnutými kolekciami:
 * stráž „Označiť ako prejdené" na serveri (D119), zlúčenie sledovania videa,
 * zverejnenie jedným zápisom (D118), druhý zápis neprepíše prvý.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Course } from "../src/lib/courses"
import type { Enrollment } from "../src/lib/enrollments"

const db = vi.hoisted(() => ({
  course: null as unknown,
  completions: [] as Record<string, unknown>[],
  watch: null as Record<string, unknown> | null,
  enrollment: null as unknown,
  calls: [] as { col: string; op: string; args: unknown[] }[],
}))

function fake(name: string) {
  const log = (op: string) => (...args: unknown[]) => { db.calls.push({ col: name, op, args }); return undefined }
  return {
    findOne: async (...args: unknown[]) => {
      log("findOne")(...args)
      if (name === "courses") return db.course
      if (name === "video_watch") return db.watch
      if (name === "enrollments") return db.enrollment
      return null
    },
    find: () => ({ toArray: async () => (name === "part_completions" ? db.completions : name === "video_watch" && db.watch ? [db.watch] : []) }),
    updateOne: async (...args: unknown[]) => { log("updateOne")(...args); return { matchedCount: 1 } },
    insertOne: async (...args: unknown[]) => { log("insertOne")(...args); return {} },
  }
}

vi.mock("../src/lib/mongodb", () => ({ getCollection: async (name: string) => fake(name) }))
vi.mock("../src/lib/audit", () => ({ writeAudit: async () => {} }))
vi.mock("../src/lib/assignments", () => ({ audienceMembers: async () => [], audienceLabel: () => "" }))

import { completePart, recordVideoWatch, ProgressError } from "../src/lib/learningProgressDb"
import { publishCourse } from "../src/lib/coursesDb"
import { enrollSelf } from "../src/lib/enrollmentsDb"

const at = new Date("2026-10-01T00:00:00Z")
const baseCourse = (): Course => ({
  companyCode: "SFZ", key: "bozp", title: "BOZP", topicKey: "bozp", topicLabel: "BOZP", smartTags: [], language: "sk",
  openEnrollment: true, createdAt: at, createdBy: "jan",
  versions: [{
    versionId: "v1", version: 1, state: "published", title: "BOZP", sequential: true, issuesCertificate: false, createdAt: at, createdBy: "jan",
    parts: [
      { key: "uvod", title: "Úvod", required: true, tests: [], blocks: [
        { id: "vid", type: "video", source: { kind: "internal", assetId: "a" }, mustWatch: true, durationSec: 100 },
      ] },
      { key: "druha", title: "Druhá", required: true, tests: [], blocks: [{ id: "t", type: "text", markdown: "x" }] },
    ],
  }],
})
const enrollment: Enrollment = {
  id: "e1", companyCode: "SFZ", personId: "p", email: "p@sfz.sk", fullName: "P", courseKey: "bozp",
  versionId: "v1", courseTitle: "BOZP", enrolledAt: at, source: "self", cancelledAt: null,
}

beforeEach(() => {
  db.course = baseCourse()
  db.completions = []
  db.watch = null
  db.enrollment = null
  db.calls = []
})

describe("completePart — stráž na serveri", () => {
  it("nedopozerané povinné video nepustí, nič sa nezapíše", async () => {
    await expect(completePart({ enrollment, partKey: "uvod", allowBeforeRequiredTests: true }))
      .rejects.toMatchObject({ code: "learning.videoNotWatched" })
    expect(db.calls.some(c => c.op === "insertOne")).toBe(false)
  })

  it("zamknutá časť pri postupnom poradí", async () => {
    const err = await completePart({ enrollment, partKey: "druha", allowBeforeRequiredTests: true }).catch(e => e)
    expect(err).toBeInstanceOf(ProgressError)
    expect(err.code).toBe("learning.locked")
  })

  it("dopozerané video: zapíše dokončenie raz", async () => {
    db.watch = { partKey: "uvod", blockId: "vid", watchedRanges: [[0, 95]], durationSec: 100, updatedAt: at }
    const r = await completePart({ enrollment, partKey: "uvod", allowBeforeRequiredTests: true })
    expect(r.partKey).toBe("uvod")
    expect(db.calls.filter(c => c.op === "insertOne" && c.col === "part_completions")).toHaveLength(1)
  })

  it("už dokončená časť sa nezapíše znova", async () => {
    db.watch = { partKey: "uvod", blockId: "vid", watchedRanges: [[0, 95]], durationSec: 100, updatedAt: at }
    db.completions = [{ enrollmentId: "e1", partKey: "uvod", at }]
    await completePart({ enrollment, partKey: "uvod", allowBeforeRequiredTests: true })
    expect(db.calls.some(c => c.op === "insertOne")).toBe(false)
  })
})

describe("recordVideoWatch", () => {
  it("zlúči s doterajšími úsekmi, oreže dĺžkou z verzie a zapíše reachedAt", async () => {
    db.watch = { watchedRanges: [[0, 50]], reachedAt: null }
    const r = await recordVideoWatch({ enrollment, partKey: "uvod", blockId: "vid", ranges: [[40, 500]], durationSec: 9999 })
    expect(r).toEqual({ watchedSec: 100, watched: true })
    const sets = db.calls.filter(c => c.op === "updateOne").map(c => (c.args[1] as { $set: Record<string, unknown> }).$set)
    expect(sets[0]).toMatchObject({ watchedRanges: [[0, 100]], durationSec: 100 })
    expect(sets[1]).toHaveProperty("reachedAt")
  })

  it("blok, ktorý nie je video, odmietne", async () => {
    await expect(recordVideoWatch({ enrollment, partKey: "druha", blockId: "t", ranges: [[0, 1]] }))
      .rejects.toMatchObject({ code: "learning.blockNotFound" })
  })
})

describe("publishCourse", () => {
  it("koncept s problémom nezverejní", async () => {
    const c = baseCourse()
    c.versions.push({ ...c.versions[0], versionId: "v2", version: 2, state: "draft", parts: [] })
    db.course = c
    const r = await publishCourse("SFZ", "bozp", "jan")
    expect(r.ok).toBe(false)
    expect(db.calls.some(x => x.op === "updateOne")).toBe(false)
  })

  it("jeden zápis zverejní novú a archivuje predošlú", async () => {
    const c = baseCourse()
    c.versions.push({ ...c.versions[0], versionId: "v2", version: 2, state: "draft" })
    db.course = c
    const r = await publishCourse("SFZ", "bozp", "jan")
    expect(r.ok).toBe(true)
    const updates = db.calls.filter(x => x.op === "updateOne")
    expect(updates).toHaveLength(1)
    const set = (updates[0].args[1] as { $set: Record<string, unknown> }).$set
    expect(set["versions.$[d].state"]).toBe("published")
    expect(set["versions.$[p].state"]).toBe("archived")
  })
})

describe("enrollSelf", () => {
  it("existujúci aktívny zápis sa nemení", async () => {
    db.enrollment = enrollment
    const e = await enrollSelf("SFZ", "bozp", { id: "p", email: "p@sfz.sk", fullName: "P" })
    expect(e.versionId).toBe("v1")
    expect(db.calls.some(c => c.op === "insertOne" || c.op === "updateOne")).toBe(false)
  })

  it("zatvorený kurz odmietne", async () => {
    db.course = { ...baseCourse(), openEnrollment: false }
    await expect(enrollSelf("SFZ", "bozp", { id: "p", email: "p@sfz.sk", fullName: "P" })).rejects.toMatchObject({ code: "learning.notOpen" })
  })
})

describe("renameSmartTag — všade (MANAGE Q1)", () => {
  it("prejde kurzy, otázky aj testy vrátane filtrov sekcií", async () => {
    const { renameSmartTag } = await import("../src/lib/smartTagsDb")
    const { parseSmartTag } = await import("../src/lib/smartTags")
    const old = parseSmartTag("Bezpečnosť: Vytah")!
    const docs: Record<string, unknown[]> = {
      courses: [{ key: "bozp", smartTags: [old] }],
      questions: [{ key: "q1", smartTags: [old, parseSmartTag("Úroveň: 1")!] }],
      tests: [{ key: "t1", smartTags: [], sections: [{ filter: [old] }] }],
    }
    const mongo = await import("../src/lib/mongodb")
    const updates: { col: string; set: Record<string, unknown> }[] = []
    vi.spyOn(mongo, "getCollection").mockImplementation((async (name: string) => ({
      find: () => ({ toArray: async () => docs[name] ?? [] }),
      updateOne: async (_f: unknown, u: { $set: Record<string, unknown> }) => { updates.push({ col: name, set: u.$set }); return { matchedCount: 1 } },
    })) as never)
    const r = await renameSmartTag("SFZ", old, "Bezpečnosť: Výťah", "jan")
    expect(r).toEqual({ courses: 1, questions: 1, tests: 1 })
    expect((updates[0].set.smartTags as { label: string }[])[0].label).toBe("Bezpečnosť: Výťah")
    expect((updates[2].set.sections as { filter: { label: string }[] }[])[0].filter[0].label).toBe("Bezpečnosť: Výťah")
  })
})

describe("mergeSmartTags", () => {
  it("menej než dva tagy odmietne", async () => {
    const { mergeSmartTags } = await import("../src/lib/smartTagsDb")
    await expect(mergeSmartTags("SFZ", [{ key: "a", value: "b" }], "A: C", "jan")).rejects.toMatchObject({ code: "learning.mergeNeedsTwo" })
  })
})
