/**
 * courier.test.ts — Kuriér (ADR-033): vlákno, odpoveď, prečítanie, počet.
 *
 * Náhrada Monga tu vyhodnocuje filtre aj `$set` s `arrayFilters` a `$pull`,
 * lebo práve tie dve operácie držia `unreadFor` a `lastReadAt` v zhode —
 * test, ktorý by len overil, že sa zavolal `updateOne`, by nepovedal, či
 * po otvorení vlákna číslo na obálke naozaj klesne.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ObjectId } from "mongodb"

type Row = Record<string, unknown>
const get = (r: Row, path: string): unknown => path.split(".").reduce<unknown>((o, k) => (o as Row | undefined)?.[k], r)
const same = (v: unknown, x: unknown): boolean => {
  if (x instanceof ObjectId) return v instanceof ObjectId && v.equals(x)
  if (Array.isArray(v) && !Array.isArray(x)) return v.some(e => same(e, x))
  return v === x
}
function matches(r: Row, f: Row): boolean {
  return Object.entries(f).every(([k, cond]) => {
    const v = get(r, k)
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !(cond instanceof ObjectId) && !Array.isArray(cond)) {
      const c = cond as Row
      if ("$ne" in c) return Array.isArray(v) && Array.isArray(c.$ne) ? v.length !== (c.$ne as unknown[]).length : !same(v, c.$ne)
      if ("$in" in c) return (c.$in as unknown[]).some(x => same(v, x))
      if ("$elemMatch" in c) return Array.isArray(v) && v.some(e => matches(e as Row, c.$elemMatch as Row))
    }
    if (k.includes(".")) {
      // `participants.personId` — pole dokumentov: zhoda v ktoromkoľvek prvku.
      const [head, ...rest] = k.split(".")
      const arr = r[head]
      if (Array.isArray(arr)) return arr.some(e => matches(e as Row, { [rest.join(".")]: cond }))
    }
    return same(v, cond)
  })
}
const db = vi.hoisted(() => ({ data: {} as Record<string, Row[]> }))
function cursor(rows: Row[]) {
  let out = rows
  const c = {
    sort: (s: Row) => { const [[k, dir]] = Object.entries(s); out = [...out].sort((a, b) => ((get(a, k) as Date).getTime() - (get(b, k) as Date).getTime()) * (dir as number)); return c },
    skip: (n: number) => { out = out.slice(n); return c },
    limit: (n: number) => { out = out.slice(0, n); return c },
    toArray: async () => out,
  }
  return c
}
/** `$set` s `arrayFilters` (`participants.$[x].pole`) a `$pull` — ako Mongo. */
function apply(doc: Row, u: { $set?: Row; $pull?: Row }, o?: { arrayFilters?: Row[] }) {
  for (const [k, v] of Object.entries(u.$set ?? {})) {
    const m = /^participants\.\$\[(\w+)\]\.(\w+)$/.exec(k)
    if (m) {
      const filter = o?.arrayFilters?.find(af => Object.keys(af)[0].startsWith(`${m[1]}.`)) ?? {}
      const sub = Object.fromEntries(Object.entries(filter).map(([fk, fv]) => [fk.slice(m[1].length + 1), fv]))
      for (const p of doc.participants as Row[]) if (matches(p, sub)) p[m[2]] = v
    } else doc[k] = v
  }
  for (const [k, v] of Object.entries(u.$pull ?? {})) doc[k] = (doc[k] as unknown[]).filter(x => x !== v)
}
function collection(name: string) {
  const rows = () => (db.data[name] ??= [])
  return {
    createIndex: async () => "ok",
    insertOne: async (d: Row) => { const _id = new ObjectId(); rows().push({ ...d, _id }); return { insertedId: _id } },
    findOne: async (f: Row) => rows().find(r => matches(r, f)) ?? null,
    find: (f: Row) => cursor(rows().filter(r => matches(r, f))),
    countDocuments: async (f: Row) => rows().filter(r => matches(r, f)).length,
    updateOne: async (f: Row, u: { $set?: Row; $pull?: Row }, o?: { arrayFilters?: Row[] }) => {
      const doc = rows().find(r => matches(r, f))
      if (!doc) return { matchedCount: 0 }
      apply(doc, u, o)
      return { matchedCount: 1 }
    },
    updateMany: async (f: Row, u: { $set?: Row; $pull?: Row }, o?: { arrayFilters?: Row[] }) => {
      const hit = rows().filter(r => matches(r, f))
      for (const doc of hit) apply(doc, u, o)
      return { modifiedCount: hit.length }
    },
  }
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async (name: string) => collection(name)) }))
const audit = vi.hoisted(() => ({ rows: [] as Row[] }))
vi.mock("../src/lib/audit", () => ({ writeAudit: vi.fn(async (r: Row) => { audit.rows.push(r) }) }))

import {
  createDirectThread, postMessage, markThreadRead, unreadThreadCount, listThreads, loadThread, threadMessages,
  previewOf, validateContent, CourierError, createAnnouncement, replyToAnnouncement, readStats,
  pendingDigests, markDigested,
} from "../src/lib/courier"

const anna = { personId: "p-anna", email: "anna@sfz.sk", name: "Anna Nová" }
const peter = { personId: "p-peter", email: "peter@sfz.sk", name: "Peter Malý" }
const t0 = new Date("2026-10-12T08:00:00Z")
const later = (min: number) => new Date(t0.getTime() + min * 60_000)

beforeEach(() => { db.data = {}; audit.rows = [] })

describe("previewOf / validateContent", () => {
  it("ukážka je prvý neprázdny riadok bez značiek, najviac 120 znakov", () => {
    expect(previewOf("\n\n## **Dôležité**: [rozpis](/library/x) súťaží\nďalší")).toBe("Dôležité: rozpis súťaží")
    expect(previewOf("a".repeat(200))).toHaveLength(120)
  })
  it("prázdny predmet alebo text sa neposiela", () => {
    expect(() => validateContent("  ", "x")).toThrow(CourierError)
    expect(() => validateContent("x", " \n ")).toThrow(CourierError)
    expect(validateContent("  Rozpis   súťaží ", "text\r\n")).toEqual({ subject: "Rozpis súťaží", text: "text" })
  })
})

describe("1:1 vlákno", () => {
  it("odosielateľ má prečítané, adresát nie; audit nesie predmet, nie text", async () => {
    const id = await createDirectThread({ companyCode: "SFZ", from: anna, to: peter, subject: "Rozpis", text: "Tajný text", now: t0 })
    expect(await unreadThreadCount("SFZ", "p-peter")).toBe(1)
    expect(await unreadThreadCount("SFZ", "p-anna")).toBe(0)
    const a = audit.rows[0]
    expect(a).toMatchObject({ subject: "courier", action: "odoslane", actor: "anna@sfz.sk", targetId: id, targetLabel: "Rozpis" })
    expect(JSON.stringify(a)).not.toContain("Tajný")
  })

  it("sebe sa nepíše", async () => {
    await expect(createDirectThread({ companyCode: "SFZ", from: anna, to: anna, subject: "x", text: "y" })).rejects.toThrow(CourierError)
  })

  it("cudzie vlákno je „nie je“ aj v inej organizácii", async () => {
    const id = await createDirectThread({ companyCode: "SFZ", from: anna, to: peter, subject: "Rozpis", text: "t" })
    expect(await loadThread("SFZ", id, "p-cudzi")).toBeNull()
    expect(await loadThread("LTK", id, "p-peter")).toBeNull()
    expect(await loadThread("SFZ", id, "p-peter")).not.toBeNull()
    expect(await loadThread("SFZ", "nie-objectid", "p-peter")).toBeNull()
  })

  it("otvorenie vlákna vyradí z neprečítaných; odpoveď ho tam vráti druhej strane", async () => {
    const id = await createDirectThread({ companyCode: "SFZ", from: anna, to: peter, subject: "Rozpis", text: "t", now: t0 })
    await markThreadRead("SFZ", id, "p-peter", later(5))
    expect(await unreadThreadCount("SFZ", "p-peter")).toBe(0)

    await postMessage({ companyCode: "SFZ", threadId: id, author: peter, text: "Odpoveď", now: later(10) })
    expect(await unreadThreadCount("SFZ", "p-anna")).toBe(1)
    expect(await unreadThreadCount("SFZ", "p-peter")).toBe(0)

    const thread = (await loadThread("SFZ", id, "p-anna"))!
    expect(thread.lastMessage).toEqual({ authorName: "Peter Malý", preview: "Odpoveď" })
    expect(thread.participants.find(p => p.personId === "p-peter")?.lastReadAt).toEqual(later(10))
    const msgs = await threadMessages("SFZ", id)
    expect(msgs.map(m => m.text)).toEqual(["t", "Odpoveď"])
  })

  it("odpovedať smie len účastník", async () => {
    const id = await createDirectThread({ companyCode: "SFZ", from: anna, to: peter, subject: "Rozpis", text: "t" })
    await expect(postMessage({ companyCode: "SFZ", threadId: id, author: { personId: "p-cudzi", email: "c@sfz.sk", name: "C" }, text: "x" }))
      .rejects.toThrow(CourierError)
  })

  it("zoznam: najnovšie hore, druhá strana ako protistrana, neprečítané označené", async () => {
    const a = await createDirectThread({ companyCode: "SFZ", from: anna, to: peter, subject: "Prvé", text: "1", now: t0 })
    const b = await createDirectThread({ companyCode: "SFZ", from: peter, to: anna, subject: "Druhé", text: "2", now: later(1) })
    const { rows, hasMore } = await listThreads("SFZ", "p-anna")
    expect(hasMore).toBe(false)
    expect(rows.map(r => [r.id, r.subject, r.counterpart, r.unread])).toEqual([
      [b, "Druhé", "Peter Malý", true],
      [a, "Prvé", "Peter Malý", false],
    ])
  })
})

describe("oznam (D204–D206)", () => {
  const jana = { personId: "p-jana", email: "jana@sfz.sk", name: "Jana Veľká" }
  const audiences = [{ kind: "department" as const, value: "d1", label: "Matrika" }]
  const recipients = [peter, jana]

  it("príjemcovia neprečítané, autor áno; audit nesie publikum a počet, nie mená", async () => {
    const id = await createAnnouncement({ companyCode: "SFZ", from: anna, audiences, recipients, subject: "Rozpis", text: "Tajný", now: t0 })
    expect(await unreadThreadCount("SFZ", "p-peter")).toBe(1)
    expect(await unreadThreadCount("SFZ", "p-anna")).toBe(0)
    const a = audit.rows.at(-1)!
    expect(a).toMatchObject({ action: "oznam", targetId: id, targetLabel: "Rozpis", note: `oddelenie „Matrika" a jeho podriadené · 2` })
    expect(JSON.stringify(a)).not.toContain("Tajný")
    expect(JSON.stringify(a)).not.toContain("Peter")
    const thread = (await loadThread("SFZ", id, "p-anna"))!
    expect(thread.recipients).toBe(2)
    expect(readStats(thread)).toEqual({ read: 0, total: 2 })
  })

  it("bez príjemcov alebo nad 500 sa oznam neuloží", async () => {
    await expect(createAnnouncement({ companyCode: "SFZ", from: anna, audiences, recipients: [], subject: "x", text: "y" })).rejects.toThrow(CourierError)
    const many = Array.from({ length: 501 }, (_, i) => ({ personId: `p${i}`, email: `p${i}@sfz.sk`, name: `P${i}` }))
    await expect(createAnnouncement({ companyCode: "SFZ", from: anna, audiences, recipients: many, subject: "x", text: "y" })).rejects.toThrow(/priveľa/)
  })

  it("odpoveď príjemcu ide súkromne autorovi do 1:1 vlákna; druhá do toho istého; autor dopĺňa všetkým", async () => {
    const id = await createAnnouncement({ companyCode: "SFZ", from: anna, audiences, recipients, subject: "Rozpis", text: "t", now: t0 })
    await markThreadRead("SFZ", id, "p-peter", later(1))
    const r1 = await replyToAnnouncement({ companyCode: "SFZ", threadId: id, author: peter, text: "Otázka", now: later(2) })
    expect(r1).not.toBe(id)
    const direct = (await loadThread("SFZ", r1, "p-anna"))!
    expect(direct).toMatchObject({ kind: "direct", subject: "Re: Rozpis", parentThreadId: id })
    expect(direct.participants.map(p => p.personId).sort()).toEqual(["p-anna", "p-peter"])
    // Jana odpoveď Petra nevidí.
    expect(await loadThread("SFZ", r1, "p-jana")).toBeNull()

    const r2 = await replyToAnnouncement({ companyCode: "SFZ", threadId: id, author: peter, text: "Ešte", now: later(3) })
    expect(r2).toBe(r1)
    expect((await threadMessages("SFZ", r1)).map(m => m.text)).toEqual(["Otázka", "Ešte"])

    const r3 = await replyToAnnouncement({ companyCode: "SFZ", threadId: id, author: anna, text: "Doplnenie", now: later(4) })
    expect(r3).toBe(id)
    expect(await unreadThreadCount("SFZ", "p-jana")).toBe(1)
    expect(readStats((await loadThread("SFZ", id, "p-anna"))!)).toEqual({ read: 0, total: 2 })
  })
})

describe("ranný súhrn (D207)", () => {
  it("len neprečítané vlákna, ktoré v súhrne ešte neboli; po označení nič; nová správa ich vráti", async () => {
    const a = await createDirectThread({ companyCode: "SFZ", from: anna, to: peter, subject: "Prvé", text: "1", now: t0 })
    const b = await createDirectThread({ companyCode: "SFZ", from: anna, to: peter, subject: "Druhé", text: "2", now: later(1) })
    await markThreadRead("SFZ", b, "p-peter", later(2))

    const pending = await pendingDigests("SFZ")
    expect(pending.map(p => [p.personId, p.items.map(i => i.subject)])).toEqual([["p-peter", ["Prvé"]]])
    expect(pending[0].items[0]).toMatchObject({ threadId: a, from: "Anna Nová" })
    // Anna nemá nič neprečítané — nedostane nič.
    expect(pending.some(p => p.personId === "p-anna")).toBe(false)

    await markDigested("SFZ", "p-peter", [a], later(3))
    expect(await pendingDigests("SFZ")).toEqual([])

    await postMessage({ companyCode: "SFZ", threadId: a, author: anna, text: "Ešte niečo", now: later(4) })
    expect((await pendingDigests("SFZ")).map(p => p.items.map(i => i.subject))).toEqual([["Prvé"]])
  })
})
