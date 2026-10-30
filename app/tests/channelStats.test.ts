/**
 * channelStats.test.ts — štatistika kanála (KANAL-statistika, 30. 10. 2026).
 *
 * Kalendárne obdobia v čase SFZ (týždeň od pondelka, prechod letného času),
 * súhrn otázok, hodnotení, ticketov a ceny za obdobie.
 */

import { describe, expect, it, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))
vi.mock("../src/lib/session", () => ({ currentTenant: vi.fn(), currentPerson: vi.fn() }))

import { statRange, shiftRange, statPeriod, summarize, percentile, costGroup, zonedInstant, type ChannelStatsData } from "../src/lib/channelStats"

const NOW = new Date("2026-10-30T10:00:00Z") // piatok

describe("obdobie", () => {
  it("týždeň začína pondelkom o polnoci v Bratislave", () => {
    const r = statRange("week", undefined, NOW)
    expect(r.at).toBe("2026-10-26")
    expect(r.last).toEqual({ year: 2026, month: 10, day: 1 })
    // 26. 10. je už zimný čas (UTC+1).
    expect(r.start.toISOString()).toBe("2026-10-25T23:00:00.000Z")
    expect(r.buckets).toHaveLength(7)
  })

  it("deň s prechodom na zimný čas má 25 hodín, stĺpcov je 24 podľa hodín na hodinách", () => {
    const r = statRange("day", "2026-10-25", NOW)
    expect(r.start.toISOString()).toBe("2026-10-24T22:00:00.000Z")
    expect(r.end.toISOString()).toBe("2026-10-25T23:00:00.000Z")
    expect(r.buckets).toHaveLength(24)
  })

  it("mesiac a rok; nečitateľný alebo neexistujúci deň = dnes", () => {
    expect(statRange("month", "2026-02-17", NOW)).toMatchObject({ at: "2026-02-01", last: { year: 2026, month: 1, day: 28 } })
    expect(statRange("month", "2026-02-17", NOW).buckets).toHaveLength(28)
    expect(statRange("year", "2026-07-04", NOW).buckets).toHaveLength(12)
    expect(statRange("month", "2026-02-31", NOW).at).toBe("2026-10-01")
    expect(statRange("week", "kedysi", NOW).at).toBe("2026-10-26")
  })

  it("posun o obdobie dozadu aj cez prelom roka", () => {
    expect(shiftRange(statRange("week", "2026-01-01", NOW), -1).at).toBe("2025-12-22")
    expect(shiftRange(statRange("month", "2026-01-15", NOW), -1).at).toBe("2025-12-01")
    expect(shiftRange(statRange("year", undefined, NOW), -12).at).toBe("2014-01-01")
    expect(shiftRange(statRange("day", "2026-03-01", NOW), -1).at).toBe("2026-02-28")
  })

  it("neznáme obdobie z adresy je týždeň", () => {
    expect(statPeriod("month")).toBe("month")
    expect(statPeriod("decade")).toBe("week")
    expect(statPeriod(undefined)).toBe("week")
  })

  it("polnoc v lete je o 22:00 UTC", () => {
    expect(zonedInstant(2026, 6, 1).toISOString()).toBe("2026-06-30T22:00:00.000Z")
  })
})

const at = (s: string) => new Date(s)
const data: ChannelStatsData = {
  ratings: [
    { createdAt: at("2026-10-27T08:00:00Z"), readerVerdict: 1, correct: 1, hallucination: 0, evaluatedAt: at("2026-10-28T08:00:00Z") },
    { createdAt: at("2026-10-27T09:00:00Z"), readerVerdict: 0, correct: null, hallucination: null },
    { createdAt: at("2026-10-28T09:00:00Z"), readerNote: "chýba § 12", correct: 0, hallucination: 1, evaluatedAt: at("2026-10-29T08:00:00Z") },
    { createdAt: at("2026-10-28T10:00:00Z"), correct: null, hallucination: null, dismissedAt: at("2026-10-29T08:00:00Z") },
    // mimo obdobia
    { createdAt: at("2026-10-20T10:00:00Z"), readerVerdict: 1, correct: null, hallucination: null },
  ] as ChannelStatsData["ratings"],
  unanswered: [at("2026-10-29T10:00:00Z"), at("2026-11-03T10:00:00Z")],
  tickets: [
    { createdAt: at("2026-10-27T08:00:00Z"), closedAt: at("2026-10-28T08:00:00Z"), messages: [
      { direction: "in", at: at("2026-10-27T08:00:00Z") }, { direction: "out", at: at("2026-10-27T10:00:00Z") },
      { direction: "in", at: at("2026-10-29T08:00:00Z") },
    ] },
    { createdAt: at("2026-10-28T08:00:00Z"), closedAt: null, messages: [
      { direction: "in", at: at("2026-10-28T08:00:00Z") }, { direction: "out", at: at("2026-10-28T14:00:00Z") },
    ] },
    // import histórie: vznikol teraz, prvá správa je stará — patrí do starého obdobia
    { createdAt: at("2026-10-29T08:00:00Z"), closedAt: null, messages: [{ direction: "in", at: at("2026-09-01T08:00:00Z") }] },
  ],
  usage: [
    { at: at("2026-10-27T08:00:00Z"), purpose: "answer", usd: 0.5, tokens: { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0 } },
    { at: at("2026-10-27T09:00:00Z"), purpose: "answer", subject: "ticket: Prestup", usd: 0.25, tokens: { input: 500, output: 100, cacheRead: 0, cacheWrite: 0 } },
    { at: at("2026-10-27T09:00:00Z"), purpose: "query-rewrite", usd: 0.01, tokens: { input: 50, output: 10, cacheRead: 0, cacheWrite: 0 } },
  ] as ChannelStatsData["usage"],
}

describe("súhrn obdobia", () => {
  const r = statRange("week", "2026-10-26", NOW)
  const s = summarize(data, r.start, r.end)

  it("otázky = zodpovedané + nenašlo sa", () => {
    expect(s).toMatchObject({ questions: 5, answered: 4, unanswered: 1 })
  })

  it("hodnotenie používateľov: poznámka sa ráta ako Nesedí", () => {
    expect(s.reader).toEqual({ fits: 1, doesNotFit: 2, none: 1 })
  })

  it("posudky: vyradené sa nečakajú, Nesedí bez posudku čaká", () => {
    expect(s.verdicts).toEqual({ correct: 1, wrong: 1, hallucination: 1, dismissed: 1, pending: 1 })
  })

  it("tickety: prijaté podľa prvej správy, medián čakania, znovu sa ozval", () => {
    expect(s.tickets).toMatchObject({ received: 2, answered: 2, closed: 1, reopened: 1 })
    expect(s.tickets.medianMs).toBe(2 * 3600_000)
    expect(s.tickets.p90Ms).toBe(6 * 3600_000)
  })

  it("cena: návrh odpovede na ticket je vlastná skupina", () => {
    expect(s.cost.usd).toBeCloseTo(0.76)
    expect(s.cost.calls).toBe(3)
    expect(s.cost.byGroup.answer.usd).toBeCloseTo(0.5)
    expect(s.cost.byGroup["ticket-draft"]).toEqual({ usd: 0.25, tokens: 600 })
    expect(s.cost.tokens).toBe(1860)
  })
})

describe("pomocné", () => {
  it("percentil podľa poradia", () => {
    expect(percentile([], 0.5)).toBeNull()
    expect(percentile([5, 1, 3], 0.5)).toBe(3)
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9)
  })
  it("skupina ceny", () => {
    expect(costGroup({ purpose: "answer" })).toBe("answer")
    expect(costGroup({ purpose: "answer", subject: "ticket: X" })).toBe("ticket-draft")
    expect(costGroup({ purpose: "faq-mining" })).toBe("faq-mining")
    expect(costGroup({ purpose: "pdf-rewrite" })).toBe("other")
  })
})

import { channelStatsSheets } from "../src/lib/channelStatsExport"
import { delta, formatDuration, rangeHistory, rangeTitle } from "../src/lib/channelStatsView"

describe("zobrazenie a export", () => {
  it("názov obdobia a trvanie", () => {
    expect(rangeTitle(statRange("week", "2026-10-26", NOW), "sk")).toMatch(/^Týždeň 26\. 10\. – 1\. 11\. 2026$/)
    expect(rangeTitle(statRange("year", "2026-10-26", NOW), "sk")).toBe("2026")
    expect(formatDuration(45 * 60_000, "sk")).toBe("45 min")
    expect(formatDuration(200 * 60_000, "sk")).toBe("3 h 20 min")
    expect(formatDuration(28 * 3600_000, "sk")).toBe("1 d 4 h")
    expect(formatDuration(null, "sk")).toBe("—")
  })

  it("zmena: farba hovorí, či je to lepšie; bez porovnania sa nehodnotí", () => {
    expect(delta(0.9, 0.8, "points", "up", "sk")).toEqual({ text: "▲ 10 b.", tone: "is-better" })
    expect(delta(7, 5, "usd", "down", "sk").tone).toBe("is-worse")
    expect(delta(36, 30, "share", null, "sk")).toEqual({ text: "▲ 20 % oproti 30", tone: "is-same" })
    expect(delta(3, 3, "count", "up", "sk").text).toBe("— ako minule")
    expect(delta(null, 0.5, "points", "up", "sk").text).toBe("— bez porovnania")
    expect(delta(2 * 3600_000, 3 * 3600_000, "duration", "down", "sk")).toEqual({ text: "▼ 1 h rýchlejšie", tone: "is-better" })
  })

  it("export: hárok na blok, 13 období v stĺpcoch; bez ceny pre riešiteľa", () => {
    const ranges = rangeHistory(statRange("week", "2026-10-26", NOW), 12)
    expect(ranges).toHaveLength(13)
    expect(ranges[12].at).toBe("2026-10-26")
    const admin = channelStatsSheets(data, ranges, { withCost: true, language: "sk" })
    expect(admin.map(([n]) => n)).toEqual(["Súhrn", "Kvalita", "Tickety", "AI a cena"])
    const [, summary] = admin[0]
    expect(summary[0]).toHaveLength(14)
    expect(summary[1]).toEqual(["Otázky", ...Array(11).fill(0), 1, 5])
    const agent = channelStatsSheets(data, ranges, { withCost: false, language: "sk" })
    expect(agent.map(([n]) => n)).not.toContain("AI a cena")
    expect(agent[0][1].some(r => String(r[0]).startsWith("Cena"))).toBe(false)
  })
})
