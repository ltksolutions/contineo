/**
 * Časový rad udalostí dokumentu — história na detaile v knižnici
 * (KNIZ-detail-dokumentu, 12. 10. 2026, Q5).
 *
 * Nič sa neukladá (D27): udalosti sa skladajú z kôl schvaľovania a z histórie
 * znenia, ktoré už existujú. Dovtedy boli tie isté údaje v troch-štyroch
 * rozbaľovačkách a dôvod zamietnutia či stiahnutia kola bolo treba hľadať.
 */

import { roundCancelled, type ApprovalRound } from "@/lib/approvals"

export type TimelineKind =
  | "submitted" | "approved" | "rejected" | "cancelled" | "published"
  | "responsible" | "basis" | "fix" | "textFix" | "archived"

export interface TimelineEvent {
  kind: TimelineKind
  at: Date
  /** Kto — e-mail alebo meno; stránka ho preloží na meno. */
  who: string
  round?: number
  /** Dôvod zamietnutia, stiahnutia či opravy. */
  reason?: string
  /** Doplnok riadku (napr. nová zodpovedná osoba, názov základu). */
  detail?: string
}

/** Koľko udalostí sa ukáže bez `?history=all`. */
export const TIMELINE_SHOWN = 5

const CANCEL_MARK = /Kolo zrušil predkladateľ \(([^)]*)\):\s*([\s\S]*)$/

/**
 * Dôvod a autor stiahnutia z poznámky kola. `cancelRound()` ich pripisuje do
 * `note` (dodatok ADR-006) — samostatné pole na to nie je.
 */
export function cancelInfo(note: string | undefined): { by?: string; reason?: string } {
  const m = note?.match(CANCEL_MARK)
  if (!m) return {}
  return { by: m[1].trim() || undefined, reason: m[2].trim() || undefined }
}

/** Udalosti jedného kola: predloženie, rozhodnutia, stiahnutie. */
export function roundEvents(r: Pick<ApprovalRound, "round" | "submittedBy" | "submittedAt" | "note" | "approvers" | "closedAt" | "outcome">): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { kind: "submitted", at: new Date(r.submittedAt), who: r.submittedBy, round: r.round },
  ]
  for (const a of r.approvers) {
    if (!a.decision || !a.decidedAt) continue
    events.push({
      kind: a.decision === "approved" ? "approved" : "rejected",
      at: new Date(a.decidedAt),
      who: a.fullName,
      round: r.round,
      reason: a.decision === "rejected" ? a.reason : undefined,
    })
  }
  if (roundCancelled(r)) {
    const info = cancelInfo(r.note)
    events.push({
      kind: "cancelled",
      at: new Date(r.closedAt ?? r.submittedAt),
      who: info.by ?? r.submittedBy,
      round: r.round,
      reason: info.reason,
    })
  }
  return events
}

/**
 * Zoradí najnovšie hore. Pri rovnakom čase ide neskorší druh vyššie
 * (rozhodnutie nad predložením), aby rad nečítal „schválené" pred „predložené".
 */
export function sortTimeline(events: TimelineEvent[]): TimelineEvent[] {
  const order: TimelineKind[] = ["submitted", "responsible", "basis", "fix", "textFix", "approved", "rejected", "cancelled", "published", "archived"]
  return [...events]
    .filter(e => !Number.isNaN(e.at.getTime()))
    .sort((a, b) => (b.at.getTime() - a.at.getTime()) || (order.indexOf(b.kind) - order.indexOf(a.kind)))
}

/**
 * Má sa história karty postupu kresliť? Pri prvom bežiacom kole bez inej
 * udalosti nie — opakovala by zoznam schvaľovateľov nad ňou (Q5).
 */
export function timelineWorthShowing(events: TimelineEvent[]): boolean {
  return events.length > 1 || events.some(e => e.kind !== "submitted")
}
