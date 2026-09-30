/**
 * askHistory.test.ts — história otázok (ASK-historia-otazok, H1–H4).
 *
 * Tri veci, ktoré sa pokazia ticho: cudzia otázka v mojej histórii (D32),
 * otázka, ktorá po posúdení prejde k hodnotiteľovi (`reviewer` sa prepisuje),
 * a uložená odpoveď, ktorú otvorí niekto iný než ten, kto sa pýtal (H3).
 */

import { describe, it, expect, vi } from "vitest"
import { ObjectId } from "mongodb"

const records: Record<string, unknown>[] = []
vi.mock("../src/lib/mongodb", () => ({
  getCollection: async () => ({
    createIndex: async () => "ok",
    findOne: async (f: { _id: ObjectId; companyCode: string }) =>
      records.find(r => String(r._id) === String(f._id) && r.companyCode === f.companyCode) ?? null,
  }),
}))

import { askerFilter, answerForViewer } from "../src/lib/askHistory"
import { matchesQuery, distinctQuestions, foldText } from "../src/lib/askHistoryMatch"

describe("hľadanie v histórii", () => {
  it("bez diakritiky a veľkosti písmen", () => {
    expect(matchesQuery("Za akých podmienok môže prestúpiť maloletý hráč?", "prestupit HRAC")).toBe(true)
  })

  it("všetky slová naraz (AND)", () => {
    expect(matchesQuery("Lehota na podanie námietky", "lehota namietky")).toBe(true)
    expect(matchesQuery("Lehota na podanie námietky", "lehota prestup")).toBe(false)
  })

  it("prázdne hľadanie zodpovedá všetkému", () => {
    expect(matchesQuery("čokoľvek", "  ")).toBe(true)
  })

  it("tá istá otázka viackrát je jeden riadok — najnovší", () => {
    const out = distinctQuestions([
      { id: "3", question: "Lehota na námietku?" },
      { id: "2", question: "lehota na  NÁMIETKU?" },
      { id: "1", question: "Iná otázka" },
    ])
    expect(out.map(o => o.id)).toEqual(["3", "1"])
  })

  it("foldText", () => {
    expect(foldText("Ľubovoľná Ťava")).toBe("lubovolna tava")
  })
})

describe("kto sa pýtal", () => {
  it("vlastná organizácia, neskryté, askedBy alebo neposúdený reviewer", () => {
    const f = askerFilter("SFZ", "p1") as Record<string, unknown>
    expect(f.companyCode).toBe("SFZ")
    expect(f.hiddenForAsker).toEqual({ $ne: true })
    expect(f.$or).toEqual([
      { askedBy: "p1" },
      { askedBy: { $exists: false }, reviewer: "p1", evaluatedAt: { $exists: false } },
    ])
  })

  it("bez organizácie odmietne (D90)", () => {
    expect(() => askerFilter("", "p1")).toThrow()
  })
})

describe("uložená odpoveď (H3)", () => {
  const id = new ObjectId()
  const legacy = new ObjectId()
  const evaluated = new ObjectId()
  records.push(
    { _id: id, companyCode: "SFZ", askedBy: "p1", reviewer: "eval1", evaluatedAt: new Date(), question: "q" },
    { _id: legacy, companyCode: "SFZ", reviewer: "p2", question: "q" },
    { _id: evaluated, companyCode: "SFZ", reviewer: "eval1", evaluatedAt: new Date(), question: "q" },
  )

  it("otvorí ten, kto sa pýtal — aj po posúdení", async () => {
    expect(await answerForViewer("SFZ", String(id), "p1", false)).not.toBeNull()
  })

  it("cudzia osoba nie", async () => {
    expect(await answerForViewer("SFZ", String(id), "p9", false)).toBeNull()
  })

  it("hodnotiteľ áno", async () => {
    expect(await answerForViewer("SFZ", String(id), "p9", true)).not.toBeNull()
  })

  it("cudzia organizácia nie, ani hodnotiteľovi", async () => {
    expect(await answerForViewer("INY", String(id), "p1", true)).toBeNull()
  })

  it("starší záznam bez askedBy: reviewer, kým nebol posúdený", async () => {
    expect(await answerForViewer("SFZ", String(legacy), "p2", false)).not.toBeNull()
    // Po posúdení je v `reviewer` hodnotiteľ — autor sa nedá zistiť.
    expect(await answerForViewer("SFZ", String(evaluated), "eval1", false)).toBeNull()
  })

  it("neplatné id", async () => {
    expect(await answerForViewer("SFZ", "nie-je-id", "p1", false)).toBeNull()
  })
})
