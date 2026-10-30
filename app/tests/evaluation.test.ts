/**
 * evaluation.test.ts — kto je hodnotitel a co mu patri do fronty.
 *
 * Obe funkcie su ciste a rozhoduju o dvoch roznych veciach: `isEvaluator`
 * o pristupe, `needsEvaluation` o tom, ci sa zaznam ukaze. Tretie miesto,
 * kde sa ta podmienka opakuje, neexistuje zamerne — pocet pri navigacii
 * aj zoznam ju volaju.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// `lib/session.ts` obaluje volania do Reactovej `cache()`, ktora mimo
// servera neexistuje. Rovnaky postup ako v `people.test.ts`.
const { currentTenant, currentPerson, getCollection } = vi.hoisted(() => ({
  currentTenant: vi.fn(),
  currentPerson: vi.fn(),
  getCollection: vi.fn(),
}))

vi.mock("../src/lib/session", () => ({ currentTenant, currentPerson }))
vi.mock("../src/lib/mongodb", () => ({ getCollection }))

import {
  isEvaluator, needsEvaluation, evaluationContext, evaluationQueue, evaluationDecided, evaluationView, EVALUATOR_ROLE,
  evaluationStats, pickEarlier, EARLIER_WINDOW_MS,
} from "../src/lib/evaluation"
import type { Person } from "../src/lib/persons"
import type { Tenant } from "../src/lib/tenants"

beforeEach(() => {
  currentTenant.mockReset()
  currentPerson.mockReset()
})

const tenant = (companyCode = "SFZ") => ({ companyCode } as Tenant)
const inTenant = (roles: string[], companyCode = "SFZ") =>
  ({ roles, companyCode } as Person)

const person = (roles: string[]): Person => ({ roles } as Person)

describe("isEvaluator", () => {
  it("rolu ma len ten, kto ju naozaj ma", () => {
    expect(isEvaluator(person([EVALUATOR_ROLE]))).toBe(true)
    expect(isEvaluator(person(["hr", EVALUATOR_ROLE]))).toBe(true)
    expect(isEvaluator(person(["hr"]))).toBe(false)
    expect(isEvaluator(person([]))).toBe(false)
  })

  it("nikto prihlaseny nie je nikto — null je false, nie vynimka", () => {
    // Volajucim je aj API route, ktora osobu nemusi najst. Padnuty dotaz
    // by tam znamenal 500 namiesto ciste odmietnuteho zapisu.
    expect(isEvaluator(null)).toBe(false)
    expect(isEvaluator({} as Person)).toBe(false)
  })
})

describe("needsEvaluation", () => {
  it("spravna odpoved hodnotitela nezdrziava", () => {
    expect(needsEvaluation({})).toBe(false)
    expect(needsEvaluation({ readerVerdict: 1 })).toBe(false)
  })

  it("„nesedi\" od citatela staci samo o sebe", () => {
    expect(needsEvaluation({ readerVerdict: 0 })).toBe(true)
  })

  it("popis chyby staci aj bez posudku", () => {
    // Clovek moze napisat, co je zle, bez toho aby klikol „Nesedi\" —
    // napriklad ked formular otvori a posudok sa neulozi.
    expect(needsEvaluation({ readerNote: "odvolava sa na zruseny clanok" })).toBe(true)
  })

  it("prazdny alebo medzerovy popis nie je popis", () => {
    expect(needsEvaluation({ readerNote: "   " })).toBe(false)
  })

  it("starsie posudky z cias, ked panel videl kazdy, sa doriesia tiez", () => {
    expect(needsEvaluation({ correct: 0 })).toBe(true)
    expect(needsEvaluation({ hallucination: 1 })).toBe(true)
    expect(needsEvaluation({ correct: 1, hallucination: 0 })).toBe(false)
  })

  it("vybavene uz nikdy nie je vo fronte", () => {
    // `evaluatedAt` vyhrava nad vsetkym ostatnym: ked hodnotitel posudok
    // potvrdil, zaznam sa mu nesmie vratit len preto, ze citatel povedal
    // „nesedi\" — prave to uz posudil.
    const done = { evaluatedAt: new Date(), readerVerdict: 0 as const, readerNote: "zle", correct: 0 as const }
    expect(needsEvaluation(done)).toBe(false)
  })
})

describe("evaluationContext", () => {
  it("hodnotitel vlastnej organizacie prejde", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(inTenant([EVALUATOR_ROLE]))
    expect((await evaluationContext()).state).toBe("ready")
  })

  it("rola v cudzej organizacii neplati", async () => {
    // Obe podmienky musia sediet naraz (D29, D32). Keby stacila rola, jedna
    // chyba pri jej priradeni by otvorila cudzie otazky a odpovede.
    currentTenant.mockResolvedValue(tenant("SFZ"))
    currentPerson.mockResolvedValue(inTenant([EVALUATOR_ROLE], "SsFZ"))
    expect((await evaluationContext()).state).toBe("forbidden")
  })

  it("ina rola sem nestaci", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(inTenant(["hr", "content-admin"]))
    expect((await evaluationContext()).state).toBe("forbidden")
  })

  it("neprihlaseny dostane pokyn prihlasit sa, nie zakaz", async () => {
    currentTenant.mockResolvedValue(tenant())
    currentPerson.mockResolvedValue(null)
    expect((await evaluationContext()).state).toBe("not-signed-in")
  })

  it("vypadok databazy obrazovku neotvori", async () => {
    currentTenant.mockRejectedValue(new Error("cluster nedostupny"))
    expect((await evaluationContext()).state).toBe("unknown-host")
  })
})

describe("evaluationQueue — kto sa pýtal (Jan 30. 10. 2026)", () => {
  const rows = [
    { _id: "r1", companyCode: "SFZ", question: "Q1", readerVerdict: 0, askedBy: "p1", origin: { kind: "widget", label: "ISSF Helpdesk" } },
    { _id: "r2", companyCode: "SFZ", question: "Q2", readerVerdict: 0, reviewer: "p2" },
    { _id: "r3", companyCode: "SFZ", question: "Q3", readerVerdict: 0 },
    { _id: "r4", companyCode: "SFZ", question: "Q4", readerNote: "zle", askedBy: "zmazana" },
  ]
  const persons = [
    { id: "p1", companyCode: "SFZ", email: "jana.vzorova@example.com", fullName: "Jana Vzorová", jobTitle: "rozhodkyňa", personType: "external", status: "active", language: "sk", tracks: [] },
    { id: "p2", companyCode: "SFZ", email: "peter@example.com", fullName: "Peter Príklad", department: "Matrika", personType: "employee", status: "active", language: "sk", tracks: [] },
  ]
  let personsQuery: Record<string, unknown> | null = null
  beforeEach(() => {
    getCollection.mockReset()
    getCollection.mockImplementation(async (name: string) => name === "persons"
      ? { find: (q: Record<string, unknown>) => { personsQuery = q; return { toArray: async () => persons } } }
      : { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => rows }) }) }) })
  })

  it("meno, e-mail a pozícia z adresára; bez prihlásenia null; zmazaná osoba gone", async () => {
    const q = await evaluationQueue("SFZ")
    expect(q.map(i => i.asker)).toEqual([
      { name: "Jana Vzorová", email: "jana.vzorova@example.com", role: "rozhodkyňa" },
      { name: "Peter Príklad", email: "peter@example.com", role: "Matrika" },
      null,
      "gone",
    ])
    expect(q.map(i => i.origin)).toEqual([{ kind: "widget", label: "ISSF Helpdesk" }, null, null, null])
    // Osoby len z vlastnej organizácie (D32).
    expect(personsQuery).toMatchObject({ companyCode: "SFZ" })
  })
})

describe("pohľady fronty (Jan 30. 10. 2026)", () => {
  it("neznámy pohľad je Čaká", () => {
    expect(evaluationView("assessed")).toBe("assessed")
    expect(evaluationView("dismissed")).toBe("dismissed")
    expect(evaluationView("zle")).toBe("pending")
    expect(evaluationView(undefined)).toBe("pending")
  })

  it("posúdený záznam: pýtajúci sa nie je z `reviewer` (tam je hodnotiteľ), posudok s menom hodnotiteľa", async () => {
    const at = new Date("2026-10-30T10:00:00Z")
    const rows = [
      { _id: "d1", companyCode: "SFZ", question: "Q", readerVerdict: 0, reviewer: "ev", evaluatedAt: at, evaluatedBy: "ev", correct: 0, hallucination: 1, verifiedAnswer: "Takto." },
    ]
    const persons = [{ id: "ev", companyCode: "SFZ", email: "hodnotitel@example.com", fullName: "Hana Hodnotiteľka" }]
    let ratingsQuery: Record<string, unknown> | null = null
    getCollection.mockReset()
    getCollection.mockImplementation(async (name: string) => name === "persons"
      ? { find: () => ({ toArray: async () => persons }) }
      : { find: (q: Record<string, unknown>) => { ratingsQuery = q; return { sort: () => ({ limit: () => ({ toArray: async () => rows }) }) } } })
    const [item] = await evaluationDecided("SFZ", "assessed")
    expect(ratingsQuery).toMatchObject({ companyCode: "SFZ", evaluatedAt: { $exists: true }, dismissedAt: { $exists: false } })
    expect(item.asker).toBeNull()
    expect(item.decision).toMatchObject({ kind: "assessed", at, correct: 0, hallucination: 1, verifiedAnswer: "Takto.", by: { name: "Hana Hodnotiteľka" } })
  })
})

describe("evaluationStats", () => {
  // 30. 10. 2026 — posledný mesiac obdobia je október 2026.
  const now = new Date("2026-10-30T12:00:00Z")
  const at = (iso: string) => new Date(iso)

  it("pocita mesiace v case SFZ, nie v UTC", () => {
    // 31. 8. 2026 o 23:30 UTC je v Bratislave uz 1. 9.
    const s = evaluationStats([{ createdAt: at("2026-08-31T23:30:00Z"), readerVerdict: 1 }], now)
    expect(s.months).toHaveLength(12)
    expect(s.months.at(-1)!.key).toBe("2026-10")
    expect(s.months[0].key).toBe("2025-11")
    expect(s.byMonth[s.months.findIndex(m => m.key === "2026-09")].answers).toBe(1)
    expect(s.byMonth[s.months.findIndex(m => m.key === "2026-08")].answers).toBe(0)
  })

  it("posudky tymi istymi pravidlami ako fronta a pohlady", () => {
    const s = evaluationStats([
      { createdAt: at("2026-10-01T10:00:00Z"), readerVerdict: 1 },
      // Caka: nesedi, bez posudku.
      { createdAt: at("2026-10-02T10:00:00Z"), readerVerdict: 0 },
      // Posudene: nespravna a zaroven s vymyslenym.
      { createdAt: at("2026-10-03T10:00:00Z"), readerNote: "Zly paragraf", evaluatedAt: now, correct: 0, hallucination: 1 },
      // Posudene: spravna.
      { createdAt: at("2026-10-04T10:00:00Z"), readerVerdict: 0, evaluatedAt: now, correct: 1, hallucination: 0 },
      // Vyradene: posudok sa nepocita, aj keby tam bol.
      { createdAt: at("2026-10-05T10:00:00Z"), readerVerdict: 0, evaluatedAt: now, dismissedAt: now, correct: 0 },
      // Mimo obdobia.
      { createdAt: at("2025-10-15T10:00:00Z"), readerVerdict: 0 },
    ], now)
    expect(s.total).toEqual({ answers: 5, doesNotFit: 4, correct: 1, wrong: 1, hallucination: 1, dismissed: 1, pending: 1 })
  })

  it("zdroje: najvacsi prvy, neuvedeny na konci", () => {
    const s = evaluationStats([
      { createdAt: at("2026-10-01T10:00:00Z") },
      { createdAt: at("2026-10-01T10:00:00Z"), origin: { kind: "intranet" } },
      { createdAt: at("2026-10-02T10:00:00Z"), origin: { kind: "widget", label: "Helpdesk" } },
      { createdAt: at("2026-09-02T10:00:00Z"), origin: { kind: "widget", label: "Helpdesk" } },
    ], now)
    expect(s.sources.map(x => x.key)).toEqual(["widget:Helpdesk", "intranet", ""])
    expect(s.sources[0].answersByMonth.slice(-2)).toEqual([1, 1])
    expect(s.sources[2].origin).toBeNull()
  })
})

describe("pickEarlier", () => {
  const widget = { kind: "widget" as const, label: "Helpdesk" }
  const t0 = new Date("2026-10-30T10:00:00Z")
  const before = (min: number) => new Date(t0.getTime() - min * 60_000)
  const target = { question: "A plati to aj pre oblastne sutaze?", answer: "", createdAt: t0, askedBy: "p1", origin: widget }

  it("ta ista osoba, ten isty zdroj, v okne, najstarsia prva", () => {
    const rows = [
      { question: "Druha", answer: "Odpoved 2", createdAt: before(5), askedBy: "p1", origin: widget },
      { question: "Prva", answer: "Odpoved 1", createdAt: before(20), askedBy: "p1", origin: widget },
      { question: "Ina osoba", answer: "", createdAt: before(3), askedBy: "p2", origin: widget },
      { question: "Iny zdroj", answer: "", createdAt: before(3), askedBy: "p1", origin: { kind: "intranet" as const } },
      { question: "Davno", answer: "", createdAt: new Date(t0.getTime() - EARLIER_WINDOW_MS - 1), askedBy: "p1", origin: widget },
      { question: "Neskor", answer: "", createdAt: new Date(t0.getTime() + 1000), askedBy: "p1", origin: widget },
      target,
    ]
    expect(pickEarlier(target, rows).map(e => e.question)).toEqual(["Prva", "Druha"])
  })

  it("najviac tri, bez osoby ziadne", () => {
    const rows = [1, 2, 3, 4, 5].map(m => ({ question: `Q${m}`, answer: "", createdAt: before(m), askedBy: "p1", origin: widget }))
    expect(pickEarlier(target, rows).map(e => e.question)).toEqual(["Q3", "Q2", "Q1"])
    expect(pickEarlier({ ...target, askedBy: undefined }, rows)).toEqual([])
  })
})
