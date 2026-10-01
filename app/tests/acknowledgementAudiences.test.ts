/**
 * acknowledgementAudiences.test.ts — potvrdzovanie od pridelenia po výkaz,
 * pre každý druh publika: osoba, oddelenie, trasa (pridelenie aj krok trasy).
 *
 * Ostatné testy skúšajú články reťaze oddelene a susedov si podvrhnú:
 * `pending.test.ts` dostane pridelenia hotové z atrapy, `hrReport.test.ts`
 * vráti z každého dotazu celú kolekciu bez ohľadu na podmienku. Pravidlo
 * príslušnosti sa tak nikde neskúša spolu s **dotazom**, ktorý mu vyberá
 * kandidátov (`assignmentsForPerson`). Keby sa dotaz a `matchesAudience()`
 * rozišli — napríklad pri veľkých písmenách v adrese alebo pri nadradenom
 * oddelení — človek by povinnosť vo výkaze mal a na obrazovke nie.
 *
 * Preto tu beží **skutočný kód celej reťaze** a podvrhnutá je len databáza:
 * pamäťová kolekcia, ktorá podmienky dotazu naozaj vyhodnocuje (tú podmnožinu
 * operátorov, ktorú reťaz používa). Neznámy operátor test zhodí — radšej
 * hlasné zlyhanie než dotaz, ktorý v teste „sedí na všetko".
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

type Row = Record<string, unknown>

const data: Record<string, Row[]> = {}

/** Hodnoty na ceste `a.b.c` — cez polia ako v Mongu (`audience.value`, `departmentHistory.departmentPath`). */
function valuesAt(doc: unknown, path: string[]): unknown[] {
  if (path.length === 0) return Array.isArray(doc) ? [doc, ...doc] : [doc]
  if (Array.isArray(doc)) return doc.flatMap(d => valuesAt(d, path))
  if (doc === null || typeof doc !== "object") return [undefined]
  return valuesAt((doc as Row)[path[0]], path.slice(1))
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  // `{ pole: null }` v Mongu sedí aj na chýbajúce pole.
  if (b === null) return a === null || a === undefined
  return a === b
}

function matches(doc: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return (cond as Row[]).some(f => matches(doc, f))
    const values = valuesAt(doc, key.split("."))
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      return Object.entries(cond as Row).every(([op, arg]) => {
        switch (op) {
          case "$in": return values.some(v => (arg as unknown[]).some(x => same(v, x)))
          case "$ne": return !values.some(v => same(v, arg))
          case "$exists": return values.some(v => v !== undefined) === arg
          default: throw new Error(`pamäťová kolekcia nepozná operátor ${op}`)
        }
      })
    }
    return values.some(v => same(v, cond))
  })
}

function collection(name: string) {
  const rows = () => (data[name] ??= [])
  const cursor = (found: Row[]) => {
    let out = found
    const c = {
      sort: (spec: Record<string, 1 | -1>) => {
        const [[field, dir]] = Object.entries(spec)
        out = [...out].sort((a, b) => (a[field] as number) > (b[field] as number) ? dir : -dir)
        return c
      },
      limit: (n: number) => { out = out.slice(0, n); return c },
      toArray: async () => out,
    }
    return c
  }
  return {
    find: (filter: Row = {}) => cursor(rows().filter(r => matches(r, filter))),
    findOne: async (filter: Row = {}) => rows().find(r => matches(r, filter)) ?? null,
    countDocuments: async (filter: Row = {}) => rows().filter(r => matches(r, filter)).length,
    insertOne: async (doc: Row) => {
      const _id = `${name}-${rows().length + 1}`
      rows().push({ _id, ...doc })
      return { insertedId: _id }
    },
  }
}

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (name: string) => collection(name)),
  getDb: vi.fn(),
  getClient: vi.fn(),
}))

import { assign } from "../src/lib/assignments"
import type { Audience } from "../src/lib/assignments"
import { acknowledge, ACKNOWLEDGEMENTS_COLLECTION } from "../src/lib/acknowledgements"
import { acknowledgementDuties } from "../src/lib/pending"
import { duties } from "../src/lib/hrReport"
import { PERSONS_COLLECTION } from "../src/lib/persons"
import type { Person } from "../src/lib/persons"
import { DOCUMENTS_COLLECTION } from "../src/lib/documents"
import { TRACKS_COLLECTION } from "../src/lib/tracks"
import { DEPARTMENTS_COLLECTION } from "../src/lib/departments"

const COMPANY = "sfz"
const DAY = 24 * 60 * 60 * 1000
const EFFECTIVE = new Date(Date.now() - 30 * DAY)

/*
 * Organizácia: úsek → oddelenie pod ním, a jedno oddelenie vedľa.
 *
 *   eva    — v oddelení pod úsekom (cesta úsek › oddelenie)
 *   marta  — v inom oddelení
 *   jan    — bez oddelenia, na trase „zaklad"
 *   peter  — nikde; kontrola, že sa povinnosť nerozleje na všetkých
 */
const USEK = "3f1c0b7e-0000-4000-8000-00000000usek"
const ODDELENIE = "3f1c0b7e-0000-4000-8000-0000000oddel"
const INE = "3f1c0b7e-0000-4000-8000-00000000ine0"

function person(id: string, over: Partial<Person> = {}): Person {
  return {
    id,
    companyCode: COMPANY,
    email: `${id}@futbalsfz.sk`,
    fullName: id.toUpperCase(),
    personType: "employee",
    status: "active",
    language: "sk",
    roles: [],
    groups: [],
    tracks: [],
    departmentPath: [],
    createdAt: new Date(Date.now() - 365 * DAY),
    ...over,
  } as Person
}

const eva = person("eva", {
  departmentId: ODDELENIE,
  departmentPath: [USEK, ODDELENIE],
  departmentHistory: [{ departmentId: ODDELENIE, departmentPath: [USEK, ODDELENIE], from: new Date(Date.now() - 365 * DAY) }],
} as Partial<Person>)
const marta = person("marta", {
  departmentId: INE,
  departmentPath: [INE],
  departmentHistory: [{ departmentId: INE, departmentPath: [INE], from: new Date(Date.now() - 365 * DAY) }],
} as Partial<Person>)
const jan = person("jan", { tracks: ["zaklad"] })
const peter = person("peter")
const everyone = [eva, marta, jan, peter]

const SUBJECT = {
  documentId: "smernica-gdpr",
  versionId: "v1",
  documentTitle: "Smernica o ochrane osobných údajov",
  versionLabel: "1.0",
  effectiveFrom: EFFECTIVE,
}

function give(audience: Audience) {
  return assign({
    companyCode: COMPANY,
    subject: SUBJECT,
    audience,
    reason: "nová smernica",
    assignedBy: "hr@futbalsfz.sk",
  })
}

function confirm(who: Person) {
  return acknowledge({
    personId: who.id, email: who.email, fullName: who.fullName,
    companyCode: who.companyCode, language: who.language, departmentId: who.departmentId ?? null,
  }, SUBJECT.documentId, { ip: "203.0.113.7", userAgent: "vitest" })
}

/** Čo osoba vidí na „Na potvrdenie" — dokumenty z trás aj mimo nich. */
async function onScreen(who: Person): Promise<string[]> {
  const d = await acknowledgementDuties(who)
  return [...d.fromTracks, ...d.outsideTracks].map(i => i.id)
}

/** Riadky výkazu HR pre dokument: osoba → potvrdené? */
async function report(): Promise<Record<string, boolean>> {
  const rows = (await duties(COMPANY)).filter(d => d.documentId === SUBJECT.documentId)
  return Object.fromEntries(rows.map(d => [d.personId, d.acknowledgedAt !== null]))
}

function stepTrack() {
  data[TRACKS_COLLECTION].push({
    companyCode: COMPANY, key: "zaklad", title: "Základný onboarding", isActive: true,
    steps: [{ order: 1, type: "document", documentId: SUBJECT.documentId, requiresAcknowledgement: true }],
  })
}

beforeEach(() => {
  for (const k of Object.keys(data)) delete data[k]
  data[PERSONS_COLLECTION] = everyone.map(p => ({ ...p }))
  data[DEPARTMENTS_COLLECTION] = [
    { companyCode: COMPANY, id: USEK, name: "Úsek generálneho sekretára", parentId: null },
    { companyCode: COMPANY, id: ODDELENIE, name: "Právne oddelenie", parentId: USEK },
    { companyCode: COMPANY, id: INE, name: "Marketing", parentId: null },
  ]
  data[DOCUMENTS_COLLECTION] = [{
    companyCode: COMPANY,
    documentId: SUBJECT.documentId,
    title: SUBJECT.documentTitle,
    status: "published",
    // Znenie spred schvaľovania (D74) — brána pri prideľovaní ho pustí bez kôl.
    versions: [{
      versionId: SUBJECT.versionId, label: SUBJECT.versionLabel, effectiveFrom: EFFECTIVE,
      effectiveTo: null, isActive: true, publishedBefore: true,
    }],
  }]
  data[TRACKS_COLLECTION] = []
})

describe("pridelenie osobe", () => {
  it("dostane ho len tá osoba — aj keď je adresa napísaná veľkými písmenami", async () => {
    expect((await give({ kind: "person", value: "EVA@FutbalSFZ.sk" })).status).toBe("pridelene")

    expect(await onScreen(eva)).toEqual([SUBJECT.documentId])
    for (const other of [marta, jan, peter]) expect(await onScreen(other)).toEqual([])
    expect(await report()).toEqual({ eva: false })
  })

  it("po potvrdení zmizne z obrazovky a vo výkaze je splnené", async () => {
    await give({ kind: "person", value: eva.email })
    const r = await confirm(eva)
    expect(r.ok).toBe(true)

    expect(await onScreen(eva)).toEqual([])
    expect(await report()).toEqual({ eva: true })
  })

  it("potvrdenie cudzej osoby povinnosť nesplní", async () => {
    await give({ kind: "person", value: eva.email })
    await confirm(peter)

    expect(await onScreen(eva)).toEqual([SUBJECT.documentId])
    expect(await report()).toEqual({ eva: false })
  })
})

describe("pridelenie oddeleniu", () => {
  it("pridelenie nadradenému úseku dostanú aj ľudia v oddelení pod ním", async () => {
    await give({ kind: "department", value: USEK })

    expect(await onScreen(eva)).toEqual([SUBJECT.documentId])
    for (const other of [marta, jan, peter]) expect(await onScreen(other)).toEqual([])
    expect(await report()).toEqual({ eva: false })
  })

  it("pridelenie priamo oddeleniu sedí tiež", async () => {
    await give({ kind: "department", value: ODDELENIE })
    expect(await onScreen(eva)).toEqual([SUBJECT.documentId])
    expect(await report()).toEqual({ eva: false })
  })

  it("po potvrdení zmizne a záznam nesie oddelenie tak, ako sa vtedy volalo", async () => {
    await give({ kind: "department", value: USEK })
    expect((await confirm(eva)).ok).toBe(true)

    expect(await onScreen(eva)).toEqual([])
    expect(await report()).toEqual({ eva: true })
    const record = data[ACKNOWLEDGEMENTS_COLLECTION]?.find(a => a.personId === "eva")
    expect(record?.departmentNames).toEqual(["Úsek generálneho sekretára", "Právne oddelenie"])
  })

  it("úloha visí odo dňa príchodu do oddelenia, nie od pridelenia (D50)", async () => {
    await give({ kind: "department", value: USEK })
    const arrived = new Date(Date.now() + 1000)
    const newcomer = person("nova", {
      departmentId: ODDELENIE,
      departmentPath: [USEK, ODDELENIE],
      departmentHistory: [{ departmentId: ODDELENIE, departmentPath: [USEK, ODDELENIE], from: arrived }],
    } as Partial<Person>)
    data[PERSONS_COLLECTION].push({ ...newcomer })

    // Prihlásila sa po pridelení, ale pred príchodom do oddelenia — úloha je
    // pre ňu nová, lebo ju dostala až príchodom.
    const d = await acknowledgementDuties({ ...newcomer, previousLoginAt: new Date() } as Person)
    expect(d.outsideTracks.map(i => i.assignedAt?.getTime())).toEqual([arrived.getTime()])
    expect(d.outsideTracks[0].isNew).toBe(true)
    expect(await report()).toEqual({ eva: false, nova: false })
  })

  it("pri pridelení oddeleniu aj osobe platí skorší termín, nie ten posledný", async () => {
    await assign({
      companyCode: COMPANY, subject: SUBJECT, audience: { kind: "department", value: USEK },
      reason: "nová smernica", assignedBy: "hr@futbalsfz.sk", due: { kind: "days", days: 7 },
    })
    await assign({
      companyCode: COMPANY, subject: SUBJECT, audience: { kind: "person", value: eva.email },
      reason: "pripomenutie", assignedBy: "hr@futbalsfz.sk", due: { kind: "days", days: 30 },
    })

    const d = await acknowledgementDuties(eva)
    expect(d.outsideTracks).toHaveLength(1)
    const days = (d.outsideTracks[0].due!.getTime() - d.outsideTracks[0].assignedAt!.getTime()) / DAY
    expect(Math.round(days)).toBe(7)
    const row = (await duties(COMPANY)).find(r => r.personId === "eva")
    expect(row?.due?.getTime()).toBe(d.outsideTracks[0].due?.getTime())
  })
})

describe("trasa", () => {
  it("pridelenie trase dostanú len ľudia na nej", async () => {
    await give({ kind: "track", value: "zaklad" })

    expect(await onScreen(jan)).toEqual([SUBJECT.documentId])
    for (const other of [eva, marta, peter]) expect(await onScreen(other)).toEqual([])
    expect(await report()).toEqual({ jan: false })
  })

  it("krok trasy je povinnosť aj bez pridelenia a potvrdením sa splní", async () => {
    stepTrack()

    const before = await acknowledgementDuties(jan)
    expect(before.fromTracks.map(i => i.id)).toEqual([SUBJECT.documentId])
    expect(before.tracks[0]).toMatchObject({ doneCount: 0, totalCount: 1, nextOrder: 1 })
    expect(await report()).toEqual({ jan: false })

    expect((await confirm(jan)).ok).toBe(true)

    const after = await acknowledgementDuties(jan)
    expect(after.fromTracks).toEqual([])
    expect(after.tracks[0]).toMatchObject({ doneCount: 1, totalCount: 1, nextOrder: null })
    expect(await report()).toEqual({ jan: true })
  })

  it("krok trasy s pridelením tej istej normy je jedna úloha s dvomi dôvodmi", async () => {
    stepTrack()
    await give({ kind: "track", value: "zaklad" })

    const d = await acknowledgementDuties(jan)
    expect(d.fromTracks.map(i => i.id)).toEqual([SUBJECT.documentId])
    expect(d.outsideTracks).toEqual([])
    // Čas úlohy z trasy berie pridelenie — bez neho by bol neznámy.
    expect(d.fromTracks[0].assignedAt).toBeInstanceOf(Date)

    const rows = (await duties(COMPANY)).filter(r => r.personId === "jan")
    expect(rows).toHaveLength(1)
    expect(rows[0].sources.sort()).toEqual(["assignment", "track"])
  })
})

describe("všetky tri cesty naraz", () => {
  it("jedna osoba tromi cestami má jednu úlohu a jedno potvrdenie ju splní celú", async () => {
    // Eva je v oddelení, dostane normu osobne aj na trase — tri dôvody, jedna povinnosť.
    const all3 = { ...eva, tracks: ["zaklad"] } as Person
    data[PERSONS_COLLECTION] = data[PERSONS_COLLECTION].map(p => (p.id === "eva" ? { ...all3 } : p))
    stepTrack()
    await give({ kind: "person", value: eva.email })
    await give({ kind: "department", value: USEK })

    expect(await onScreen(all3)).toEqual([SUBJECT.documentId])
    expect(await report()).toEqual({ eva: false, jan: false })

    expect((await confirm(all3)).ok).toBe(true)

    expect(await onScreen(all3)).toEqual([])
    expect(await report()).toEqual({ eva: true, jan: false })
    expect(data[ACKNOWLEDGEMENTS_COLLECTION]).toHaveLength(1)
  })
})

describe("dvojité potvrdenie (naostro 1. 10. 2026)", () => {
  it("druhé potvrdenie z iného zariadenia sa odmietne — záznam zostane jeden", async () => {
    await give({ kind: "person", value: eva.email })
    expect((await confirm(eva)).ok).toBe(true)

    // Stránka otvorená na druhom zariadení ešte pred prvým potvrdením.
    const second = await confirm(eva)
    expect(second).toEqual({ ok: false, reason: "already-acknowledged" })
    expect(data[ACKNOWLEDGEMENTS_COLLECTION].filter(a => a.personId === "eva")).toHaveLength(1)
  })

  it("po odvolaní sa dá potvrdiť znova — ako nový cyklus", async () => {
    await give({ kind: "person", value: eva.email })
    await confirm(eva)
    const first = data[ACKNOWLEDGEMENTS_COLLECTION][0]
    data[ACKNOWLEDGEMENTS_COLLECTION].push({ ...first, _id: "rev-1", type: "revocation" })
    expect(await onScreen(eva)).toEqual([SUBJECT.documentId])

    expect((await confirm(eva)).ok).toBe(true)
    const cycles = data[ACKNOWLEDGEMENTS_COLLECTION]
      .filter(a => a.personId === "eva" && a.type === "acknowledgement").map(a => a.cycle)
    expect(cycles).toEqual([1, 2])
    expect(await onScreen(eva)).toEqual([])
  })
})
