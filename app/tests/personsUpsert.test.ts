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

  it("prazdne pole sa v rezime prepisu zapise — je to pokyn vyprazdnit", async () => {
    existing = { groupHistory: [{ group: "rozhodcovia", from: new Date("2026-01-01") }] }
    await upsertPersons([row({ groups: [], tracks: [], roles: [] })], "test@futbalsfz.sk", "overwrite")

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

/*
  ADR-019: existujúcej osobe sa predvolene **dopĺňajú len prázdne polia** —
  rovnako ako pri doplnení z adresára (`fillMissing`, D88). Súbor od
  personalistu je zdroj pre ľudí, ktorých systém nepozná; tí, ktorých pozná,
  si údaje mohli medzitým opraviť sami a import ich nesmie potichu vrátiť.
*/
describe("existujuca osoba: predvolene sa doplnaju len prazdne polia (ADR-019)", () => {
  const full = () => ({
    fullName: "Anna Stará",
    givenName: "Anna",
    surname: "Stará",
    jobTitle: "Referentka",
    department: "Ekonomické oddelenie",
    personType: "employee",
    language: "cs",
    groups: ["ekonomika"],
    tracks: ["zaklad"],
    groupHistory: [{ group: "ekonomika", from: new Date("2026-01-01") }],
  })

  it("co osoba uz ma, sa neprepise — ani ked subor nesie inu hodnotu", async () => {
    existing = full()
    const v = await upsertPersons(
      [row({ fullName: "Anna Nová", givenName: "Anna", surname: "Nová", jobTitle: "Vedúca", department: "IT", groups: ["it"], language: "en" })],
      "test@futbalsfz.sk",
    )
    // Nie je co zapisat — riadok sa zarata ako „bez zmeny" a do databazy nejde nic.
    expect(updates).toHaveLength(0)
    expect(v.unchanged).toBe(1)
    expect(v.updated).toBe(0)
  })

  it("prazdne polia sa doplnia, vyplnene ostanu", async () => {
    existing = { ...full(), jobTitle: "", mobilePhone: null, groups: [], groupHistory: [] }
    await upsertPersons(
      [row({ fullName: "Anna Nová", jobTitle: "Vedúca", mobilePhone: "+421900000000", groups: ["it"], department: "IT" })],
      "test@futbalsfz.sk",
    )
    expect(set().jobTitle).toBe("Vedúca")
    expect(set().mobilePhone).toBe("+421900000000")
    expect(set().groups).toEqual(["it"])
    // Historia clenstva ide so skupinami: doplnenie prazdnych skupin ju zalozi.
    expect(set().groupHistory).toBeDefined()
    expect(set()).not.toHaveProperty("fullName")
    expect(set()).not.toHaveProperty("department")
    expect(set()).not.toHaveProperty("personType")
    expect(set()).not.toHaveProperty("language")
  })

  it("ked sa skupiny nedoplnaju, nehybe sa ani ich historia", async () => {
    existing = { ...full(), jobTitle: "" }
    await upsertPersons([row({ jobTitle: "Vedúca", groups: ["it"] })], "test@futbalsfz.sk")
    expect(set().jobTitle).toBe("Vedúca")
    expect(set()).not.toHaveProperty("groups")
    expect(set()).not.toHaveProperty("groupHistory")
  })

  it("v rezime prepisu sa existujuca hodnota prepise", async () => {
    existing = full()
    await upsertPersons([row({ fullName: "Anna Nová", jobTitle: "Vedúca", groups: ["it"] })], "test@futbalsfz.sk", "overwrite")
    expect(set().fullName).toBe("Anna Nová")
    expect(set().jobTitle).toBe("Vedúca")
    expect(set().groups).toEqual(["it"])
  })

  it("chybajuce oddelenie a nastup sa do $set nedostanu ani ako undefined", async () => {
    // Driver by `undefined` ulozil ako `null` — a to je prepis, nie mlcanie.
    existing = full()
    await upsertPersons([row({ fullName: "Anna Nová" })], "test@futbalsfz.sk", "overwrite")
    expect(set()).not.toHaveProperty("department")
    expect(set()).not.toHaveProperty("startDate")
  })

  it("nova osoba sa zaklada rovnako v oboch rezimoch", async () => {
    existing = null
    await upsertPersons([row({ jobTitle: "Vedúca", department: "IT" })], "test@futbalsfz.sk")
    expect(set().fullName).toBe("Anna Bieliková")
    expect(set().jobTitle).toBe("Vedúca")
    expect(set().department).toBe("IT")
    expect(onInsert().status).toBe("invited")
  })
})
