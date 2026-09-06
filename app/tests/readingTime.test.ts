/**
 * readingTime.test.ts — čas čítania (O14).
 *
 * Testuje sa to, čo rozhoduje o tom, či je údaj použiteľný a či nie je
 * nebezpečný: strop, monotónnosť a to, že zlyhanie zápisu nesmie nič zhodiť.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

interface FakeCollection {
  findOne: ReturnType<typeof vi.fn>
  updateOne: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
}

const collections: Record<string, FakeCollection> = {}

function collection(title: string): FakeCollection {
  if (!collections[title]) {
    collections[title] = {
      findOne: vi.fn().mockResolvedValue(null),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, upsertedCount: 0 }),
      find: vi.fn().mockReturnValue({ toArray: async () => [] }),
    }
  }
  return collections[title]
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (title: string) => collection(title)),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

import {
  recordReading, readingFor, readingTimes, READING_COLLECTION, MAX_SECONDS, RETENTION_DAYS,
} from "../src/lib/readingTime"

const BASE = {
  companyCode: "sfz",
  personId: "p1",
  documentId: "sfz:eticky_kodex",
  versionId: "v-abc",
}

beforeEach(() => {
  for (const k of Object.keys(collections)) delete collections[k]
  vi.clearAllMocks()
})

describe("zapis casu citania", () => {
  it("uklada maximum, nie poslednu hodnotu", async () => {
    // Klient posiela suhrn od otvorenia. Pri druhom otvorení zacne od nuly
    // a poslednou hodnotou by prepisal poctivo odcitanych dvadsat minut.
    await recordReading({ ...BASE, seconds: 1200 })
    const update = collection(READING_COLLECTION).updateOne.mock.calls[0][1]
    expect(update.$max).toEqual({ seconds: 1200 })
    expect(update.$set.seconds).toBeUndefined()
  })

  it("kluc zapisu je osoba a znenie, nie dokument", async () => {
    // Nova verzia dokumentu je nove citanie — inak by sa cas z minuloroncej
    // verzie tvaril ako cas nad novou.
    await recordReading({ ...BASE, seconds: 60 })
    expect(collection(READING_COLLECTION).updateOne.mock.calls[0][0]).toEqual({
      personId: "p1", versionId: "v-abc",
    })
  })

  it("orezava na strop styroch hodin", async () => {
    await recordReading({ ...BASE, seconds: 999_999 })
    expect(collection(READING_COLLECTION).updateOne.mock.calls[0][1].$max.seconds).toBe(MAX_SECONDS)
  })

  it("nulu, zapor a nezmysel nezapisuje vobec", async () => {
    for (const seconds of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await recordReading({ ...BASE, seconds })
    }
    expect(collection(READING_COLLECTION).updateOne).not.toHaveBeenCalled()
  })

  it("zaokruhluje nadol — desatinne sekundy su predstieranie presnosti", async () => {
    await recordReading({ ...BASE, seconds: 90.7 })
    expect(collection(READING_COLLECTION).updateOne.mock.calls[0][1].$max.seconds).toBe(90)
  })

  it("zlyhanie zapisu nevyhodi vynimku", async () => {
    // Meranie bez nasledku nesmie zhodit potvrdenie, ktore nasledok ma.
    collection(READING_COLLECTION).updateOne.mockRejectedValue(new Error("mongo je prec"))
    await expect(recordReading({ ...BASE, seconds: 30 })).resolves.toBeUndefined()
  })
})

describe("citanie casov", () => {
  it("bez zaznamu vracia null, nie nulu", async () => {
    // Nula znamena „otvoril a hned zavrel"; null znamena „nevieme".
    expect(await readingFor("p1", "v-abc")).toBeNull()
  })

  it("prazdny zoznam zneni sa databazy vobec nepyta", async () => {
    expect((await readingTimes("p1", [])).size).toBe(0)
    expect(collection(READING_COLLECTION).find).not.toHaveBeenCalled()
  })

  it("cita viac zneni naraz, nie po jednom", async () => {
    collection(READING_COLLECTION).find.mockReturnValue({
      toArray: async () => [
        { versionId: "v-a", seconds: 120 },
        { versionId: "v-b", seconds: 30 },
      ],
    })
    const times = await readingTimes("p1", ["v-a", "v-b", "v-c"])
    expect(times.get("v-a")).toBe(120)
    expect(times.has("v-c")).toBe(false)
    expect(collection(READING_COLLECTION).find).toHaveBeenCalledTimes(1)
  })
})

describe("retencia", () => {
  it("je rok — kratsia by nepokryla rocny cyklus, dlhsia by drzala spravanie bez pouzitia", () => {
    expect(RETENTION_DAYS).toBe(365)
  })
})
