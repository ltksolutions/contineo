/**
 * hlavicka.test.ts — avatar v osobnom menu.
 *
 * Iniciály sú jediné, čo o človeku v hlavičke stojí, a musia vyjsť **vždy**:
 * aj u správcu, ktorý prešiel núdzovou brzdou a v `persons` nie je, aj
 * u jednoslovného mena, aj keď meno chýba úplne. Prázdny kruh vyzerá ako
 * chyba načítania.
 */

import { describe, it, expect } from "vitest"
import { initials, avatarShade } from "../src/components/Header"

describe("iniciely", () => {
  it("z mena a priezviska", () => {
    expect(initials("Ján Letko", "jan.letko@futbalsfz.sk")).toBe("JL")
  })

  it("z prvého a posledného slova, nie z prostredného", () => {
    expect(initials("Ján Peter Letko", "a@b.sk")).toBe("JL")
  })

  it("jednoslovné meno dá dve písmená", () => {
    expect(initials("Letko", "a@b.sk")).toBe("LE")
  })

  it("bez mena vyjde z adresy", () => {
    // Správca cez núdzovú brzdu v `persons` nie je a meno nemá.
    expect(initials(undefined, "office@ltk.solutions")).toBe("OF")
    expect(initials("   ", "office@ltk.solutions")).toBe("OF")
  })

  it("nikdy nevráti prázdno", () => {
    // Prázdny kruh vyzerá ako chyba načítania.
    expect(initials(undefined, "")).toBe("?")
    expect(initials("", "@nic.sk")).toBe("?")
  })

  it("medzery navyše nerozhodujú", () => {
    expect(initials("  Ján   Letko  ", "a@b.sk")).toBe("JL")
  })
})

describe("odtien avatara", () => {
  it("ten istý človek má vždy tú istú farbu", () => {
    // Inak sa avatar pri každom načítaní zmení a prestane byť tým, čím má
    // byť — znakom, ktorý sa dá spoznať bez čítania.
    expect(avatarShade("a@b.sk")).toBe(avatarShade("a@b.sk"))
  })

  it("rôzni ľudia spravidla rôznu", () => {
    expect(avatarShade("a@b.sk")).not.toBe(avatarShade("c@d.sk"))
  })

  it("vždy v rozsahu farebného kruhu", () => {
    for (const e of ["", "a@b.sk", "veľmi.dlhá.adresa@nejaká.organizácia.sk"]) {
      const h = avatarShade(e)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
    }
  })
})
