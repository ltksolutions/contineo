/**
 * tracks.test.ts — zápis trás (rozsah C).
 *
 * Trasa dovtedy vznikala len seedovacím skriptom, takže sa nedala pokaziť.
 * Odkedy ju skladá kurátor z obrazovky, pokaziť sa dá — a práve to sa tu
 * testuje: kľúč, ktorý ide do adries, poradie krokov a zapnutie prázdnej
 * trasy, ktorá by ľuďom tvrdila „hotovo“.
 *
 * Odvodený progres (D27) sa netestuje tu — je to čítanie, nie zápis.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

interface FakeCollection {
  findOne: ReturnType<typeof vi.fn>
  insertOne: ReturnType<typeof vi.fn>
  updateOne: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
}

const collections: Record<string, FakeCollection> = {}

function collection(title: string): FakeCollection {
  if (!collections[title]) {
    collections[title] = {
      findOne: vi.fn().mockResolvedValue(null),
      insertOne: vi.fn().mockResolvedValue({ insertedId: "id-1" }),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
      find: vi.fn().mockReturnValue({ sort: () => ({ toArray: async () => [] }) }),
    }
  }
  return collections[title]
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (title: string) => collection(title)),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

const { audit } = vi.hoisted(() => ({
  audit: vi.fn<(record: { subject: string; changes?: unknown }) => Promise<void>>(async () => {}),
}))
vi.mock("../src/lib/audit", async importOriginal => {
  const original = await importOriginal<typeof import("../src/lib/audit")>()
  return { ...original, writeAudit: audit }
})

import {
  createTrack,
  renameTrack,
  setTrackSteps,
  setTrackActive,
  allTracks,
  TrackError,
  TRACKS_COLLECTION,
  type Track,
} from "../src/lib/tracks"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents"

const COMPANY = "sfz"
const ACTOR = "kurator@futbalsfz.sk"

function existingTrack(over: Partial<Track> = {}): Track {
  return {
    companyCode: COMPANY,
    key: "novy-zamestnanec",
    title: "Nový zamestnanec",
    steps: [],
    isActive: false,
    ...over,
  }
}

beforeEach(() => {
  for (const k of Object.keys(collections)) delete collections[k]
  vi.clearAllMocks()
})

// ── kľúč ─────────────────────────────────────────────────────────────────────

describe("kluc trasy — ide do adries a zostava", () => {
  it("prijme kluc v spravnom tvare a zalozi trasu neaktivnu", async () => {
    await createTrack(COMPANY, { key: "novy-zamestnanec", title: "Nový zamestnanec" }, ACTOR)

    const written = collection(TRACKS_COLLECTION).insertOne.mock.calls[0][0]
    expect(written.key).toBe("novy-zamestnanec")
    // Prazdna trasa zapnuta by tvrdila „hotovo“ kazdemu, kto ju dostane.
    expect(written.isActive).toBe(false)
    expect(written.steps).toEqual([])
  })

  it("neprijme velke pismena, diakritiku, medzeru ani podciarkovnik", async () => {
    for (const bad of ["Nový", "novy zamestnanec", "novy_zamestnanec", "a", "-zaciatok"]) {
      await expect(
        createTrack(COMPANY, { key: bad, title: "Trasa" }, ACTOR),
        bad,
      ).rejects.toThrow(TrackError)
    }
  })

  it("velke pismena sa neodmietaju, ale zmensia — kluc je jeden, nie dva", async () => {
    // Odmietnut „NOVY“ by bolo prisne bez uzitku: v adrese aj tak skonci
    // v malych pismenach a dva kluce, ktore sa lisia len velkostou pismen,
    // by boli horsie nez jeden.
    await createTrack(COMPANY, { key: "NOVY-ZAMESTNANEC", title: "Nový zamestnanec" }, ACTOR)
    expect(collection(TRACKS_COLLECTION).insertOne.mock.calls[0][0].key).toBe("novy-zamestnanec")
  })

  it("prazdny kluc a prazdny nazov su chyba s vlastnym kodom", async () => {
    await expect(createTrack(COMPANY, { key: "  ", title: "Trasa" }, ACTOR))
      .rejects.toMatchObject({ code: "track.keyRequired" })
    await expect(createTrack(COMPANY, { key: "trasa", title: "   " }, ACTOR))
      .rejects.toMatchObject({ code: "track.titleRequired" })
  })

  it("dva razy ten isty kluc nejde", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(existingTrack())
    await expect(
      createTrack(COMPANY, { key: "novy-zamestnanec", title: "Nový zamestnanec" }, ACTOR),
    ).rejects.toMatchObject({ code: "track.alreadyExists", params: { key: "novy-zamestnanec" } })
  })
})

// ── kroky ────────────────────────────────────────────────────────────────────

describe("kroky trasy — poradie je poradie v poli", () => {
  it("ocisluje kroky podla poradia v poli, nie podla toho, co pride zvonka", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(existingTrack())
    collection(DOCUMENTS_COLLECTION).findOne.mockImplementation(async () => ({ documentId: "x" }))

    await setTrackSteps(
      COMPANY,
      "novy-zamestnanec",
      [{ documentId: "sfz:eticky_kodex" }, { documentId: "sfz:pracovny_poriadok" }],
      ACTOR,
    )

    const set = collection(TRACKS_COLLECTION).updateOne.mock.calls[0][1].$set
    expect(set.steps.map((s: { order: number }) => s.order)).toEqual([1, 2])
    expect(set.steps[0].documentId).toBe("sfz:eticky_kodex")
    expect(set.steps[0].type).toBe("document")
    // Potvrdenie je predvolene zapnute — krok bez neho je vedome rozhodnutie.
    expect(set.steps[0].requiresAcknowledgement).toBe(true)
  })

  it("ten isty dokument dva razy sa zapise raz", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(existingTrack())
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue({ documentId: "x" })

    await setTrackSteps(
      COMPANY,
      "novy-zamestnanec",
      [{ documentId: "sfz:eticky_kodex" }, { documentId: "sfz:eticky_kodex" }],
      ACTOR,
    )

    const set = collection(TRACKS_COLLECTION).updateOne.mock.calls[0][1].$set
    expect(set.steps).toHaveLength(1)
  })

  it("krok na cudzi dokument sa nezapise vobec — kurator sa o preklepe dozvie hned", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(existingTrack())
    collection(DOCUMENTS_COLLECTION).findOne.mockResolvedValue(null)

    await expect(
      setTrackSteps(COMPANY, "novy-zamestnanec", [{ documentId: "ine:norma" }], ACTOR),
    ).rejects.toMatchObject({ code: "track.documentNotFound", params: { documentId: "ine:norma" } })

    expect(collection(TRACKS_COLLECTION).updateOne).not.toHaveBeenCalled()
  })

  it("kroky trasy, ktora tu nie je, sa nezapisu", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(null)
    await expect(
      setTrackSteps(COMPANY, "neexistuje", [{ documentId: "x" }], ACTOR),
    ).rejects.toMatchObject({ code: "track.notFound" })
  })
})

// ── zapnutie ─────────────────────────────────────────────────────────────────

describe("zapnutie trasy", () => {
  it("prazdnu trasu zapnut nejde", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(existingTrack({ steps: [] }))
    await expect(setTrackActive(COMPANY, "novy-zamestnanec", true, ACTOR))
      .rejects.toMatchObject({ code: "track.noSteps" })
  })

  it("trasu s krokmi zapne a zapise do auditu", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(
      existingTrack({
        steps: [{ order: 1, type: "document", documentId: "x", requiresAcknowledgement: true }],
      }),
    )
    await setTrackActive(COMPANY, "novy-zamestnanec", true, ACTOR)

    expect(collection(TRACKS_COLLECTION).updateOne.mock.calls[0][1].$set).toEqual({ isActive: true })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ subject: "track" }))
  })

  it("vypnutie trasu nemaze — inak by sa o rok nedalo povedat, co mal kto prejst", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(
      existingTrack({
        isActive: true,
        steps: [{ order: 1, type: "document", documentId: "x", requiresAcknowledgement: true }],
      }),
    )
    await setTrackActive(COMPANY, "novy-zamestnanec", false, ACTOR)
    expect(collection(TRACKS_COLLECTION).updateOne.mock.calls[0][1].$set).toEqual({ isActive: false })
  })
})

// ── premenovanie a zoznam ────────────────────────────────────────────────────

describe("premenovanie a zoznam", () => {
  it("premenovanie zapise do auditu, co sa zmenilo", async () => {
    collection(TRACKS_COLLECTION).findOne.mockResolvedValue(existingTrack())
    await renameTrack(COMPANY, "novy-zamestnanec", { title: "Nástup" }, ACTOR)

    const record = audit.mock.calls[0][0]
    expect(record.subject).toBe("track")
    expect(JSON.stringify(record.changes)).toContain("Nástup")
  })

  it("kurator vidi aj neaktivne trasy — inak by rozrobenu uz nenasiel", async () => {
    const rows = [existingTrack({ isActive: false })]
    collection(TRACKS_COLLECTION).find.mockReturnValue({ sort: () => ({ toArray: async () => rows }) })

    await allTracks(COMPANY)
    const query = collection(TRACKS_COLLECTION).find.mock.calls[0][0]
    expect(query).toEqual({ companyCode: COMPANY })
    expect("isActive" in query).toBe(false)
  })
})
