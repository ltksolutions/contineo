/**
 * hrReport.test.ts — výkaz potvrdení (D33).
 *
 * Testuje sa menovateľ. Je to jediné číslo vo výkaze, ktoré sa nedá overiť
 * pohľadom: keď je zlé, výkaz vyzerá presne tak isto ako keď je správne.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

interface Row { [key: string]: unknown }

const data: Record<string, Row[]> = {}

function collection(title: string) {
  return {
    find: vi.fn(() => ({ toArray: async () => data[title] ?? [] })),
  }
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (title: string) => collection(title)),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

import { duties, byDocument, byPerson, byTrack, median } from "../src/lib/hrReport"
import { PERSONS_COLLECTION } from "../src/lib/persons"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents"
import { ACKNOWLEDGEMENTS_COLLECTION } from "../src/lib/acknowledgements"
import { ASSIGNMENTS_COLLECTION } from "../src/lib/assignments"
import { TRACKS_COLLECTION } from "../src/lib/tracks"
import { READING_COLLECTION } from "../src/lib/readingTime"

const COMPANY = "sfz"
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000)

function person(id: string, over: Row = {}): Row {
  return { id, email: `${id}@futbalsfz.sk`, fullName: id.toUpperCase(), tracks: [], groups: [], ...over }
}

/** Dokument s jedným platným znením — `effectiveVersion()` ho musí prijať. */
function document(documentId: string, versionId: string): Row {
  return {
    companyCode: COMPANY, documentId, title: `Titul ${documentId}`, status: "published",
    versions: [{ versionId, label: "1.0", effectiveFrom: YESTERDAY, effectiveTo: null, isActive: true }],
  }
}

beforeEach(() => {
  for (const k of Object.keys(data)) delete data[k]
  data[PERSONS_COLLECTION] = []
  data[DOCUMENTS_COLLECTION] = []
  data[ASSIGNMENTS_COLLECTION] = []
  data[TRACKS_COLLECTION] = []
  data[ACKNOWLEDGEMENTS_COLLECTION] = []
  data[READING_COLLECTION] = []
  vi.clearAllMocks()
})

describe("menovatel — pridelenie aj trasa", () => {
  it("pridelenie na vsetkych zalozi povinnost kazdemu", async () => {
    data[PERSONS_COLLECTION] = [person("a"), person("b")]
    data[ASSIGNMENTS_COLLECTION] = [{
      companyCode: COMPANY, revokedAt: null, audience: { kind: "all" }, reason: "novela",
      subject: { documentId: "d1", versionId: "v1", documentTitle: "Etický kódex", versionLabel: "1.0" },
    }]

    const rows = await duties(COMPANY)
    expect(rows).toHaveLength(2)
    expect(rows.every(d => d.sources).valueOf()).toBe(true)
    expect(rows[0].sources).toEqual(["assignment"])
  })

  it("trasa zaklada povinnost len tym, ktori ju maju", async () => {
    data[PERSONS_COLLECTION] = [person("a", { tracks: ["nastup"] }), person("b")]
    data[DOCUMENTS_COLLECTION] = [document("d1", "v1")]
    data[TRACKS_COLLECTION] = [{
      companyCode: COMPANY, key: "nastup", title: "Nástup", isActive: true,
      steps: [{ order: 1, type: "document", documentId: "d1", requiresAcknowledgement: true }],
    }]

    const rows = await duties(COMPANY)
    expect(rows).toHaveLength(1)
    expect(rows[0].personId).toBe("a")
    expect(rows[0].trackTitles).toEqual(["Nástup"])
  })

  it("ten isty dokument z trasy aj z pridelenia je JEDNA povinnost s dvomi dovodmi", async () => {
    // Inak by sa dal sucet „nepotvrdenych" nafuknut tym, ze sa to iste
    // pridelí dvakrat.
    data[PERSONS_COLLECTION] = [person("a", { tracks: ["nastup"] })]
    data[DOCUMENTS_COLLECTION] = [document("d1", "v1")]
    data[TRACKS_COLLECTION] = [{
      companyCode: COMPANY, key: "nastup", title: "Nástup", isActive: true,
      steps: [{ order: 1, type: "document", documentId: "d1", requiresAcknowledgement: true }],
    }]
    data[ASSIGNMENTS_COLLECTION] = [{
      companyCode: COMPANY, revokedAt: null, audience: { kind: "all" }, reason: "novela",
      subject: { documentId: "d1", versionId: "v1", documentTitle: "Titul d1", versionLabel: "1.0" },
    }]

    const rows = await duties(COMPANY)
    expect(rows).toHaveLength(1)
    expect(rows[0].sources).toEqual(["assignment", "track"])
  })

  it("krok bez potvrdzovania povinnost nezaklada", async () => {
    data[PERSONS_COLLECTION] = [person("a", { tracks: ["nastup"] })]
    data[DOCUMENTS_COLLECTION] = [document("d1", "v1")]
    data[TRACKS_COLLECTION] = [{
      companyCode: COMPANY, key: "nastup", title: "Nástup", isActive: true,
      steps: [{ order: 1, type: "document", documentId: "d1", requiresAcknowledgement: false }],
    }]
    expect(await duties(COMPANY)).toHaveLength(0)
  })

  it("dokument bez platneho znenia povinnost nezaklada", async () => {
    // Vykaz by inak tvrdil, ze ludia nepotvrdili nieco, co im systém
    // nikdy neukazal (D6).
    data[PERSONS_COLLECTION] = [person("a", { tracks: ["nastup"] })]
    data[DOCUMENTS_COLLECTION] = [{
      companyCode: COMPANY, documentId: "d1", title: "Bez platnosti", status: "published",
      versions: [{ versionId: "v1", label: "1.0", effectiveFrom: null, effectiveTo: null, isActive: true }],
    }]
    data[TRACKS_COLLECTION] = [{
      companyCode: COMPANY, key: "nastup", title: "Nástup", isActive: true,
      steps: [{ order: 1, type: "document", documentId: "d1", requiresAcknowledgement: true }],
    }]
    expect(await duties(COMPANY)).toHaveLength(0)
  })
})

describe("potvrdenia a cas citania", () => {
  beforeEach(() => {
    data[PERSONS_COLLECTION] = [person("a"), person("b")]
    data[ASSIGNMENTS_COLLECTION] = [{
      companyCode: COMPANY, revokedAt: null, audience: { kind: "all" }, reason: "novela",
      subject: { documentId: "d1", versionId: "v1", documentTitle: "Etický kódex", versionLabel: "1.0" },
    }]
  })

  it("spari potvrdenie s osobou a znenim", async () => {
    const when = new Date("2026-09-01T10:00:00Z")
    data[ACKNOWLEDGEMENTS_COLLECTION] = [{ personId: "a", versionId: "v1", acknowledgedAt: when }]

    const rows = await duties(COMPANY)
    expect(rows.find(d => d.personId === "a")?.acknowledgedAt).toEqual(when)
    expect(rows.find(d => d.personId === "b")?.acknowledgedAt).toBeNull()
  })

  it("nenamerany cas je null, nie nula", async () => {
    // Nula znamena „otvoril a hned zavrel". Keby sa nenamerany cas ratal
    // ako nula, kazda nova smernica by vyzerala, ze ju nikto necita.
    data[READING_COLLECTION] = [{ personId: "a", versionId: "v1", seconds: 120 }]
    const rows = await duties(COMPANY)
    expect(rows.find(d => d.personId === "a")?.readingSeconds).toBe(120)
    expect(rows.find(d => d.personId === "b")?.readingSeconds).toBeNull()
  })

  it("median pocita len z nameraneho", async () => {
    data[READING_COLLECTION] = [{ personId: "a", versionId: "v1", seconds: 120 }]
    expect(byDocument(await duties(COMPANY))[0].medianSeconds).toBe(120)
  })
})

describe("zhrnutia", () => {
  beforeEach(async () => {
    data[PERSONS_COLLECTION] = [person("a", { tracks: ["nastup"] }), person("b", { tracks: ["nastup"] })]
    data[DOCUMENTS_COLLECTION] = [document("d1", "v1"), document("d2", "v2")]
    data[TRACKS_COLLECTION] = [{
      companyCode: COMPANY, key: "nastup", title: "Nástup", isActive: true,
      steps: [
        { order: 1, type: "document", documentId: "d1", requiresAcknowledgement: true },
        { order: 2, type: "document", documentId: "d2", requiresAcknowledgement: true },
      ],
    }]
    data[ACKNOWLEDGEMENTS_COLLECTION] = [{ personId: "a", versionId: "v1", acknowledgedAt: YESTERDAY }]
  })

  it("podla dokumentu — dva dokumenty, dvaja ludia", async () => {
    const rows = byDocument(await duties(COMPANY))
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.total === 2)).toBe(true)
    // Hore je to, kde chyba najviac — s tym sa da nieco spravit.
    expect(rows[0].done).toBe(0)
  })

  it("podla osoby — kazdy ma dve povinnosti", async () => {
    const rows = byPerson(await duties(COMPANY))
    expect(rows).toHaveLength(2)
    expect(rows.map(r => r.total)).toEqual([2, 2])
  })

  it("podla trasy — jedna trasa, styri povinnosti", async () => {
    const rows = byTrack(await duties(COMPANY))
    expect(rows).toHaveLength(1)
    expect(rows[0].total).toBe(4)
    expect(rows[0].done).toBe(1)
  })

  it("do pohladu podla trasy nevstupuju povinnosti bez trasy", async () => {
    data[ASSIGNMENTS_COLLECTION] = [{
      companyCode: COMPANY, revokedAt: null, audience: { kind: "all" }, reason: "novela",
      subject: { documentId: "d9", versionId: "v9", documentTitle: "Iné", versionLabel: "1.0" },
    }]
    const rows = byTrack(await duties(COMPANY))
    expect(rows).toHaveLength(1)
    expect(rows[0].total).toBe(4)
  })
})

describe("median", () => {
  it("neparny pocet vracia prostrednu hodnotu", () => {
    expect(median([10, 1000, 20])).toBe(20)
  })

  it("parny pocet vracia priemer dvoch prostrednych", () => {
    expect(median([10, 20, 30, 40])).toBe(25)
  })

  it("jedna extremna hodnota median neposunie", () => {
    // Presne preto je to median a nie priemer: kto necha kartu otvorenu
    // do stropu, posunie priemer o hodiny.
    expect(median([30, 40, 50, 60, 14400])).toBe(50)
  })

  it("bez hodnot vracia null", () => {
    expect(median([])).toBeNull()
  })
})
