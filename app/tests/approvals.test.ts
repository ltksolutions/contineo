/**
 * approvals.test.ts — schvaľovanie znenia (ADR-006).
 *
 * Tri miesta, kde sa dá pomýliť a nikto si to hneď nevšimne:
 *
 *  1. **jedno zamietnutie zastaví kolo** (D71) — aj keď ostatní schválili
 *     a aj keď ešte nerozhodli všetci. Opačná chyba by znamenala, že kolo
 *     beží ďalej a čaká na hlasy, ktoré už nič nezmenia;
 *  2. **rozhoduje posledné kolo, nie súčet** (D27) — po zamietnutí a novom
 *     predložení je stav podľa nového kola, staré zostáva v histórii;
 *  3. **brána pri prideľovaní má dve podmienky** (D73) a žiadna nenahrádza
 *     druhú; `published-before` cez ňu prechádza zámerne (D74), inak by
 *     personalista zo dňa na deň nemohol prideliť nič.
 */

import { describe, it, expect } from "vitest"
import {
  versionState, roundOutcome, pendingApprovers, submitProblem, assignBlock,
  type ApprovalRound, type ApproverDecision,
} from "../src/lib/approvals"

const at = (iso: string) => new Date(`${iso}T12:00:00`)

/** Schvaľovateľ, ktorý ešte nerozhodol. */
const waiting = (email: string): ApproverDecision => ({
  email,
  fullName: email,
  decidedAt: null,
  decision: null,
})

const approved = (email: string): ApproverDecision => ({
  ...waiting(email),
  decidedAt: at("2026-09-08"),
  decision: "approved",
})

const rejected = (email: string, reason: string): ApproverDecision => ({
  ...waiting(email),
  decidedAt: at("2026-09-08"),
  decision: "rejected",
  reason,
})

const round = (
  n: number,
  approvers: ApproverDecision[],
  outcome: ApprovalRound["outcome"] = null,
): ApprovalRound => ({
  companyCode: "sfz",
  documentId: "doc-1",
  versionId: "v-1",
  round: n,
  submittedBy: "spravca@example.test",
  submittedAt: at("2026-09-07"),
  approvers,
  closedAt: outcome ? at("2026-09-08") : null,
  outcome,
})

describe("výsledok kola", () => {
  it("beží, kým nerozhodli všetci", () => {
    expect(roundOutcome([approved("a@x.test"), waiting("b@x.test")])).toBe(null)
  })

  it("schválené je až vtedy, keď schválili všetci", () => {
    expect(roundOutcome([approved("a@x.test"), approved("b@x.test")])).toBe("approved")
  })

  it("jedno zamietnutie zastaví kolo, aj keď ostatní schválili", () => {
    const out = roundOutcome([
      approved("a@x.test"),
      rejected("b@x.test", "článok 4 odporuje stanovám"),
      approved("c@x.test"),
    ])
    expect(out).toBe("rejected")
  })

  it("zamietnutie platí aj vtedy, keď ostatní ešte nerozhodli", () => {
    // Toto je ten dôvod, prečo sa nečaká: hlasy, ktoré prídu neskôr, už
    // výsledok nezmenia, a čakanie na ne len drží znenie v limbe.
    const out = roundOutcome([
      rejected("a@x.test", "chýba príloha 2"),
      waiting("b@x.test"),
    ])
    expect(out).toBe("rejected")
  })

  it("kolo bez schvaľovateľov nie je schválené", () => {
    // `every` na prázdnom poli je `true` — bez tejto podmienky by prázdne
    // kolo prešlo ako schválené a znenie by sa dalo prideliť bez súhlasu.
    expect(roundOutcome([])).toBe(null)
  })
})

describe("stav znenia", () => {
  it("bez kola je koncept", () => {
    expect(versionState([])).toBe("draft")
  })

  it("bez kola, ale zverejnené pred zavedením schvaľovania, je pomenované", () => {
    expect(versionState([], { publishedBefore: true })).toBe("published-before")
  })

  it("bežiace kolo je v schvaľovaní", () => {
    expect(versionState([round(1, [approved("a@x.test"), waiting("b@x.test")])]))
      .toBe("in-review")
  })

  it("zamietnuté kolo vracia znenie do konceptu", () => {
    const r = round(1, [rejected("a@x.test", "zlé číslovanie")], "rejected")
    expect(versionState([r])).toBe("draft")
  })

  it("po zamietnutí rozhoduje nové kolo, nie staré", () => {
    const first = round(1, [rejected("a@x.test", "zlé číslovanie")], "rejected")
    const second = round(2, [approved("a@x.test")], "approved")
    expect(versionState([first, second])).toBe("approved")
    // Na poradí v poli nezáleží — rozhoduje číslo kola, nie to, ako to
    // vrátila databáza.
    expect(versionState([second, first])).toBe("approved")
  })

  it("zverejnené pred zavedením schvaľovania ustúpi skutočnému kolu", () => {
    const r = round(1, [approved("a@x.test")], "approved")
    expect(versionState([r], { publishedBefore: true })).toBe("approved")
  })
})

describe("kto ešte nerozhodol", () => {
  it("vracia len tých bez rozhodnutia", () => {
    const r = round(1, [approved("a@x.test"), waiting("b@x.test"), waiting("c@x.test")])
    expect(pendingApprovers(r).map(a => a.email)).toEqual(["b@x.test", "c@x.test"])
  })
})

describe("predloženie na schválenie", () => {
  const submittedBy = "spravca@example.test"

  it("prejde s menovanými schvaľovateľmi", () => {
    expect(submitProblem({ rounds: [], approvers: ["a@x.test"], submittedBy })).toBe(null)
  })

  it("bez schvaľovateľov neprejde", () => {
    expect(submitProblem({ rounds: [], approvers: [], submittedBy }))
      .toBe("approval.noApprovers")
    // Prázdne meno nie je schvaľovateľ — inak by formulár s jedným prázdnym
    // riadkom otvoril kolo, ktoré nikto nemôže uzavrieť.
    expect(submitProblem({ rounds: [], approvers: ["  "], submittedBy }))
      .toBe("approval.noApprovers")
  })

  it("predkladateľ nesmie byť medzi schvaľovateľmi", () => {
    expect(submitProblem({ rounds: [], approvers: ["Spravca@Example.Test"], submittedBy }))
      .toBe("approval.selfApproval")
  })

  it("nedá sa predložiť dvakrát naraz", () => {
    const running = round(1, [waiting("a@x.test")])
    expect(submitProblem({ rounds: [running], approvers: ["b@x.test"], submittedBy }))
      .toBe("approval.alreadyRunning")
  })

  it("schválené znenie sa nepredkladá znovu", () => {
    const done = round(1, [approved("a@x.test")], "approved")
    expect(submitProblem({ rounds: [done], approvers: ["b@x.test"], submittedBy }))
      .toBe("approval.alreadyApproved")
  })

  it("po zamietnutí sa predložiť dá", () => {
    const no = round(1, [rejected("a@x.test", "chýba dátum účinnosti")], "rejected")
    expect(submitProblem({ rounds: [no], approvers: ["a@x.test"], submittedBy })).toBe(null)
  })
})

describe("brána pri prideľovaní", () => {
  const from = at("2026-01-01")

  it("schválené a účinné prejde", () => {
    expect(assignBlock({ state: "approved", effectiveFrom: from })).toBe(null)
  })

  it("koncept neprejde", () => {
    expect(assignBlock({ state: "draft", effectiveFrom: from }))
      .toBe("assignment.notApproved")
  })

  it("znenie v schvaľovaní neprejde", () => {
    expect(assignBlock({ state: "in-review", effectiveFrom: from }))
      .toBe("assignment.notApproved")
  })

  it("schválené bez dátumu účinnosti neprejde a hlási druhý dôvod", () => {
    // Dve podmienky, dve hlásenia: personalista musí vedieť, ktorá chýba.
    expect(assignBlock({ state: "approved", effectiveFrom: null }))
      .toBe("assignment.versionNotEffective")
  })

  it("zverejnené pred zavedením schvaľovania prejde", () => {
    // Zámerne (D74) — dočasné lešenie, kým skúšobný korpus nenahradia
    // oficiálne znenia prevedené cez schvaľovanie (D75).
    expect(assignBlock({ state: "published-before", effectiveFrom: from })).toBe(null)
  })

  it("ani zverejnené pred zavedením schvaľovania neprejde bez účinnosti", () => {
    expect(assignBlock({ state: "published-before", effectiveFrom: null }))
      .toBe("assignment.versionNotEffective")
  })
})
