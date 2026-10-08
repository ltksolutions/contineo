/**
 * historyAnalysis.test.ts — analyza historie schranky bez zapisu (ADR-030, D180).
 *
 * Ciste casti: mesiace, slova z predmetu, mesacny suhrn z hlaviciek (nove
 * vlakno, odpoved cez hranicu mesiaca, navraty a nevyziadana posta, prah
 * pre caste slova) a suhrn obdobia s trendom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const col = { findOne: vi.fn(), updateOne: vi.fn() }
const adapter = { address: "helpdesk@futbalsfz.sk", listHeaders: vi.fn() }
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => col) }))
vi.mock("../src/lib/channels", () => ({
  channelByKey: vi.fn(async () => ({ key: "k", mailbox: { kind: "graph" } })),
  mailboxFor: vi.fn(() => adapter),
}))

import { monthsBack, monthRange, normalizeSubject, subjectTerms, summarizeMonth, summarizeAnalysis, continueAnalysis, MAX_FAILURES, type MonthStats } from "../src/lib/historyAnalysis"
import { MailboxError } from "../src/lib/mailbox/graph"
import type { MailHeader } from "../src/lib/mailbox/types"

const BOX = "helpdesk@futbalsfz.sk"
const h = (over: Partial<MailHeader>): MailHeader => ({
  threadRef: "t1", fromAddress: "a@klub.sk", subject: "Registrácia hráča", receivedAt: new Date("2026-03-10T08:00:00Z"),
  outgoing: false, folder: "other", ...over,
})
const reply = (threadRef: string, receivedAt: string): MailHeader =>
  h({ threadRef, fromAddress: BOX, outgoing: true, subject: "RE: x", receivedAt: new Date(receivedAt) })

describe("mesiace", () => {
  it("monthsBack vynecha beziaci mesiac a ide od najnovsieho, aj cez rok", () => {
    expect(monthsBack(new Date("2026-02-15T00:00:00Z"), 3)).toEqual(["2026-01", "2025-12", "2025-11"])
  })
  it("monthRange je polotvoreny interval v UTC", () => {
    const r = monthRange("2025-12")
    expect(r.start.toISOString()).toBe("2025-12-01T00:00:00.000Z")
    expect(r.end.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("predmet", () => {
  it("odstrani opakovane predpony odpovede a preposlania a ocisti osobne udaje", () => {
    expect(normalizeSubject("RE: Fw: AW: Prestup hráča")).toBe("prestup hráča")
    expect(normalizeSubject("Odp: kontakt novak@klub.sk 0905 123 456")).toBe("kontakt [e-mail] [číslo]")
  })
  it("slova a dvojice bez vyplne, cisiel a znaciek z ocistenia", () => {
    const terms = subjectTerms("RE: Otázka - prestup hráča 2026 novak@klub.sk")
    expect(terms).toContain("prestup")
    expect(terms).toContain("prestup hráča")
    expect(terms).not.toContain("otázka")
    expect(terms).not.toContain("2026")
    expect(terms).not.toContain("e-mail")
  })
})

describe("summarizeMonth", () => {
  it("nove vlakno zvonku s odpovedou v dalsom mesiaci sa pocita ako odpovedane", () => {
    const s = summarizeMonth([
      h({ threadRef: "t1", receivedAt: new Date("2026-03-31T20:00:00Z") }),
      reply("t1", "2026-04-01T08:00:00Z"),
    ], "2026-03", BOX)
    expect(s.threads).toBe(1)
    expect(s.answered).toBe(1)
    expect(s.answeredWithin24h).toBe(1)
    expect(s.medianReplyHours).toBe(12)
    // Odpoveď je z apríla — do odoslaných marca nepatrí.
    expect(s.outgoing).toBe(0)
    expect(s.incoming).toBe(1)
  })

  it("vlakno zacate pred mesiacom ani vlakno, ktore zacal helpdesk, nie je nova otazka", () => {
    const s = summarizeMonth([
      h({ threadRef: "old", receivedAt: new Date("2026-02-25T08:00:00Z") }),
      h({ threadRef: "old", receivedAt: new Date("2026-03-02T08:00:00Z") }),
      reply("ours", "2026-03-05T08:00:00Z"),
      h({ threadRef: "ours", receivedAt: new Date("2026-03-06T08:00:00Z") }),
    ], "2026-03", BOX)
    expect(s.threads).toBe(0)
    expect(s.incoming).toBe(2)
    expect(s.outgoing).toBe(1)
  })

  it("navraty, nevyziadana a odstranena posta sa do vlakien nepocitaju, kolegovia sa oznacia", () => {
    const s = summarizeMonth([
      h({ threadRef: "b", fromAddress: "mailer-daemon@x.sk", subject: "Undeliverable: x" }),
      h({ threadRef: "j", folder: "junk" }),
      h({ threadRef: "d", folder: "deleted" }),
      h({ threadRef: "i", fromAddress: "kolega@futbalsfz.sk" }),
    ], "2026-03", BOX)
    expect(s).toMatchObject({ bounces: 1, junk: 1, deleted: 1, incoming: 1, threads: 1, internalThreads: 1, answered: 0, medianReplyHours: null })
  })

  it("caste slovo prejde len pri aspon 5 vlaknach od aspon 3 roznych ludi", () => {
    const many = (subject: string, senders: string[]) =>
      senders.map((from, i) => h({ threadRef: `${subject}-${i}`, fromAddress: from, subject }))
    const s = summarizeMonth([
      // 5 vlákien od 3 ľudí → prejde
      ...many("Prestup hráča", ["a@x.sk", "b@x.sk", "c@x.sk", "a@x.sk", "b@x.sk"]),
      // 6 vlákien od jedného človeka (priezvisko v predmete) → neprejde
      ...many("Novák sťažnosť", ["z@x.sk", "z@x.sk", "z@x.sk", "z@x.sk", "z@x.sk", "z@x.sk"]),
    ], "2026-03", BOX)
    const terms = s.terms.map(t => t.term)
    expect(terms).toContain("prestup")
    expect(terms).toContain("prestup hráča")
    expect(terms).not.toContain("novák")
    expect(s.senders).toBe(4)
  })
})

describe("summarizeAnalysis", () => {
  const month = (k: string, threads: number, terms: MonthStats["terms"], median: number | null = 10): MonthStats => ({
    month: k, incoming: threads, outgoing: 0, bounces: 0, junk: 0, deleted: 0, threads, internalThreads: 0,
    answered: threads, answeredWithin24h: 0, medianReplyHours: median, senders: threads, terms,
  })
  it("scita mesiace, vynecha nespracovane a rozdeli temy na novsiu a starsiu polovicu", () => {
    const s = summarizeAnalysis({
      months: ["2026-03", "2026-02", "2026-01", "2025-12", "2025-11"],
      stats: {
        "2026-03": month("2026-03", 10, [{ term: "prestup", threads: 8 }]),
        "2026-02": month("2026-02", 10, [{ term: "prestup", threads: 6 }], 20),
        "2025-12": month("2025-12", 5, [{ term: "licencia", threads: 7 }], null),
      },
    })
    expect(s.months.map(m => m.month)).toEqual(["2026-03", "2026-02", "2025-12"])
    expect(s.threads).toBe(25)
    expect(s.medianReplyHours).toBe(15)
    expect(s.terms[0]).toEqual({ term: "prestup", threads: 14, months: 2, older: 0, newer: 14 })
    expect(s.terms[1]).toMatchObject({ term: "licencia", older: 7, newer: 0 })
    // Tri mesiace na porovnanie polovíc nestačia — trend sa neukazuje.
    expect(s.trendReady).toBe(false)
  })

  it("trend je pripraveny od 6 spracovanych mesiacov", () => {
    const keys = ["2026-06", "2026-05", "2026-04", "2026-03", "2026-02", "2026-01"]
    const s = summarizeAnalysis({ months: keys, stats: Object.fromEntries(keys.map(k => [k, month(k, 1, [])])) })
    expect(s.trendReady).toBe(true)
  })
})

describe("continueAnalysis", () => {
  const doc = (over: object = {}) => ({ companyCode: "SFZ", channelKey: "k", pending: ["2026-09", "2026-08"], failures: 0, ...over })
  beforeEach(() => {
    col.findOne.mockReset()
    col.updateOne.mockReset().mockResolvedValue({})
    adapter.listHeaders.mockReset()
  })

  it("pokus zapise pred citanim schranky, aby ho zratal aj beh zruseny casovym limitom", async () => {
    col.findOne.mockResolvedValue(doc())
    adapter.listHeaders.mockImplementation(async () => {
      // V čase čítania už musí byť pokus v databáze.
      expect(col.updateOne).toHaveBeenCalledWith({ companyCode: "SFZ", channelKey: "k" }, expect.objectContaining({ $inc: { failures: 1 } }))
      throw new MailboxError("mailbox.slow", "pomaly")
    })
    expect(await continueAnalysis("SFZ", "k", { budgetMs: 1000, hardMs: 2000 })).toBe(0)
    const last = col.updateOne.mock.calls.at(-1)![1]
    expect(last.$set.error).toBe("mailbox.slow")
    // Chyba pokus znova nepripočíta — už je zarátaný.
    expect(last.$inc).toBeUndefined()
  })

  it("prvy mesiac sa spracuje aj s minimalnym rozpoctom, uspech vynuluje pokusy", async () => {
    col.findOne.mockResolvedValue(doc({ failures: 2 }))
    // Čítanie trvá dlhšie než rozpočet — druhý mesiac sa už nezačne.
    adapter.listHeaders.mockImplementation(() => new Promise(r => setTimeout(() => r([]), 5)))
    expect(await continueAnalysis("SFZ", "k", { budgetMs: 1, hardMs: 90_000 })).toBe(1)
    const saved = col.updateOne.mock.calls.find(c => c[1].$pull)![1]
    expect(saved.$pull).toEqual({ pending: "2026-09" })
    expect(saved.$set.failures).toBe(0)
    expect(adapter.listHeaders).toHaveBeenCalledTimes(1)
  })

  it("po MAX_FAILURES pokusoch sa analyza dalej neskusa", async () => {
    col.findOne.mockResolvedValue(doc({ failures: MAX_FAILURES }))
    expect(await continueAnalysis("SFZ", "k", { budgetMs: 1000, hardMs: 2000 })).toBe(0)
    expect(adapter.listHeaders).not.toHaveBeenCalled()
    expect(col.updateOne).not.toHaveBeenCalled()
  })
})
