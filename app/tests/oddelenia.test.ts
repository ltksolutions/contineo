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
  deti, cesta, cestaIds, podstrom, hlbka, smieSaPresunut, splostiStrom, MAX_HLBKA,
  type Oddelenie,
} from "../src/lib/departments"
import { matchesAudience, audienceLabel, audienceFromSelection, datumPreOsobu } from "../src/lib/assignments"
import { vUtvareOd, novaHistoriaUtvarov, novaHistoriaSkupin } from "../src/lib/persons"

/** Malá organizácia: úsek, pod ním dva odbory, pod jedným z nich oddelenie. */
function o(id: string, nazov: string, parentId: string | null): Oddelenie {
  return {
    companyCode: "SFZ", id, nazov, parentId,
    createdAt: new Date("2026-01-01"), createdBy: "test",
  }
}

const strom: Oddelenie[] = [
  o("uk", "Usek komunikacie", null),
  o("od-med", "Odbor medii", "uk"),
  o("od-mkt", "Odbor marketingu", "uk"),
  o("odd-soc", "Oddelenie socialnych sieti", "od-med"),
  o("lg", "Legislativa", null),
]

describe("strom utvarov", () => {
  it("deti vracia len priame podriadene", () => {
    expect(deti(strom, "uk").map(x => x.id).sort()).toEqual(["od-med", "od-mkt"])
    expect(deti(strom, null).map(x => x.id).sort()).toEqual(["lg", "uk"])
    expect(deti(strom, "odd-soc")).toEqual([])
  })

  it("cesta ide od korena po vlastny utvar vratane", () => {
    expect(cestaIds(strom, "odd-soc")).toEqual(["uk", "od-med", "odd-soc"])
    expect(cestaIds(strom, "uk")).toEqual(["uk"])
  })

  it("nezaradena osoba ma prazdnu cestu", () => {
    // Prázdna cesta znamená, že sa jej pridelenie útvaru nikdy netýka.
    // To je správne: kým nie je zaradená, nepatrí nikam.
    expect(cestaIds(strom, null)).toEqual([])
    expect(cestaIds(strom, undefined)).toEqual([])
    expect(cestaIds(strom, "neexistuje")).toEqual([])
  })

  it("cesta sa nezacykli ani na pokazenych datach", () => {
    // Cyklus v strome by inak zavesil vykreslenie celej obrazovky.
    const zle: Oddelenie[] = [o("a", "A", "b"), o("b", "B", "a")]
    expect(cesta(zle, "a").length).toBeLessThanOrEqual(MAX_HLBKA + 2)
  })

  it("podstrom obsahuje aj sam seba", () => {
    expect([...podstrom(strom, "uk")].sort()).toEqual(["od-med", "od-mkt", "odd-soc", "uk"])
  })

  it("hlbka sa pocita od jednotky", () => {
    expect(hlbka(strom, null)).toBe(0)
    expect(hlbka(strom, "uk")).toBe(1)
    expect(hlbka(strom, "odd-soc")).toBe(3)
  })

  it("splostenie da rodica pred jeho podriadenych a doplni uroven", () => {
    const riadky = splostiStrom(strom)
    const kde = (id: string) => riadky.findIndex(r => r.oddelenie.id === id)
    expect(riadky).toHaveLength(strom.length)
    expect(kde("uk")).toBeLessThan(kde("od-med"))
    expect(kde("od-med")).toBeLessThan(kde("odd-soc"))
    expect(riadky[kde("odd-soc")].uroven).toBe(3)
    expect(riadky[kde("lg")].uroven).toBe(1)
  })
})

describe("presun utvaru", () => {
  it("pod seba sa presunut neda", () => {
    expect(smieSaPresunut(strom, "uk", "uk")).not.toBeNull()
  })

  it("pod vlastneho potomka sa presunut neda", () => {
    // Toto je ten presun, ktorý by odtrhol celú vetvu od koreňa a ľudia
    // v nej by zmizli zo štruktúry bez toho, aby to niekto videl.
    expect(smieSaPresunut(strom, "uk", "odd-soc")).not.toBeNull()
  })

  it("na koren a k surodencovi sa presunut da", () => {
    expect(smieSaPresunut(strom, "odd-soc", null)).toBeNull()
    expect(smieSaPresunut(strom, "odd-soc", "od-mkt")).toBeNull()
  })

  it("presun, po ktorom by strom prerastol povolenu hlbku, sa odmietne", () => {
    const hlboky: Oddelenie[] = []
    let rodic: string | null = null
    for (let i = 1; i <= MAX_HLBKA; i++) {
      hlboky.push(o("u" + i, "U" + i, rodic))
      rodic = "u" + i
    }
    hlboky.push(o("x", "X", null))
    expect(smieSaPresunut(hlboky, "x", "u" + MAX_HLBKA)).not.toBeNull()
    expect(smieSaPresunut(hlboky, "x", "u" + (MAX_HLBKA - 1))).toBeNull()
  })
})

describe("pridelenie utvaru", () => {
  const osoba = { departmentPath: ["uk", "od-med", "odd-soc"] }

  it("sedi na vlastny utvar", () => {
    expect(matchesAudience(osoba, { kind: "department", value: "odd-soc" })).toBe(true)
  })

  it("sedi aj na nadriadeny, teda plati pre cely podstrom", () => {
    expect(matchesAudience(osoba, { kind: "department", value: "uk" })).toBe(true)
    expect(matchesAudience(osoba, { kind: "department", value: "od-med" })).toBe(true)
  })

  it("nesedi na surodenca ani na cudziu vetvu", () => {
    expect(matchesAudience(osoba, { kind: "department", value: "od-mkt" })).toBe(false)
    expect(matchesAudience(osoba, { kind: "department", value: "lg" })).toBe(false)
  })

  it("nezaradenej osoby sa pridelenie utvaru netyka", () => {
    expect(matchesAudience({}, { kind: "department", value: "uk" })).toBe(false)
    expect(matchesAudience({ departmentPath: [] }, { kind: "department", value: "uk" })).toBe(false)
  })

  it("utvar a skupina su dve rozne dimenzie", () => {
    // Ten istý reťazec v skupinách nesmie zafungovať ako útvar a naopak —
    // inak by sa dve nezávislé členenia potichu zliali do jedného.
    const clovek = { groups: ["uk"], departmentPath: ["lg"] }
    expect(matchesAudience(clovek, { kind: "department", value: "uk" })).toBe(false)
    expect(matchesAudience(clovek, { kind: "group", value: "lg" })).toBe(false)
  })

  it("vyber z formulara rozozna utvar od skupiny", () => {
    const publika = audienceFromSelection({
      vybrane: ["group:rozhodcovia", "department:uk"],
      nazvyOddeleni: { uk: "Usek komunikacie" },
    })
    expect(publika).toEqual([
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
  const den = (d: number) => new Date(`2026-0${d}-01T00:00:00.000Z`)

  const vUtvare = (od: Date) => ({
    departmentHistory: [{ departmentId: "uk", departmentPath: ["uk"], od }],
  })

  it("kto bol v utvare od zaciatku, ma povodny datum pridelenia", () => {
    const pridelenie = { audience: { kind: "department" as const, value: "uk" }, assignedAt: den(3) }
    expect(datumPreOsobu(pridelenie, vUtvare(den(1)))).toEqual(den(3))
  })

  it("kto prisiel neskor, ma datum svojho prichodu", () => {
    // Inak by mal novacik prvy den v praci ulohu spred roka, teda hned po
    // termine a bez priznaku nove.
    const pridelenie = { audience: { kind: "department" as const, value: "uk" }, assignedAt: den(3) }
    expect(datumPreOsobu(pridelenie, vUtvare(den(5)))).toEqual(den(5))
  })

  it("bez historie plati datum pridelenia", () => {
    // Ludia zapisani pred zavedenim struktury: prazdna historia znamena
    // odjakziva, nie nikdy. Opacna predvolba by im vsetky stare normy schovala.
    const pridelenie = { audience: { kind: "department" as const, value: "uk" }, assignedAt: den(3) }
    expect(datumPreOsobu(pridelenie, {})).toEqual(den(3))
    expect(datumPreOsobu(pridelenie, { departmentHistory: [] })).toEqual(den(3))
  })

  it("kto do skupiny pribudol neskor, ma datum svojho vstupu", () => {
    const pridelenie = { audience: { kind: "group" as const, value: "rozhodcovia" }, assignedAt: den(3) }
    const osoba = { groupHistory: [{ group: "rozhodcovia", od: den(5) }] }
    expect(datumPreOsobu(pridelenie, osoba)).toEqual(den(5))
  })

  it("uzavrety usek clenstva datum neposuva", () => {
    // Kto zo skupiny odisiel, uz v nej nie je; jeho stary usek nesmie
    // rozhodovat o datume noveho pridelenia.
    const pridelenie = { audience: { kind: "group" as const, value: "rozhodcovia" }, assignedAt: den(3) }
    const osoba = { groupHistory: [{ group: "rozhodcovia", od: den(5), do: den(6) }] }
    expect(datumPreOsobu(pridelenie, osoba)).toEqual(den(3))
  })

  it("trasa a jednotlivec sa clenstvom neriadia", () => {
    // Trasa historiu nema a vymysliet si ju by znamenalo tvrdit nieco,
    // co nevieme.
    for (const kind of ["all", "track", "person"] as const) {
      const p = { audience: { kind, value: "x" }, assignedAt: den(3) }
      const osoba = {
        departmentHistory: [{ departmentId: "uk", departmentPath: ["uk"], od: den(5) }],
        groupHistory: [{ group: "x", od: den(5) }],
      }
      expect(datumPreOsobu(p, osoba)).toEqual(den(3))
    }
  })

  it("historia skupin: odchod uzavrie usek, prichod otvori novy", () => {
    const h = novaHistoriaSkupin(
      [{ group: "rozhodcovia", od: den(1) }, { group: "delegati", od: den(1) }],
      ["rozhodcovia", "statutari"], den(4),
    )
    const najdi = (g: string) => h.filter(z => z.group === g)
    expect(najdi("rozhodcovia")).toHaveLength(1)
    expect(najdi("rozhodcovia")[0].od).toEqual(den(1))   // nezmenene clenstvo sa nedotkne
    expect(najdi("delegati")[0].do).toEqual(den(4))      // odisiel
    expect(najdi("statutari")[0].od).toEqual(den(4))     // pribudol
  })

  it("navrat do skupiny je novy usek, nie ozivenie stareho", () => {
    // \"bol, odisiel, vratil sa\" je ina informacia nez \"bol cely cas\".
    const h = novaHistoriaSkupin(
      [{ group: "rozhodcovia", od: den(1), do: den(2) }],
      ["rozhodcovia"], den(4),
    )
    expect(h).toHaveLength(2)
    expect(h[1].od).toEqual(den(4))
  })

  it("velke pismena su ta ista skupina", () => {
    const h = novaHistoriaSkupin([{ group: "rozhodcovia", od: den(1) }], ["Rozhodcovia"], den(4))
    expect(h).toHaveLength(1)
    expect(h[0].od).toEqual(den(1))
  })

  it("vUtvareOd vracia otvoreny zaznam", () => {
    expect(vUtvareOd({
      departmentHistory: [
        { departmentId: "lg", departmentPath: ["lg"], od: den(1), do: den(4) },
        { departmentId: "uk", departmentPath: ["uk"], od: den(4) },
      ],
    })).toEqual(den(4))
    expect(vUtvareOd({})).toBeNull()
    expect(vUtvareOd({ departmentHistory: [] })).toBeNull()
  })

  it("presun do ineho utvaru uzavrie predosly zaznam", () => {
    const h = novaHistoriaUtvarov(
      [{ departmentId: "lg", departmentPath: ["lg"], od: den(1) }],
      "uk", ["uk"], den(4),
    )
    expect(h).toHaveLength(2)
    expect(h[0].do).toEqual(den(4))
    expect(h[1]).toEqual({ departmentId: "uk", departmentPath: ["uk"], od: den(4) })
  })

  it("ulozenie toho isteho utvaru datum prichodu neposunie", () => {
    // Inak by opakovane odoslanie formulara posuvalo prichod a s nim terminy.
    const h = novaHistoriaUtvarov(
      [{ departmentId: "uk", departmentPath: ["uk"], od: den(1) }],
      "uk", ["uk"], den(4),
    )
    expect(h).toHaveLength(1)
    expect(h[0].od).toEqual(den(1))
  })

  it("presun celej vetvy opravi cestu, ale neotvori novy zaznam", () => {
    // Clovek sa nikam nepohol, pohol sa jeho utvar. Keby to zalozilo novy
    // zaznam, vyzeralo by to, ze do svojho utvaru prave prisli vsetci naraz.
    const h = novaHistoriaUtvarov(
      [{ departmentId: "od-med", departmentPath: ["uk", "od-med"], od: den(1) }],
      "od-med", ["lg", "od-med"], den(4),
    )
    expect(h).toHaveLength(1)
    expect(h[0].od).toEqual(den(1))
    expect(h[0].departmentPath).toEqual(["lg", "od-med"])
  })

  it("vyradenie zo struktury je tiez zmena", () => {
    const h = novaHistoriaUtvarov(
      [{ departmentId: "uk", departmentPath: ["uk"], od: den(1) }],
      null, [], den(4),
    )
    expect(h).toHaveLength(2)
    expect(h[0].do).toEqual(den(4))
    expect(h[1].departmentId).toBeNull()
  })
})

describe("poradie medzi surodencami (D60)", () => {
  function so(id: string, nazov: string, parentId: string | null, poradie?: number): Oddelenie {
    return {
      companyCode: "SFZ", id, nazov, parentId, poradie,
      createdAt: new Date("2026-01-01"), createdBy: "test",
    }
  }

  it("bez urceneho poradia rozhoduje nazov", () => {
    // Nic sa nemuselo migrovat: stary stav sa sprava ako predtym.
    const v = [so("b", "Beta", null), so("a", "Alfa", null)]
    expect(deti(v, null).map(x => x.id)).toEqual(["a", "b"])
  })

  it("urcene poradie prebije abecedu", () => {
    // Organizacna schema nie je abecedny zoznam: prezident stoji nad
    // vykonnym vyborom bez ohladu na to, ako sa volaju.
    const v = [so("vv", "Výkonný výbor", null, 1), so("prez", "Prezident", null, 0)]
    expect(deti(v, null).map(x => x.id)).toEqual(["prez", "vv"])
  })

  it("kto ma poradie, stoji pred tymi bez neho", () => {
    // Miesany stav je zamerny -- prinutit organizaciu ocislovat cely strom
    // skor, nez presunie jednu polozku, by bolo horsie nez docasna
    // nedoslednost.
    const v = [so("a", "Alfa", null), so("z", "Zeta", null, 0)]
    expect(deti(v, null).map(x => x.id)).toEqual(["z", "a"])
  })

  it("poradie plati len v ramci jednej urovne", () => {
    const v = [
      so("k1", "Koreň 1", null, 0),
      so("d1", "Dieťa A", "k1", 1),
      so("d2", "Dieťa B", "k1", 0),
    ]
    expect(deti(v, "k1").map(x => x.id)).toEqual(["d2", "d1"])
    expect(deti(v, null).map(x => x.id)).toEqual(["k1"])
  })
})
