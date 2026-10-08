/**
 * faqHarvest.test.ts — tazba FAQ z historie schranky (ADR-030, D183–D186).
 *
 * Ciste casti: vyber vlakien mesiaca (kolegovia, namietka, bez odpovede,
 * navraty), triedenie do tem, zlucenie tem, vyber vlakien pre navrh,
 * prevod navrhu modelu. Ziadne volanie modelu ani schranky.
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import {
  harvestItems, harvestCandidates, addressHash, applyClassification, applyMerge, pickThreads, parseDraft, draftThread, classifyPrompt,
  NO_TOPIC, type HarvestItem, type HarvestTopic,
} from "../src/lib/faqHarvest"
import type { MailMessage, MailHeader } from "../src/lib/mailbox/types"

const BOX = "helpdesk@futbalsfz.sk"
const msg = (over: Partial<MailMessage>): MailMessage => ({
  id: "m", internetMessageId: null, threadRef: "t1", from: { address: "a@klub.sk", name: "A" }, to: [],
  subject: "Obnova hesla", text: "Ako si obnovím heslo? Som hráč 1234567.", receivedAt: new Date("2026-03-10T08:00:00Z"),
  outgoing: false, attachments: [], ...over,
})
const answer = (threadRef: string, at: string, text = "Použite Zabudnuté heslo.") =>
  msg({ threadRef, outgoing: true, from: { address: BOX, name: null }, text, receivedAt: new Date(at) })

describe("harvestItems", () => {
  it("berie len vlakna zvonku s odpovedou, otazku ocisti a skrati", () => {
    const { items, skips } = harvestItems([
      msg({ threadRef: "ok" }), answer("ok", "2026-03-11T08:00:00Z"),
      msg({ threadRef: "kolega", from: { address: "x@futbalsfz.sk", name: null } }), answer("kolega", "2026-03-11T08:00:00Z"),
      msg({ threadRef: "bez" }),
      msg({ threadRef: "namietka", from: { address: "Namietka@Klub.sk", name: null } }), answer("namietka", "2026-03-11T08:00:00Z"),
      msg({ threadRef: "navrat", from: { address: "mailer-daemon@x.sk", name: null }, subject: "Undeliverable: x" }),
      msg({ threadRef: "vcera", receivedAt: new Date("2026-02-27T08:00:00Z") }), answer("vcera", "2026-03-01T08:00:00Z"),
    ], "2026-03", BOX, new Set([addressHash("namietka@klub.sk")]))
    expect(items.map(i => i.threadRef)).toEqual(["ok"])
    expect(items[0].question).toContain("[číslo]")
    expect(items[0].question).not.toContain("1234567")
    expect(skips).toEqual({ colleague: 1, excluded: 1, unanswered: 1 })
  })
})

describe("harvestCandidates", () => {
  const h = (over: Partial<MailHeader>): MailHeader => ({
    threadRef: "t1", fromAddress: "a@klub.sk", subject: "Obnova hesla", receivedAt: new Date("2026-03-10T08:00:00Z"), outgoing: false, folder: "other", ...over,
  })
  const reply = (threadRef: string, at = "2026-03-11T08:00:00Z") => h({ threadRef, fromAddress: BOX, outgoing: true, receivedAt: new Date(at) })
  it("z hlaviciek vyberie len vlakna zvonku s odpovedou; automaticke upozornenia helpdesku nie", () => {
    const { refs, skips } = harvestCandidates([
      h({ threadRef: "ok" }), reply("ok", "2026-04-02T08:00:00Z"),
      // tisíce upozornení ISSF odoslaných z adresy helpdesku — vlákno začal helpdesk
      ...Array.from({ length: 50 }, (_, i) => h({ threadRef: `issf${i}`, fromAddress: BOX, outgoing: true })),
      h({ threadRef: "kolega", fromAddress: "x@futbalsfz.sk" }), reply("kolega"),
      h({ threadRef: "bez" }),
      h({ threadRef: "spam", folder: "junk" }), reply("spam"),
      h({ threadRef: "namietka", fromAddress: "namietka@klub.sk" }), reply("namietka"),
    ], "2026-03", BOX, new Set([addressHash("namietka@klub.sk")]))
    expect(refs).toEqual(["ok"])
    expect(skips).toEqual({ colleague: 1, excluded: 1, unanswered: 1 })
  })
})

describe("applyClassification", () => {
  const items: HarvestItem[] = ["a", "b", "c", "d"].map(r => ({ threadRef: r, askedAt: new Date(), lastAnswerAt: new Date(), subject: "", question: "" }))
  it("existujuca tema, nova tema (rovnaky nazov raz), nie otazka a chybajuca odpoved", () => {
    let seq = 0
    const r = applyClassification({ assignments: [
      { item: 1, topic: "t0001", newLabel: "", newDescription: "" },
      { item: 2, topic: "new", newLabel: "Predĺženie licencie", newDescription: "Ako predĺžiť licenciu trénera." },
      { item: 3, topic: "new", newLabel: "predĺženie licencie", newDescription: "" },
      { item: 9, topic: "t0001", newLabel: "", newDescription: "" },
    ] }, items, [{ key: "t0001", label: "Obnova hesla", description: "" }], () => `n${++seq}`)
    expect(r.topicOf.get("a")).toBe("t0001")
    expect(r.topicOf.get("b")).toBe("n1")
    expect(r.topicOf.get("c")).toBe("n1")
    expect(r.topicOf.get("d")).toBe(NO_TOPIC)
    expect(r.created).toEqual([{ key: "n1", label: "Predĺženie licencie", description: "Ako predĺžiť licenciu trénera." }])
  })
  it("neznamy kluc padne na _none; prompt nesie existujuce temy", () => {
    const r = applyClassification({ assignments: [{ item: 1, topic: "t9999", newLabel: "", newDescription: "" }] }, items.slice(0, 1), [], () => "x")
    expect(r.topicOf.get("a")).toBe(NO_TOPIC)
    expect(classifyPrompt([{ key: "t0001", label: "Obnova hesla", description: "zabudnuté heslo" }], items.slice(0, 1))).toContain("t0001 — Obnova hesla: zabudnuté heslo")
  })
})

describe("applyMerge", () => {
  const topic = (key: string, threads: number): HarvestTopic => ({ key, label: key, description: "", threads, firstMonth: null, lastMonth: null, proposals: null })
  it("zluci pod najvacsiu temu, scita vlakna, vynechane ostanu, duplicitny kluc patri prvej skupine", () => {
    const r = applyMerge({ topics: [
      { keys: ["a", "b"], label: "Heslo", description: "Obnova hesla" },
      { keys: ["b", "zzz"], label: "Iné", description: "" },
    ] }, [topic("a", 2), topic("b", 10), topic("c", 4)])
    expect(r.mapping.get("a")).toBe("b")
    expect(r.mapping.get("b")).toBe("b")
    expect(r.mapping.get("c")).toBe("c")
    expect(r.merged.map(t => [t.key, t.label, t.threads])).toEqual([["b", "Heslo", 12], ["c", "c", 4]])
  })
  it("necitatelna odpoved necha temy tak, ako su", () => {
    expect(applyMerge(null, [topic("a", 1)]).merged.map(t => t.key)).toEqual(["a"])
  })
})

describe("navrh za temu", () => {
  it("pickThreads: 6 najnovsich a 2 najstarsie", () => {
    const threads = Array.from({ length: 12 }, (_, i) => ({ id: i, askedAt: new Date(Date.UTC(2024, i, 1)) }))
    expect(pickThreads(threads).map(t => t.id)).toEqual([11, 10, 9, 8, 7, 6, 0, 1])
    expect(pickThreads(threads.slice(0, 3)).map(t => t.id)).toEqual([2, 1, 0])
  })
  it("draftThread ocisti otazku aj odpovede a bez odpovede vrati null", () => {
    const t = draftThread([msg({}), answer("t1", "2026-03-11T08:00:00Z", "Napíšte na jan@novak.sk.")])
    expect(t?.question).not.toContain("1234567")
    expect(t?.answers[0].text).toBe("Napíšte na [e-mail].")
    expect(draftThread([msg({})])).toBeNull()
  })
  it("parseDraft: najviac 3 zaznamy, zdroje v rozsahu, bez otazky vynecha", () => {
    const e = { question: "Ako obnovím heslo?", variants: ["zabudol som heslo"], answer: "Kliknite na Zabudnuté heslo.", audience: ["hráč"], sources: [1, 7], changedOverTime: true, normConflict: false, note: "Do 2024 sa heslo menilo cez matriku." }
    const out = parseDraft({ entries: [e, { ...e, question: "" }, e, e, e] }, 2)
    expect(out).toHaveLength(2)
    expect(out[0].sourceIndexes).toEqual([1])
    expect(out[0].changedOverTime).toBe(true)
  })
})
