/**
 * assignments.test.ts — pravidlá prideľovania (D37, D38, Fáza 9 rozsah B).
 *
 * Testuje sa to, čo môže prideliť niekomu niečo, čo nemal dostať, alebo
 * naopak neprideliť nikomu a tváriť sa, že je hotovo. Zápis do databázy sa
 * netestuje — testuje sa pravidlo, ktoré o zápise rozhoduje.
 */

import { describe, it, expect } from "vitest"
import {
  matchesAudience, audienceLabel, audienceFromSelection, carryOverFrom, audienceRef, impactFrom,
  type Assignment,
} from "../src/lib/assignments"
import { normalizeKeys } from "../src/lib/persons"

const person = {
  email: "Jan.Letko@futbalsfz.sk",
  groups: ["rozhodcovia", "delegati"],
  tracks: ["zaklad-2026"],
}

describe("komu sa pridelenie tyka", () => {
  it("publikum vsetci znamena naozaj vsetkych", () => {
    expect(matchesAudience({}, { kind: "all" })).toBe(true)
  })

  it("skupina sedí podľa členstva", () => {
    expect(matchesAudience(person, { kind: "group", value: "rozhodcovia" })).toBe(true)
    expect(matchesAudience(person, { kind: "group", value: "statutari" })).toBe(false)
  })

  it("veľké a malé písmená sú tá istá skupina", () => {
    // Inak by „Rozhodcovia" a „rozhodcovia" boli dve skupiny a jedna
    // z nich by nedostala nič — a v zozname by vyzerali rovnako.
    expect(matchesAudience(person, { kind: "group", value: "Rozhodcovia" })).toBe(true)
    expect(matchesAudience({ groups: ["Rozhodcovia"] }, { kind: "group", value: "rozhodcovia" })).toBe(true)
  })

  it("medzery navyše nerozhodujú", () => {
    expect(matchesAudience(person, { kind: "group", value: "  rozhodcovia " })).toBe(true)
  })

  it("trasa je iná dimenzia než skupina", () => {
    // Zlúčiť ich by znamenalo, že jednorazovú úlohu nemožno prideliť bez
    // toho, aby vznikla umelá trasa (D38).
    expect(matchesAudience(person, { kind: "track", value: "zaklad-2026" })).toBe(true)
    expect(matchesAudience(person, { kind: "group", value: "zaklad-2026" })).toBe(false)
  })

  it("adresa sa porovnáva bez ohľadu na veľkosť písmen", () => {
    expect(matchesAudience(person, { kind: "person", value: "jan.letko@futbalsfz.sk" })).toBe(true)
  })

  it("prázdna hodnota nesedí nikomu", () => {
    // Prideliť „skupine bez mena" musí znamenať nikomu, nie všetkým.
    expect(matchesAudience(person, { kind: "group", value: "" })).toBe(false)
    expect(matchesAudience(person, { kind: "group" })).toBe(false)
    expect(matchesAudience(person, { kind: "person", value: "   " })).toBe(false)
  })

  it("neznámy druh publika nesedí nikomu", () => {
    // Nový druh, ktorý sa zabudne doplniť, má radšej neprideliť nikomu
    // než všetkým.
    expect(matchesAudience(person, { kind: "utvar" as never, value: "x" })).toBe(false)
  })

  it("osoba bez skupín neprepadne do žiadnej", () => {
    expect(matchesAudience({ email: "a@b.sk" }, { kind: "group", value: "rozhodcovia" })).toBe(false)
  })
})

describe("pomenovanie publika", () => {
  it("povie, o aký druh ide, nie len hodnotu", () => {
    expect(audienceLabel({ kind: "group", value: "rozhodcovia" })).toContain("skupina")
    expect(audienceLabel({ kind: "track", value: "zaklad" })).toContain("trasa")
    expect(audienceLabel({ kind: "all" })).toBe("všetci v organizácii")
  })
})

describe("normalizacia klucov", () => {
  it("zjednotí veľkosť písmen a zahodí prázdne", () => {
    expect(normalizeKeys([" Rozhodcovia ", "", "  "])).toEqual(["rozhodcovia"])
  })

  it("nezdvojí to isté zapísané inak", () => {
    expect(normalizeKeys(["Rozhodcovia", "rozhodcovia"])).toEqual(["rozhodcovia"])
  })

  it("z ničoho spraví prázdny zoznam, nie chybu", () => {
    expect(normalizeKeys(undefined)).toEqual([])
  })
})

describe("publika z vyberu na obrazovke", () => {
  it("zaškrtnuté skupiny a trasy sa preložia na publiká", () => {
    expect(audienceFromSelection({ selected: ["group:rozhodcovia", "track:zaklad-2026"] })).toEqual([
      { kind: "group", value: "rozhodcovia" },
      { kind: "track", value: "zaklad-2026" },
    ])
  })

  it("vsetci v organizacii prebije vsetko ostatne", () => {
    // Inak by vzniklo pridelenie pre všetkých a k nemu pridelenia pre skupiny,
    // ktoré sú jeho podmnožinou — v prehľade by to isté viselo štyrikrát.
    expect(audienceFromSelection({
      all: true,
      selected: ["group:rozhodcovia"],
      addresses: "a@b.sk",
    })).toEqual([{ kind: "all" }])
  })

  it("adresy sa dajú oddeliť čiarkou aj novým riadkom", () => {
    const out = audienceFromSelection({ addresses: "a@b.sk, c@d.sk\ne@f.sk; g@h.sk" })
    expect(out.map(a => a.value)).toEqual(["a@b.sk", "c@d.sk", "e@f.sk", "g@h.sk"])
    expect(out.every(a => a.kind === "person")).toBe(true)
  })

  it("čo nie je adresa, sa preskočí", () => {
    // Prideliť „niečomu, čo vyzeralo ako adresa" znamená neprideliť nikomu
    // a tváriť sa, že je hotovo.
    expect(audienceFromSelection({ addresses: "rozhodcovia, a@b.sk, ---" })).toEqual([
      { kind: "person", value: "a@b.sk" },
    ])
  })

  it("to isté publikum dvoma cestami je jedno publikum", () => {
    expect(audienceFromSelection({
      selected: ["group:rozhodcovia", "group:Rozhodcovia"],
      addresses: "A@B.sk\na@b.sk",
    })).toEqual([
      { kind: "group", value: "rozhodcovia" },
      { kind: "person", value: "a@b.sk" },
    ])
  })

  it("neznámy druh v hodnote políčka sa preskočí, neprepadne na skupinu", () => {
    expect(audienceFromSelection({ selected: ["utvar:ekonomicky", "group:x"] })).toEqual([
      { kind: "group", value: "x" },
    ])
  })

  it("prázdny výber je prázdny zoznam, nie všetci", () => {
    // Najdôležitejší test v tomto súbore: keby prázdny výber znamenal
    // „všetkým", stačilo by nezaškrtnúť nič a norma by odišla celej organizácii.
    expect(audienceFromSelection({})).toEqual([])
    expect(audienceFromSelection({ selected: [], addresses: "" })).toEqual([])
    expect(audienceFromSelection({ all: false })).toEqual([])
  })
})


describe("zdedenie pridelenia novym znenim (D28)", () => {
  /** Minimalne pridelenie — pravidlo cita len tieto polia. */
  const a = (versionId: string, kind: string, value: string, reason: string, day: number) => ({
    subject: {
      documentId: "sfz:stanovy",
      versionId: versionId,
      documentTitle: "Stanovy",
      versionLabel: `znenie ${versionId}`,
      effectiveFrom: null,
    },
    audience: { kind: kind, value: value },
    reason: reason,
    assignedAt: new Date(2026, 0, day),
  }) as unknown as Assignment

  it("bez platneho znenia sa neponuka nic", () => {
    // Nie je na co pridelovat. Prazdny zoznam, nie pokus o hadanie.
    expect(carryOverFrom([a("v1", "group", "rozhodcovia", "nastup", 1)], "")).toEqual([])
  })

  it("publikum, ktore nove znenie uz ma, sa neponuka znova", () => {
    // `assign()` je idempotentne, takze kliknutie by nic nepokazilo — ale
    // tlacidlo, ktore nic neurobi, uci cloveka neverit tlacidlam.
    const rows = [
      a("v1", "group", "rozhodcovia", "nastup", 1),
      a("v2", "group", "rozhodcovia", "novela", 2),
    ]
    expect(carryOverFrom(rows, "v2")).toEqual([])
  })

  it("pri tom istom publiku vyhra najnovsie pridelenie aj jeho dovod", () => {
    // Starsie znenia nesu starsie dovody a tie uz nikto ponukat nechce.
    const rows = [
      a("v1", "group", "rozhodcovia", "stary dovod", 1),
      a("v2", "group", "rozhodcovia", "novsi dovod", 5),
    ]
    const out = carryOverFrom(rows, "v3")
    expect(out).toHaveLength(1)
    expect(out[0].previousReason).toBe("novsi dovod")
    expect(out[0].previousVersionId).toBe("v2")
  })

  it("rozne publika sa vratia vsetky", () => {
    const rows = [
      a("v1", "group", "rozhodcovia", "d1", 1),
      a("v1", "department", "usek-it", "d2", 1),
      a("v1", "person", "jan@futbalsfz.sk", "d3", 1),
    ]
    const out = carryOverFrom(rows, "v2")
    expect(out).toHaveLength(3)
    expect(new Set(out.map(c => c.audience.kind))).toEqual(new Set(["group", "department", "person"]))
  })

  it("velke a male pismena su to iste publikum", () => {
    // Inak by sa „Rozhodcovia" ponukli este raz vedla „rozhodcovia" a niekto
    // by tu istu skupinu pridelil dvakrat.
    const rows = [
      a("v1", "group", "Rozhodcovia", "stary", 1),
      a("v2", "group", "rozhodcovia", "novy", 2),
    ]
    expect(carryOverFrom(rows, "v2")).toEqual([])
  })

  it("odkaz na publikum sedi s tym, podla coho server vybera", () => {
    // Hodnota zaskrtavacieho policka aj kluc zlucovania su ta ista funkcia.
    const out = carryOverFrom([a("v1", "group", "Rozhodcovia", "d", 1)], "v2")
    expect(audienceRef(out[0].audience)).toBe(audienceRef({ kind: "group", value: "rozhodcovia" }))
  })
})

describe("dopad vyberu publik pred pridelenim (HR.md, uloha 3)", () => {
  const people = [
    { id: "a", email: "a@x.sk", groups: ["rozhodcovia"], tracks: [], departmentPath: ["pravne"] },
    { id: "b", email: "b@x.sk", groups: ["rozhodcovia"], tracks: [], departmentPath: ["hr"] },
    { id: "c", email: "c@x.sk", groups: [], tracks: ["zaklad"], departmentPath: ["pravne", "pravne-sub"] },
  ]

  it("clovek v dvoch publikach sa pocita raz — povinnost mu vznikne raz", () => {
    const out = impactFrom(people, [
      { kind: "department", value: "pravne", label: "Právne" },
      { kind: "group", value: "rozhodcovia" },
    ])
    // Oddelenie: a, c (podstrom). Skupina: a, b. Zjednotenie: a, b, c.
    expect(out.people).toBe(3)
    expect(out.perAudience.map(p => p.count)).toEqual([2, 2])
  })

  it("rozpis drzi poradie vyberu a pouziva to iste pravidlo ako pridelenie", () => {
    const out = impactFrom(people, [{ kind: "person", value: "c@x.sk" }, { kind: "all" }])
    expect(out.perAudience.map(p => p.count)).toEqual([1, 3])
    expect(out.people).toBe(3)
  })

  it("bez publika nevznikne povinnost nikomu", () => {
    expect(impactFrom(people, [])).toEqual({ people: 0, perAudience: [] })
  })
})
