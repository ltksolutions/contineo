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
  isEvaluator, needsEvaluation, evaluationContext, EVALUATOR_ROLE,
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
    currentPerson.mockResolvedValue(inTenant(["hr", "spravca-obsahu"]))
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
