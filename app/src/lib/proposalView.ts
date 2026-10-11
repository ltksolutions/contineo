/**
 * proposalView.ts — čo fronta kurátora odvodzuje z návrhov kanála
 * (návrh KANALY-navrhy-faq-kuracia, 11. 10. 2026; ADR-030 D185).
 *
 * Témy, počty, filter a „ďalší nerozhodnutý" sa neukladajú — počítajú sa
 * zo zoznamu návrhov kanála (`channelProposals`, D27). Funkcie sú čisté,
 * aby sa dali testovať bez databázy.
 */

import { DECISION_MARK, type FaqProposal, type ProposalFilter } from "./faqProposals"
import type { ReviewVerdict } from "./complianceCheck"

type P = Pick<FaqProposal, "id" | "topicKey" | "topicLabel" | "status" | "note" | "review" | "threads" | "decidedAt" | "firstMonth" | "lastMonth">

/** Otvorený návrh s otázkou na rozhodnutie z revízie („[NA ROZHODNUTIE]"). */
export function needsDecision(p: Pick<FaqProposal, "status" | "note">): boolean {
  return p.status === "open" && p.note.includes(DECISION_MARK)
}

/** Poznámka bez značky — z nej je nadpis „Na rozhodnutie". */
export function noteWithoutMark(note: string): string {
  return note.split(DECISION_MARK).join("").replace(/^[\s:–—-]+/, "").trim()
}

/** Výsledok kontroly, o ktorom kurátor ešte nerozhodol. */
export function pendingVerdict(p: Pick<FaqProposal, "status" | "review">): ReviewVerdict | null {
  return p.status === "open" && p.review && !p.review.decision ? p.review.verdict : null
}

export interface TopicStat {
  topicKey: string
  topicLabel: string
  open: number
  decision: number
  differs: number
  notCovered: number
  total: number
}

/**
 * Témy kanála v poradí fronty: s otvorenými návrhmi (viac vlákien skôr —
 * zoznam prichádza tak zoradený), hotové na konci.
 */
export function topicStats(list: P[]): TopicStat[] {
  const map = new Map<string, TopicStat>()
  for (const p of list) {
    const s = map.get(p.topicKey) ?? { topicKey: p.topicKey, topicLabel: p.topicLabel, open: 0, decision: 0, differs: 0, notCovered: 0, total: 0 }
    s.total += 1
    if (p.status === "open") {
      s.open += 1
      if (needsDecision(p)) s.decision += 1
      const v = pendingVerdict(p)
      if (v === "differs") s.differs += 1
      if (v === "not_covered") s.notCovered += 1
    }
    map.set(p.topicKey, s)
  }
  const all = [...map.values()]
  return [...all.filter(s => s.open > 0), ...all.filter(s => s.open === 0)]
}

/** Téma bez `?topic=`: prvá s [NA ROZHODNUTIE], inak prvá s otvorenými (Q2). */
export function defaultTopic(stats: TopicStat[]): TopicStat | null {
  return stats.find(s => s.decision > 0) ?? stats.find(s => s.open > 0) ?? stats[0] ?? null
}

export function viewCounts(list: P[]): Record<ProposalFilter, number> {
  const open = list.filter(p => p.status === "open").length
  return { open, decision: list.filter(needsDecision).length, decided: list.length - open, all: list.length }
}

export function verdictCounts(list: P[]): Record<ReviewVerdict, number> {
  const out: Record<ReviewVerdict, number> = { differs: 0, conflict: 0, not_covered: 0, agree: 0 }
  for (const p of list) { const v = pendingVerdict(p); if (v) out[v] += 1 }
  return out
}

/** Návrhy témy podľa pohľadu a výsledku kontroly; vo „Všetky" otvorené hore. */
export function filterProposals<T extends P>(list: T[], view: ProposalFilter, review: ReviewVerdict | null): T[] {
  const byDecided = (a: T, b: T) => new Date(b.decidedAt ?? 0).getTime() - new Date(a.decidedAt ?? 0).getTime()
  const open = list.filter(p => p.status === "open" && (!review || pendingVerdict(p) === review))
  const decided = review ? [] : list.filter(p => p.status !== "open").sort(byDecided)
  if (view === "decision") return open.filter(needsDecision)
  if (view === "decided") return decided
  if (view === "all") return [...open, ...decided]
  return open
}

/**
 * Ďalší nerozhodnutý návrh po danom: najprv ďalej v tej istej téme, potom
 * prvý v ďalšej téme s otvorenými (v poradí tém), nakoniec od začiatku.
 * Samotný návrh sa nevracia — po úkone už rozhodnutý je.
 */
export function nextOpen<T extends P>(list: T[], stats: TopicStat[], currentId: string): T | null {
  const order = stats.flatMap(s => list.filter(p => p.topicKey === s.topicKey && p.status === "open"))
  const at = order.findIndex(p => p.id === currentId)
  const rest = at < 0 ? order : [...order.slice(at + 1), ...order.slice(0, at)]
  return rest[0] ?? null
}

/** Obdobie ťažby kanála v mesiacoch (od najstaršieho po najnovší mesiac návrhov). */
export function periodMonths(list: Pick<FaqProposal, "firstMonth" | "lastMonth">[]): number | null {
  const months = (k: string) => { const [y, m] = k.split("-").map(Number); return y * 12 + (m - 1) }
  const firsts = list.map(p => p.firstMonth).filter((x): x is string => Boolean(x)).map(months)
  const lasts = list.map(p => p.lastMonth).filter((x): x is string => Boolean(x)).map(months)
  if (!firsts.length || !lasts.length) return null
  return Math.max(...lasts) - Math.min(...firsts) + 1
}
