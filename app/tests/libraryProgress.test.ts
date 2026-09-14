/**
 * libraryProgress.test.ts — percento potvrdení.
 *
 * Číslo, ktoré človek na detaile uvidí ako prvé. Testuje sa zaokrúhľovanie
 * a hranice — delenie nulou a hodnoty, pri ktorých by „100 %" klamalo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

/*
 * Dve kolekcie za jedným `getCollection()`. Rozlišujú sa menom, nie poradím
 * volania — poradie je podrobnosť implementácie a test, ktorý naň spolieha,
 * spadne pri prvom prehodení riadkov bez toho, aby sa čokoľvek pokazilo.
 */
const { data, validAcks } = vi.hoisted(() => ({
  data: { assignments: [] as unknown[], persons: [] as unknown[] },
  validAcks: vi.fn(),
}))

vi.mock("../src/lib/mongodb", () => ({
  getCollection: vi.fn(async (name: string) => ({
    find: () => ({
      toArray: async () => (name === "assignments" ? data.assignments : data.persons),
    }),
  })),
}))

vi.mock("../src/lib/acknowledgements", async () => {
  const real = await vi.importActual<typeof import("../src/lib/acknowledgements")>(
    "../src/lib/acknowledgements",
  )
  return { ...real, validAcknowledgements: validAcks }
})

import { percentOf, EMPTY_PROGRESS, documentsProgress } from "../src/lib/libraryProgress"

describe("percento potvrdení", () => {
  it("počíta z pridelených, nie z celej organizácie", () => {
    expect(percentOf(142, 210)).toBe(67)
    expect(percentOf(1, 2)).toBe(50)
  })

  it("zaokrúhľuje dole — sto percent znamená všetci", () => {
    // 199 z 200 je 99,5 %. Zaokrúhliť to na 100 % by znamenalo tvrdiť, že
    // potvrdili všetci, pritom jedného ešte treba osloviť — a pri dôkaznom
    // zázname je ten jeden dôvod, prečo sa to celé robí.
    expect(percentOf(199, 200)).toBe(99)
    expect(percentOf(200, 200)).toBe(100)
  })

  it("bez pridelených nie je percento, ale nič", () => {
    // Nula percent by tvrdila, že nikto nepotvrdil. Pravda je, že nebolo
    // komu prideliť — to je iná veta a na obrazovke aj inak vyzerá.
    expect(percentOf(0, 0)).toBeNull()
    expect(percentOf(5, 0)).toBeNull()
    expect(EMPTY_PROGRESS.percent).toBeNull()
  })

  it("viac potvrdení než pridelených nepretečie cez sto", () => {
    // Stať sa to môže: človek potvrdil a potom odišiel z oddelenia, ktorému
    // bolo znenie pridelené. 105 % by vyzeralo ako chyba výpočtu.
    expect(percentOf(12, 10)).toBe(100)
  })
})


describe("potvrdenia pre celú stranu zoznamu", () => {
  const person = (id: string, extra: Record<string, unknown> = {}) => ({
    id, email: `${id}@sfz.sk`, groups: [], tracks: [], departmentPath: [], ...extra,
  })

  beforeEach(() => {
    data.assignments = []
    data.persons = []
    validAcks.mockReset()
    validAcks.mockResolvedValue([])
  })

  it("nepridelené znenie v mape nie je — nie je to nula", () => {
    // „Nikomu nepridelené" a „nikto nepotvrdil" sú dve rôzne vety. Keby sa
    // sem dostala nula, zoznam by ich nakreslil rovnako.
    return documentsProgress("SFZ", ["v1"]).then(out => {
      expect(out.has("v1")).toBe(false)
    })
  })

  it("prázdny vstup sa nepýta databázy vôbec", async () => {
    expect((await documentsProgress("SFZ", [])).size).toBe(0)
    expect((await documentsProgress("SFZ", ["", "  "].map(x => x.trim()))).size).toBe(0)
  })

  it("dve publiká nad tým istým človekom ho do menovateľa dajú raz", async () => {
    // Ten istý človek býva v oddelení aj v skupine, ktorým je znenie
    // pridelené. Súčet namiesto množiny by percento stlačil pod pravdu.
    data.persons = [
      person("a", { groups: ["rozhodcovia"], departmentPath: ["usek1"] }),
      person("b", { departmentPath: ["usek1"] }),
    ]
    data.assignments = [
      { subject: { versionId: "v1" }, audience: { kind: "group", value: "rozhodcovia" } },
      { subject: { versionId: "v1" }, audience: { kind: "department", value: "usek1" } },
    ]
    validAcks.mockResolvedValue([{ personId: "a", versionId: "v1" }])

    const p = (await documentsProgress("SFZ", ["v1"])).get("v1")
    expect(p?.assigned).toBe(2)
    expect(p?.acknowledged).toBe(1)
    expect(p?.percent).toBe(50)
    expect(p?.assignments).toBe(2)
  })

  it("potvrdenie človeka mimo publika sa do čitateľa nepočíta", async () => {
    // Potvrdil a potom odišiel z oddelenia. Bez prieniku by vyšlo 200 %.
    data.persons = [person("a", { departmentPath: ["usek1"] }), person("c")]
    data.assignments = [
      { subject: { versionId: "v1" }, audience: { kind: "department", value: "usek1" } },
    ]
    validAcks.mockResolvedValue([
      { personId: "a", versionId: "v1" },
      { personId: "c", versionId: "v1" },
    ])

    const p = (await documentsProgress("SFZ", ["v1"])).get("v1")
    expect(p?.assigned).toBe(1)
    expect(p?.acknowledged).toBe(1)
    expect(p?.percent).toBe(100)
  })

  it("každé znenie má vlastný menovateľ aj čitateľ", async () => {
    data.persons = [
      person("a", { groups: ["rozhodcovia"] }),
      person("b", { groups: ["delegati"] }),
      person("c", { groups: ["delegati"] }),
    ]
    data.assignments = [
      { subject: { versionId: "v1" }, audience: { kind: "group", value: "rozhodcovia" } },
      { subject: { versionId: "v2" }, audience: { kind: "group", value: "delegati" } },
    ]
    validAcks.mockResolvedValue([
      { personId: "a", versionId: "v1" },
      { personId: "b", versionId: "v2" },
    ])

    const out = await documentsProgress("SFZ", ["v1", "v2"])
    expect(out.get("v1")?.percent).toBe(100)
    expect(out.get("v2")?.percent).toBe(50)
  })

  it("publikum bez ľudí je nula pridelených, nie percento", async () => {
    // Skupina, do ktorej nikto nepatrí. Menovateľ nula znamená, že percento
    // nie je z čoho spočítať — a stĺpec vtedy píše pomlčku, nie „0 %".
    data.persons = [person("a")]
    data.assignments = [
      { subject: { versionId: "v1" }, audience: { kind: "group", value: "prazdna" } },
    ]

    const p = (await documentsProgress("SFZ", ["v1"])).get("v1")
    expect(p?.assigned).toBe(0)
    expect(p?.percent).toBeNull()
  })
})
