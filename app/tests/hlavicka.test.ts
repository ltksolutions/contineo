/**
 * hlavicka.test.ts — avatar v osobnom menu.
 *
 * Iniciály sú jediné, čo o človeku v hlavičke stojí, a musia vyjsť **vždy**:
 * aj u správcu, ktorý prešiel núdzovou brzdou a v `persons` nie je, aj
 * u jednoslovného mena, aj keď meno chýba úplne. Prázdny kruh vyzerá ako
 * chyba načítania.
 */

import { describe, it, expect } from "vitest"
import { iniciely, odtienAvatara } from "../src/components/Header"

describe("iniciely", () => {
  it("z mena a priezviska", () => {
    expect(iniciely("Ján Letko", "jan.letko@futbalsfz.sk")).toBe("JL")
  })

  it("z prvého a posledného slova, nie z prostredného", () => {
    expect(iniciely("Ján Peter Letko", "a@b.sk")).toBe("JL")
  })

  it("jednoslovné meno dá dve písmená", () => {
    expect(iniciely("Letko", "a@b.sk")).toBe("LE")
  })

  it("bez mena vyjde z adresy", () => {
    // Správca cez núdzovú brzdu v `persons` nie je a meno nemá.
    expect(iniciely(undefined, "office@ltk.solutions")).toBe("OF")
    expect(iniciely("   ", "office@ltk.solutions")).toBe("OF")
  })

  it("nikdy nevráti prázdno", () => {
    // Prázdny kruh vyzerá ako chyba načítania.
    expect(iniciely(undefined, "")).toBe("?")
    expect(iniciely("", "@nic.sk")).toBe("?")
  })

  it("medzery navyše nerozhodujú", () => {
    expect(iniciely("  Ján   Letko  ", "a@b.sk")).toBe("JL")
  })
})

describe("odtien avatara", () => {
  it("ten istý človek má vždy tú istú farbu", () => {
    // Inak sa avatar pri každom načítaní zmení a prestane byť tým, čím má
    // byť — znakom, ktorý sa dá spoznať bez čítania.
    expect(odtienAvatara("a@b.sk")).toBe(odtienAvatara("a@b.sk"))
  })

  it("rôzni ľudia spravidla rôznu", () => {
    expect(odtienAvatara("a@b.sk")).not.toBe(odtienAvatara("c@d.sk"))
  })

  it("vždy v rozsahu farebného kruhu", () => {
    for (const e of ["", "a@b.sk", "veľmi.dlhá.adresa@nejaká.organizácia.sk"]) {
      const h = odtienAvatara(e)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })
})
