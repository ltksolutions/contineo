/**
 * proposalView.test.ts — fronta kurátora návrhov FAQ (návrh
 * KANALY-navrhy-faq-kuracia, 11. 10. 2026; ADR-030 D185).
 *
 * Témy, počty a „Schváliť do FAQ a ďalší" sa odvodzujú zo zoznamu návrhov;
 * keby sa pomýlili, kurátor by skočil na rozhodnutý návrh alebo by
 * predvolená téma nebola tá s otázkou na rozhodnutie (Q2).
 */

import { describe, it, expect } from "vitest"
import { defaultTopic, filterProposals, needsDecision, nextOpen, noteWithoutMark, periodMonths, topicStats, verdictCounts, viewCounts } from "../src/lib/proposalView"
import { DECISION_MARK, type FaqProposal } from "../src/lib/faqProposals"
import type { ReviewVerdict } from "../src/lib/complianceCheck"

function p(id: string, topicKey: string, over: Partial<FaqProposal> & { verdict?: ReviewVerdict } = {}): FaqProposal {
  const { verdict, ...rest } = over
  return {
    id, companyCode: "SFZ", channelKey: "k", topicKey, topicLabel: topicKey.toUpperCase(), question: `Otázka ${id}`, variants: [], answer: "a", audience: [],
    sources: [], threads: 10, firstMonth: "2024-01", lastMonth: "2026-09", flags: { changedOverTime: false, normConflict: false }, note: "",
    origin: null, model: "m", createdAt: new Date(), status: "open", decidedAt: null, decidedBy: null, faqDocumentId: null, faqEntryId: null, mergedInto: null,
    review: verdict ? { runId: "r", at: new Date(), verdict, citations: [], proposed: null, note: "", model: "m", documents: [], decision: null } : null,
    ...rest,
  }
}

const list = [
  p("a1", "login", { verdict: "differs" }),
  p("a2", "login", { note: `${DECISION_MARK} Kam podať žiadosť?` }),
  p("a3", "login", { status: "approved", decidedAt: new Date("2026-10-10") }),
  p("b1", "gdpr", { note: `${DECISION_MARK} DPO alebo sekretariát?`, verdict: "not_covered" }),
  p("c1", "done", { status: "rejected", decidedAt: new Date("2026-10-09"), rejectReason: "Patrí inam." }),
  p("d1", "fees", { verdict: "not_covered", firstMonth: "2023-10" }),
]

describe("témy", () => {
  it("otvorené témy v poradí zoznamu, hotové na konci, s počtami", () => {
    const s = topicStats(list)
    expect(s.map(x => x.topicKey)).toEqual(["login", "gdpr", "fees", "done"])
    expect(s[0]).toMatchObject({ open: 2, decision: 1, differs: 1, total: 3 })
    expect(s[2]).toMatchObject({ open: 1, notCovered: 1 })
    expect(s[3]).toMatchObject({ open: 0, total: 1 })
  })

  it("predvolená téma je prvá s [NA ROZHODNUTIE] (Q2)", () => {
    expect(defaultTopic(topicStats(list.filter(x => x.id !== "a2")))?.topicKey).toBe("gdpr")
    expect(defaultTopic(topicStats([p("x", "t1"), p("y", "t2")]))?.topicKey).toBe("t1")
  })
})

describe("pohľad a výsledok kontroly", () => {
  const login = list.filter(x => x.topicKey === "login")
  it("počty a filter", () => {
    expect(viewCounts(login)).toEqual({ open: 2, decision: 1, decided: 1, all: 3 })
    expect(filterProposals(login, "open", null).map(x => x.id)).toEqual(["a1", "a2"])
    expect(filterProposals(login, "decision", null).map(x => x.id)).toEqual(["a2"])
    expect(filterProposals(login, "decided", null).map(x => x.id)).toEqual(["a3"])
    expect(filterProposals(login, "all", null).map(x => x.id)).toEqual(["a1", "a2", "a3"])
    expect(filterProposals(login, "open", "differs").map(x => x.id)).toEqual(["a1"])
  })

  it("verdikty len nerozhodnuté a len pri otvorených", () => {
    expect(verdictCounts(list)).toEqual({ differs: 1, conflict: 0, not_covered: 2, agree: 0 })
  })

  it("značka [NA ROZHODNUTIE] je nadpis, nie text poznámky", () => {
    expect(needsDecision(list[1])).toBe(true)
    expect(noteWithoutMark(list[1].note)).toBe("Kam podať žiadosť?")
  })
})

describe("ďalší nerozhodnutý", () => {
  const stats = topicStats(list)
  it("najprv v téme, potom v ďalšej téme, nakoniec od začiatku", () => {
    expect(nextOpen(list, stats, "a1")?.id).toBe("a2")
    expect(nextOpen(list, stats, "a2")?.id).toBe("b1")
    expect(nextOpen(list, stats, "d1")?.id).toBe("a1")
    expect(nextOpen([p("x", "t")], topicStats([p("x", "t")]), "x")).toBeNull()
  })
})

describe("obdobie ťažby", () => {
  it("od najstaršieho po najnovší mesiac", () => {
    expect(periodMonths(list)).toBe(36)
    expect(periodMonths([{ firstMonth: null, lastMonth: null }])).toBeNull()
  })
})
