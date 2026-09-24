/**
 * Postup znenia v štyroch krokoch — Príprava, Schválenie, Zverejnenie,
 * Pridelenie (rám KNIZNICA-postup-znenia, ADR-014).
 *
 * **Stav sa odvodzuje, neukladá** (D27): krok vyplýva z konceptu, z kôl
 * schvaľovania a z pridelení. V modeli nepribudol žiadny stav „krok 3".
 *
 * Čisté funkcie bez databázy — obrazovka im dá, čo načítala, a dostane späť,
 * ktorú kartu a v akom stave nakresliť.
 */

import type { ApprovalRound, VersionState } from "./approvals"

export type FlowStep = 1 | 2 | 3 | 4
export type StepState = "done" | "current" | "rejected" | "todo"

export interface FlowInput {
  /** Je koncept, ktorý sa líši od platného znenia. */
  preparing: boolean
  /** Stav konceptu z kôl na jeho identite (ADR-011, D96). */
  draftState: VersionState
  /**
   * Posledné kolo **tejto prípravy** — aj na staršej identite konceptu.
   * Po zamietnutí sa často vymení PDF; dôvod zamietnutia má zostať vidieť.
   */
  lastRound: ApprovalRound | null
  /** Koľko publík z predošlých znení platné znenie ešte nemá (karta prenosu). */
  carryOverCount: number
}

export interface Flow {
  step: FlowStep
  /** Stav každého zo štyroch krokov, v poradí. */
  states: [StepState, StepState, StepState, StepState]
  /** Zamietnuté alebo stiahnuté kolo, ku ktorému sa príprava vrátila. */
  rejected: ApprovalRound | null
}

/** Ktorý krok a v akom stave; `null` = žiadna karta (nič sa nepripravuje). */
export function versionFlow(i: FlowInput): Flow | null {
  if (!i.preparing) {
    return i.carryOverCount > 0
      ? { step: 4, states: ["done", "done", "done", "current"], rejected: null }
      : null
  }
  if (i.draftState === "in-review") {
    return { step: 2, states: ["done", "current", "todo", "todo"], rejected: null }
  }
  if (i.draftState === "approved" || i.draftState === "published-before") {
    return { step: 3, states: ["done", "done", "current", "todo"], rejected: null }
  }
  const rejected = i.lastRound?.outcome === "rejected" ? i.lastRound : null
  return {
    step: 1,
    states: ["current", rejected ? "rejected" : "todo", "todo", "todo"],
    rejected,
  }
}

/**
 * Posledné kolo prípravy: najnovšie kolo dokumentu predložené **po** poslednom
 * zverejnení. Staršie patria k niektorému platnému alebo archivovanému zneniu.
 */
export function lastPreparationRound(
  rounds: Iterable<ApprovalRound[]>,
  lastPublishedAt: Date | null,
): ApprovalRound | null {
  let last: ApprovalRound | null = null
  for (const list of rounds) {
    for (const r of list) {
      const at = new Date(r.submittedAt).getTime()
      if (lastPublishedAt && at <= lastPublishedAt.getTime()) continue
      if (!last || at > new Date(last.submittedAt).getTime()) last = r
    }
  }
  return last
}

/**
 * Schvaľovatelia predvyplnení z posledného kola dokumentu (ADR-014, D110) —
 * ako `persons.id`, lebo tak ich chce formulár. Kolo nesie adresy; kto medzi
 * ponúkanými už nie je (vyradený, predkladateľ sám), vypadne.
 */
export function previousApproverIds(
  rounds: Iterable<ApprovalRound[]>,
  people: { id: string; email: string }[],
): string[] {
  let last: ApprovalRound | null = null
  for (const list of rounds) {
    for (const r of list) {
      if (!last || new Date(r.submittedAt).getTime() > new Date(last.submittedAt).getTime()) last = r
    }
  }
  if (!last) return []
  const byEmail = new Map(people.map(p => [p.email.toLowerCase(), p.id]))
  return last.approvers
    .map(a => byEmail.get(a.email.toLowerCase()))
    .filter((id): id is string => Boolean(id))
}

/** Kto kolo zamietol; `null` = kolo stiahol predkladateľ. */
export function rejectedBy(round: ApprovalRound) {
  return round.approvers.find(a => a.decision === "rejected") ?? null
}
