/**
 * personsUpsert.test.ts — čo import naozaj zapíše.
 *
 * Toto je test proti **dátovej strate**: `upsertPersons()` dlho zapisovalo
 * `tracks`, `groups` a `roles` vždy, takže súbor bez týchto stĺpcov ich
 * existujúcim ľuďom vyprázdnil — a `roles` CSV nerozpoznáva vôbec, takže
 * každý import zmazal roly každému, koho sa dotkol.
 *
 * Pravidlo, ktoré sa tu stráži: **chýbajúce pole znamená „o tomto nič
 * nehovorím", prázdne pole znamená „vyprázdni"**. Dva rôzne pokyny, ktoré
 * vyzerajú podobne a rozchádzajú sa presne vtedy, keď na tom záleží.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

interface Update { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> }
const updates: { key: unknown; update: Update }[] = []
let existing: Record<string, unknown> | null = null

const collection = {
  findOne: vi.fn(async () => existing),
  updateOne: vi.fn(async (key: unknown, update: Update) => {
    updates.push({ key, update })
    return { upsertedCount: existing ? 0 : 1, modifiedCount: existing ? 1 : 0 }
  }),
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async () => collection),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

import { upsertPersons } from "../src/lib/persons"
import type { NewPerson } from "../src/lib/persons"

const row = (over: Partial<NewPerson> = {}): NewPerson => ({
  email: "anna@futbalsfz.sk",
  fullName: "Anna Bieliková",
  companyCode: "SFZ",
  ...over,
})

beforeEach(() => {
  updates.length = 0
  existing = null
  vi.clearAllMocks()
})

const set = () => updates[0].update.$set
const onInsert = () => updates[0].update.$setOnInsert

describe("import zapisuje len to, co v riadku naozaj je", () => {
  it("chybajuci stlpec sa nezapise — existujucej osobe zostanu skupiny, trasy aj roly", async () => {
    existing = { groupHistory: [{ group: "rozhodcovia", from: new Date("2026-01-01") }] }
    await upsertPersons([row()], "test@futbalsfz.sk")

    expect(set()).not.toHaveProperty("groups")
    expect(set()).not.toHaveProperty("tracks")
    expect(set()).not.toHaveProperty("roles")
    // Ked sa skupiny nemenia, nema sa hybat ani ich historia (D50).
    expect(set()).not.toHaveProperty("groupHistory")
  })

  it("prazdne pole sa zapise — je to pokyn vyprazdnit", async () => {
    existing = { groupHistory: [{ group: "rozhodcovia", from: new Date("2026-01-01") }] }
    await upsertPersons([row({ groups: [], tracks: [], roles: [] })], "test@futbalsfz.sk")

    expect(set().groups).toEqual([])
    expect(set().tracks).toEqual([])
    expect(set().roles).toEqual([])
    // Otvorene clenstvo sa uzavrie, nezmizne: dokaz o tom, kto kedy v skupine bol.
    const history = set().groupHistory as { group: string; to?: Date }[]
    expect(history).toHaveLength(1)
    expect(history[0].group).toBe("rozhodcovia")
    expect(history[0].to).toBeInstanceOf(Date)
  })

  it("vyplnene zoznamy sa zapisu znormalizovane", async () => {
    await upsertPersons([row({ groups: [" Rozhodcovia ", "DELEGATI"], tracks: ["zaklad"] })], "a@b.sk")
    expect(set().groups).toEqual(["rozhodcovia", "delegati"])
    expect(set().tracks).toEqual(["zaklad"])
  })

  it("nova osoba dostane prazdne zoznamy, aj ked o nich riadok mlci", async () => {
    existing = null
    await upsertPersons([row()], "test@futbalsfz.sk")
    // V $setOnInsert, nie v $set: existujucej osobe sa tadialto nic nedotkne.
    expect(onInsert().tracks).toEqual([])
    expect(onInsert().groups).toEqual([])
    expect(onInsert().roles).toEqual([])
    expect(onInsert().groupHistory).toEqual([])
  })

  it("nova osoba s vyplnenymi zoznamami ich ma v $set, nie dvakrat", async () => {
    existing = null
    await upsertPersons([row({ groups: ["rozhodcovia"] })], "a@b.sk")
    expect(set().groups).toEqual(["rozhodcovia"])
    expect(onInsert()).not.toHaveProperty("groups")
  })
})
