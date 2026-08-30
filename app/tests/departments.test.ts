/**
 * oddelenia.test.ts — organizačná štruktúra ako strom (D49).
 *
 * Testujú sa čisté funkcie nad stromom a pravidlo príslušnosti k útvaru.
 * Databáza sa netestuje; testuje sa to, čo o zápise rozhoduje — a hlavne to,
 * čo by pri chybe presunulo ľudí do útvaru, do ktorého nepatria, alebo by
 * strom zacyklilo.
 */

import { describe, it, expect } from "vitest"
import {
  children, pathTo, pathIdsTo, subtree, depth, canMove, flattenTree, MAX_DEPTH,
  type Department,
} from "../src/lib/departments"
import { matchesAudience, audienceLabel, audienceFromSelection, dateForPerson } from "../src/lib/assignments"
import { inDepartmentSince, newDepartmentHistory, newGroupHistory } from "../src/lib/persons"

/** Malá organizácia: úsek, pod ním dva odbory, pod jedným z nich oddelenie. */
function o(id: string, name: string, parentId: string | null): Department {
  return {
    companyCode: "SFZ", id, nazov: name, parentId,
    createdAt: new Date("2026-01-01"), createdBy: "test",
  }
}

const tree: Department[] = [
  o("uk", "Usek komunikacie", null),
  o("od-med", "Odbor medii", "uk"),
  o("od-mkt", "Odbor marketingu", "uk"),
  o("odd-soc", "Oddelenie socialnych sieti", "od-med"),
  o("lg", "Legislativa", null),
]

describe("strom utvarov", () => {
  it("deti vracia len priame podriadene", () => {
    expect(children(tree, "uk").map(x => x.id).sort()).toEqual(["od-med", "od-mkt"])
    expect(children(tree, null).map(x => x.id).sort()).toEqual(["lg", "uk"])
    expect(children(tree, "odd-soc")).toEqual([])
  })

  it("cesta ide od korena po vlastny utvar vratane", () => {
    expect(pathIdsTo(tree, "odd-soc")).toEqual(["uk", "od-med", "odd-soc"])
    expect(pathIdsTo(tree, "uk")).toEqual(["uk"])
  })

  it("nezaradena osoba ma prazdnu cestu", () => {
    // Prázdna cesta znamená, že sa jej pridelenie útvaru nikdy netýka.
    // To je správne: kým nie je zaradená, nepatrí nikam.
    expect(pathIdsTo(tree, null)).toEqual([])
    expect(pathIdsTo(tree, undefined)).toEqual([])
    expect(pathIdsTo(tree, "neexistuje")).toEqual([])
  })

  it("cesta sa nezacykli ani na pokazenych datach", () => {
    // Cyklus v strome by inak zavesil vykreslenie celej obrazovky.
    const broken: Department[] = [o("a", "A", "b"), o("b", "B", "a")]
    expect(pathTo(broken, "a").length).toBeLessThanOrEqual(MAX_DEPTH + 2)
  })

  it("podstrom obsahuje aj sam seba", () => {
    expect([...subtree(tree, "uk")].sort()).toEqual(["od-med", "od-mkt", "odd-soc", "uk"])
  })

  it("hlbka sa pocita od jednotky", () => {
    expect(depth(tree, null)).toBe(0)
    expect(depth(tree, "uk")).toBe(1)
    expect(depth(tree, "odd-soc")).toBe(3)
  })

  it("splostenie da rodica pred jeho podriadenych a doplni uroven", () => {
    const rows = flattenTree(tree)
    const where = (id: string) => rows.findIndex(r => r.oddelenie.id === id)
    expect(rows).toHaveLength(tree.length)
    expect(where("uk")).toBeLessThan(where("od-med"))
    expect(where("od-med")).toBeLessThan(where("odd-soc"))
    expect(rows[where("odd-soc")].uroven).toBe(3)
    expect(rows[where("lg")].uroven).toBe(1)
  })
})

describe("presun utvaru", () => {
  it("pod seba sa presunut neda", () => {
    expect(canMove(tree, "uk", "uk")).not.toBeNull()
  })

  it("pod vlastneho potomka sa presunut neda", () => {
    // Toto je ten presun, ktorý by odtrhol celú vetvu od koreňa a ľudia
    // v nej by zmizli zo štruktúry bez toho, aby to niekto videl.
    expect(canMove(tree, "uk", "odd-soc")).not.toBeNull()
  })

  it("na koren a k surodencovi sa presunut da", () => {
    expect(canMove(tree, "odd-soc", null)).toBeNull()
    expect(canMove(tree, "odd-soc", "od-mkt")).toBeNull()
  })

  it("presun, po ktorom by strom prerastol povolenu hlbku, sa odmietne", () => {
    const deep: Department[] = []
    let parent: string | null = null
    for (let i = 1; i <= MAX_DEPTH; i++) {
      deep.push(o("u" + i, "U" + i, parent))
      parent = "u" + i
    }
    deep.push(o("x", "X", null))
    expect(canMove(deep, "x", "u" + MAX_DEPTH)).not.toBeNull()
    expect(canMove(deep, "x", "u" + (MAX_DEPTH - 1))).toBeNull()
  })
})

describe("pridelenie utvaru", () => {
  const person = { departmentPath: ["uk", "od-med", "odd-soc"] }

  it("sedi na vlastny utvar", () => {
    expect(matchesAudience(person, { kind: "department", value: "odd-soc" })).toBe(true)
  })

  it("sedi aj na nadriadeny, teda plati pre cely podstrom", () => {
    expect(matchesAudience(person, { kind: "department", value: "uk" })).toBe(true)
    expect(matchesAudience(person, { kind: "department", value: "od-med" })).toBe(true)
  })

  it("nesedi na surodenca ani na cudziu vetvu", () => {
    expect(matchesAudience(person, { kind: "department", value: "od-mkt" })).toBe(false)
    expect(matchesAudience(person, { kind: "department", value: "lg" })).toBe(false)
  })

  it("nezaradenej osoby sa pridelenie utvaru netyka", () => {
    expect(matchesAudience({}, { kind: "department", value: "uk" })).toBe(false)
    expect(matchesAudience({ departmentPath: [] }, { kind: "department", value: "uk" })).toBe(false)
  })

  it("utvar a skupina su dve rozne dimenzie", () => {
    // Ten istý reťazec v skupinách nesmie zafungovať ako útvar a naopak —
    // inak by sa dve nezávislé členenia potichu zliali do jedného.
    const someone = { groups: ["uk"], departmentPath: ["lg"] }
    expect(matchesAudience(someone, { kind: "department", value: "uk" })).toBe(false)
    expect(matchesAudience(someone, { kind: "group", value: "lg" })).toBe(false)
  })

  it("vyber z formulara rozozna utvar od skupiny", () => {
    const audiences = audienceFromSelection({
      vybrane: ["group:rozhodcovia", "department:uk"],
      nazvyOddeleni: { uk: "Usek komunikacie" },
    })
    expect(audiences).toEqual([
      { kind: "group", value: "rozhodcovia" },
      { kind: "department", value: "uk", label: "Usek komunikacie" },
    ])
  })

  it("popis utvaru hovori, ze plati aj pre podriadene", () => {
    const text = audienceLabel({ kind: "department", value: "uk", label: "Usek komunikacie" })
    expect(text).toContain("Usek komunikacie")
    expect(text).toContain("podriaden")
  })

  it("bez ulozeneho nazvu sa nezobrazi identifikator", () => {
    // Identifikátor v prehľade nikomu nič nepovie a vyzeral by ako názov.
    const text = audienceLabel({ kind: "department", value: "uk" })
    expect(text).not.toContain("uk")
  })
})

describe("reorganizacia (D50)", () => {
  const day = (d: number) => new Date(`2026-0${d}-01T00:00:00.000Z`)

  const inDepartment = (since: Date) => ({
    departmentHistory: [{ departmentId: "uk", departmentPath: ["uk"], od: since }],
  })

  it("kto bol v utvare od zaciatku, ma povodny datum pridelenia", () => {
    const assignment = { audience: { kind: "department" as const, value: "uk" }, assignedAt: day(3) }
    expect(dateForPerson(assignment, inDepartment(day(1)))).toEqual(day(3))
  })

  it("kto prisiel neskor, ma datum svojho prichodu", () => {
    // Inak by mal novacik prvy den v praci ulohu spred roka, teda hned po
    // termine a bez priznaku nove.
    const assignment = { audience: { kind: "department" as const, value: "uk" }, assignedAt: day(3) }
    expect(dateForPerson(assignment, inDepartment(day(5)))).toEqual(day(5))
  })

  it("bez historie plati datum pridelenia", () => {
    // Ludia zapisani pred zavedenim struktury: prazdna historia znamena
    // odjakziva, nie nikdy. Opacna predvolba by im vsetky stare normy schovala.
    const assignment = { audience: { kind: "department" as const, value: "uk" }, assignedAt: day(3) }
    expect(dateForPerson(assignment, {})).toEqual(day(3))
    expect(dateForPerson(assignment, { departmentHistory: [] })).toEqual(day(3))
  })

  it("kto do skupiny pribudol neskor, ma datum svojho vstupu", () => {
    const assignment = { audience: { kind: "group" as const, value: "rozhodcovia" }, assignedAt: day(3) }
    const person = { groupHistory: [{ group: "rozhodcovia", od: day(5) }] }
    expect(dateForPerson(assignment, person)).toEqual(day(5))
  })

  it("uzavrety usek clenstva datum neposuva", () => {
    // Kto zo skupiny odisiel, uz v nej nie je; jeho stary usek nesmie
    // rozhodovat o datume noveho pridelenia.
    const assignment = { audience: { kind: "group" as const, value: "rozhodcovia" }, assignedAt: day(3) }
    const person = { groupHistory: [{ group: "rozhodcovia", od: day(5), do: day(6) }] }
    expect(dateForPerson(assignment, person)).toEqual(day(3))
  })

  it("trasa a jednotlivec sa clenstvom neriadia", () => {
    // Trasa historiu nema a vymysliet si ju by znamenalo tvrdit nieco,
    // co nevieme.
    for (const kind of ["all", "track", "person"] as const) {
      const p = { audience: { kind, value: "x" }, assignedAt: day(3) }
      const person = {
        departmentHistory: [{ departmentId: "uk", departmentPath: ["uk"], od: day(5) }],
        groupHistory: [{ group: "x", od: day(5) }],
      }
      expect(dateForPerson(p, person)).toEqual(day(3))
    }
  })

  it("historia skupin: odchod uzavrie usek, prichod otvori novy", () => {
    const h = newGroupHistory(
      [{ group: "rozhodcovia", od: day(1) }, { group: "delegati", od: day(1) }],
      ["rozhodcovia", "statutari"], day(4),
    )
    const find = (g: string) => h.filter(z => z.group === g)
    expect(find("rozhodcovia")).toHaveLength(1)
    expect(find("rozhodcovia")[0].od).toEqual(day(1))   // nezmenene clenstvo sa nedotkne
    expect(find("delegati")[0].do).toEqual(day(4))      // odisiel
    expect(find("statutari")[0].od).toEqual(day(4))     // pribudol
  })

  it("navrat do skupiny je novy usek, nie ozivenie stareho", () => {
    // \"bol, odisiel, vratil sa\" je ina informacia nez \"bol cely cas\".
    const h = newGroupHistory(
      [{ group: "rozhodcovia", od: day(1), do: day(2) }],
      ["rozhodcovia"], day(4),
    )
    expect(h).toHaveLength(2)
    expect(h[1].od).toEqual(day(4))
  })

  it("velke pismena su ta ista skupina", () => {
    const h = newGroupHistory([{ group: "rozhodcovia", od: day(1) }], ["Rozhodcovia"], day(4))
    expect(h).toHaveLength(1)
    expect(h[0].od).toEqual(day(1))
  })

  it("vUtvareOd vracia otvoreny zaznam", () => {
    expect(inDepartmentSince({
      departmentHistory: [
        { departmentId: "lg", departmentPath: ["lg"], od: day(1), do: day(4) },
        { departmentId: "uk", departmentPath: ["uk"], od: day(4) },
      ],
    })).toEqual(day(4))
    expect(inDepartmentSince({})).toBeNull()
    expect(inDepartmentSince({ departmentHistory: [] })).toBeNull()
  })

  it("presun do ineho utvaru uzavrie predosly zaznam", () => {
    const h = newDepartmentHistory(
      [{ departmentId: "lg", departmentPath: ["lg"], od: day(1) }],
      "uk", ["uk"], day(4),
    )
    expect(h).toHaveLength(2)
    expect(h[0].do).toEqual(day(4))
    expect(h[1]).toEqual({ departmentId: "uk", departmentPath: ["uk"], od: day(4) })
  })

  it("ulozenie toho isteho utvaru datum prichodu neposunie", () => {
    // Inak by opakovane odoslanie formulara posuvalo prichod a s nim terminy.
    const h = newDepartmentHistory(
      [{ departmentId: "uk", departmentPath: ["uk"], od: day(1) }],
      "uk", ["uk"], day(4),
    )
    expect(h).toHaveLength(1)
    expect(h[0].od).toEqual(day(1))
  })

  it("presun celej vetvy opravi cestu, ale neotvori novy zaznam", () => {
    // Clovek sa nikam nepohol, pohol sa jeho utvar. Keby to zalozilo novy
    // zaznam, vyzeralo by to, ze do svojho utvaru prave prisli vsetci naraz.
    const h = newDepartmentHistory(
      [{ departmentId: "od-med", departmentPath: ["uk", "od-med"], od: day(1) }],
      "od-med", ["lg", "od-med"], day(4),
    )
    expect(h).toHaveLength(1)
    expect(h[0].od).toEqual(day(1))
    expect(h[0].departmentPath).toEqual(["lg", "od-med"])
  })

  it("vyradenie zo struktury je tiez zmena", () => {
    const h = newDepartmentHistory(
      [{ departmentId: "uk", departmentPath: ["uk"], od: day(1) }],
      null, [], day(4),
    )
    expect(h).toHaveLength(2)
    expect(h[0].do).toEqual(day(4))
    expect(h[1].departmentId).toBeNull()
  })
})

describe("poradie medzi surodencami (D60)", () => {
  function so(id: string, name: string, parentId: string | null, order?: number): Department {
    return {
      companyCode: "SFZ", id, nazov: name, parentId, poradie: order,
      createdAt: new Date("2026-01-01"), createdBy: "test",
    }
  }

  it("bez urceneho poradia rozhoduje nazov", () => {
    // Nic sa nemuselo migrovat: stary stav sa sprava ako predtym.
    const v = [so("b", "Beta", null), so("a", "Alfa", null)]
    expect(children(v, null).map(x => x.id)).toEqual(["a", "b"])
  })

  it("urcene poradie prebije abecedu", () => {
    // Organizacna schema nie je abecedny zoznam: prezident stoji nad
    // vykonnym vyborom bez ohladu na to, ako sa volaju.
    const v = [so("vv", "Výkonný výbor", null, 1), so("prez", "Prezident", null, 0)]
    expect(children(v, null).map(x => x.id)).toEqual(["prez", "vv"])
  })

  it("kto ma poradie, stoji pred tymi bez neho", () => {
    // Miesany stav je zamerny -- prinutit organizaciu ocislovat cely strom
    // skor, nez presunie jednu polozku, by bolo horsie nez docasna
    // nedoslednost.
    const v = [so("a", "Alfa", null), so("z", "Zeta", null, 0)]
    expect(children(v, null).map(x => x.id)).toEqual(["z", "a"])
  })

  it("poradie plati len v ramci jednej urovne", () => {
    const v = [
      so("k1", "Koreň 1", null, 0),
      so("d1", "Dieťa A", "k1", 1),
      so("d2", "Dieťa B", "k1", 0),
    ]
    expect(children(v, "k1").map(x => x.id)).toEqual(["d2", "d1"])
    expect(children(v, null).map(x => x.id)).toEqual(["k1"])
  })
})
