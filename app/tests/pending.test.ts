/**
 * pending.test.ts — zoznam „čo čaká na mňa" (D36, Fáza 9 rozsah A).
 *
 * Testuje sa to, čo môže človeku ukázať nepravdu: zdvojená položka (tá istá
 * norma v dvoch trasách), úloha, ktorú nemá ako splniť, poradie, a to, že
 * výpadok jedného zdroja nezmení zoznam na „nič nečaká". Vzhľad sa netestuje.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// `vi.mock` sa vyzdvihne nad všetko ostatné, takže bežná premenná by v jeho
// tovarni ešte neexistovala. `vi.hoisted` vyrobí atrapu spolu s ním.
const { trackProgress } = vi.hoisted(() => ({ trackProgress: vi.fn() }))
vi.mock("../src/lib/tracks", () => ({ trackProgress }))

import {
  acknowledgementSource,
  dedupe,
  sortItems,
  pendingForPerson,
} from "../src/lib/pending"
import type { PendingItem, PendingSource } from "../src/lib/pending"
import type { Person } from "../src/lib/persons"
import type { StepStatus, TrackProgress } from "../src/lib/tracks"

function person(over: Partial<Person> = {}): Person {
  return {
    id: "p1",
    companyCode: "SFZ",
    email: "a@b.sk",
    fullName: "A B",
    personType: "employee",
    status: "active",
    language: "sk",
    tracks: ["zaklad"],
    roles: [],
    ...over,
  } as Person
}

function step(over: Partial<StepStatus> = {}): StepStatus {
  return {
    order: 1,
    documentId: "smernica-1",
    title: "Smernica o ochrane údajov",
    versionId: "v1",
    versionLabel: "1.0",
    effectiveFrom: new Date("2026-01-01"),
    done: false,
    blocked: null,
    ...over,
  }
}

function track(steps: StepStatus[], over: Partial<TrackProgress> = {}): TrackProgress {
  return {
    key: "zaklad",
    title: "Základný onboarding",
    steps,
    nextOrder: steps.find(s => !s.done && !s.blocked)?.order ?? null,
    doneCount: steps.filter(s => s.done).length,
    totalCount: steps.length,
    ...over,
  }
}

function item(over: Partial<PendingItem> = {}): PendingItem {
  return {
    source: "acknowledgement",
    id: "smernica-1",
    title: "Smernica",
    href: "/dokumenty/smernica-1",
    sortAt: new Date("2026-01-01"),
    ...over,
  }
}

beforeEach(() => {
  trackProgress.mockReset()
})

describe("zdroj nepotvrdenych noriem", () => {
  it("vráti len to, čo ešte nie je potvrdené", async () => {
    trackProgress.mockResolvedValue([
      track([
        step({ order: 1, documentId: "a", done: true }),
        step({ order: 2, documentId: "b", done: false }),
      ]),
    ])

    const r = await acknowledgementSource.collect(person())

    expect(r.items.map(i => i.id)).toEqual(["b"])
  })

  it("zablokovaný krok nedá medzi úlohy, ale započíta ho", async () => {
    // Úloha, s ktorou človek nemôže pohnúť, nie je úloha — v zozname by len
    // visela. Zamlčať sa ale nesmie, inak widget tvrdí „nič nečaká".
    trackProgress.mockResolvedValue([
      track([
        step({ order: 1, documentId: "a", blocked: "no-versions" }),
        step({ order: 2, documentId: "b" }),
      ]),
    ])

    const r = await acknowledgementSource.collect(person())

    expect(r.items.map(i => i.id)).toEqual(["b"])
    expect(r.blockedCount).toBe(1)
  })

  it("odkaz vedie na dokument a znesie zvláštne znaky v identifikátore", async () => {
    trackProgress.mockResolvedValue([track([step({ documentId: "smernica 1/2026" })])])

    const r = await acknowledgementSource.collect(person())

    expect(r.items[0].href).toBe("/dokumenty/smernica%201%2F2026")
  })

  it("druhý riadok nesie aj slovo verzia, nie len číslo", async () => {
    trackProgress.mockResolvedValue([track([step({ versionLabel: "1.0" })])])

    const r = await acknowledgementSource.collect(person())

    expect(r.items[0].detail).toBe("verzia 1.0")
  })

  it("v angličtine je ten istý riadok po anglicky", async () => {
    trackProgress.mockResolvedValue([track([step({ versionLabel: "1.0" })])])

    const r = await acknowledgementSource.collect(person({ language: "en" }))

    expect(r.items[0].detail).toBe("version 1.0")
  })

  it("prázdna trasa dá prázdny zoznam, nie chybu", async () => {
    trackProgress.mockResolvedValue([])

    const r = await acknowledgementSource.collect(person({ tracks: [] }))

    expect(r).toEqual({ items: [], blockedCount: 0 })
  })
})

describe("zlučovanie", () => {
  it("tá istá norma v dvoch trasách sa ukáže raz", async () => {
    trackProgress.mockResolvedValue([
      track([step({ documentId: "a" })], { key: "t1" }),
      track([step({ documentId: "a" })], { key: "t2" }),
    ])

    const r = await acknowledgementSource.collect(person({ tracks: ["t1", "t2"] }))

    expect(dedupe(r.items)).toHaveLength(1)
  })

  it("pri zlúčení si nechá najstarší čas", () => {
    const out = dedupe([
      item({ sortAt: new Date("2026-05-01") }),
      item({ sortAt: new Date("2026-01-01") }),
    ])

    expect(out).toHaveLength(1)
    expect(out[0].sortAt).toEqual(new Date("2026-01-01"))
  })

  it("rovnaké `id` z rôznych zdrojov sú dve položky", () => {
    // Identita je dvojica zdroj + id. Tiket a dokument sa môžu volať rovnako.
    const out = dedupe([
      item({ source: "acknowledgement", id: "x" }),
      item({ source: "helpdesk", id: "x" }),
    ])

    expect(out).toHaveLength(2)
  })
})

describe("poradie", () => {
  it("najnovšie znenie je hore", () => {
    const out = sortItems([
      item({ id: "stara", sortAt: new Date("2020-01-01") }),
      item({ id: "nova", sortAt: new Date("2026-06-01") }),
    ])

    expect(out.map(i => i.id)).toEqual(["nova", "stara"])
  })

  it("položka bez dátumu ide na koniec", () => {
    const out = sortItems([
      item({ id: "bez", sortAt: null }),
      item({ id: "s", sortAt: new Date("2020-01-01") }),
    ])

    expect(out.map(i => i.id)).toEqual(["s", "bez"])
  })

  it("bez dátumov rozhodne názov, nie náhoda", () => {
    const out = sortItems([
      item({ id: "b", title: "Štatút", sortAt: null }),
      item({ id: "a", title: "Poriadok", sortAt: null }),
    ])

    expect(out.map(i => i.id)).toEqual(["a", "b"])
  })
})

describe("prehľad pre osobu", () => {
  it("zloží položky, počet aj zablokované", async () => {
    trackProgress.mockResolvedValue([
      track([
        step({ order: 1, documentId: "a", effectiveFrom: new Date("2026-01-01") }),
        step({ order: 2, documentId: "b", effectiveFrom: new Date("2026-06-01") }),
        step({ order: 3, documentId: "c", blocked: "document-unavailable" }),
      ]),
    ])

    const o = await pendingForPerson(person())

    expect(o.items.map(i => i.id)).toEqual(["b", "a"])
    expect(o.total).toBe(2)
    expect(o.blockedCount).toBe(1)
  })

  it("zlyhanie jedného zdroja nezhodí zoznam z ostatných", async () => {
    // Prázdny widget kvôli výpadku helpdesku by človeku povedal „nič
    // nečaká" — čo je horšie než neúplný zoznam.
    trackProgress.mockResolvedValue([track([step({ documentId: "a" })])])

    const rozbity: PendingSource = {
      key: "helpdesk",
      collect: async () => { throw new Error("nedostupné") },
    }
    const chyby = vi.spyOn(console, "error").mockImplementation(() => {})

    const o = await pendingForPerson(person(), [acknowledgementSource, rozbity])

    expect(o.items.map(i => i.id)).toEqual(["a"])
    expect(chyby).toHaveBeenCalled()
    chyby.mockRestore()
  })

  it("človek bez nepotvrdených noriem má prázdny prehľad", async () => {
    trackProgress.mockResolvedValue([track([step({ done: true })])])

    const o = await pendingForPerson(person())

    expect(o).toEqual({ items: [], total: 0, blockedCount: 0 })
  })
})
