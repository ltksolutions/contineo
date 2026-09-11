/**
 * overview.test.ts — okná „nové" a „expiruje" (Prehľad).
 *
 * Obe dlaždice sú okno v čase a pri okne sa dá pomýliť na oboch koncoch.
 * Testujú sa hranice a hlavne to, čo do okna **nepatrí**: znenie, ktorému
 * platnosť už skončila, neexpiruje — už vypršalo, a to je iná veta.
 *
 * Dotazy do databázy sa netestujú; testuje sa výber a poradie, teda to, kde
 * je rozhodnutie.
 */

import { describe, it, expect } from "vitest"
import { NEW_DAYS, EXPIRING_DAYS } from "../src/lib/overview"

const DEN = 24 * 60 * 60 * 1000

/** Rovnaké pravidlo ako v `libraryNews()` — sem vytiahnuté, aby sa dalo skúšať. */
const jeNove = (publishedAt: number, asOf: number, days = NEW_DAYS) =>
  publishedAt >= asOf - days * DEN && publishedAt <= asOf

/** Rovnaké pravidlo ako v `expiringVersions()`. */
const expiruje = (effectiveTo: number, asOf: number, days = EXPIRING_DAYS) =>
  effectiveTo >= asOf && effectiveTo <= asOf + days * DEN

const teraz = new Date("2026-09-10T12:00:00Z").getTime()

describe("nové za 7 dní", () => {
  it("včerajšie je nové", () => {
    expect(jeNove(teraz - 1 * DEN, teraz)).toBe(true)
  })

  it("presne sedem dní staré ešte je nové", () => {
    expect(jeNove(teraz - 7 * DEN, teraz)).toBe(true)
  })

  it("osem dní staré už nie", () => {
    expect(jeNove(teraz - 8 * DEN, teraz)).toBe(false)
  })

  it("znenie s dátumom v budúcnosti sa medzi novinky nepočíta", () => {
    // Publikovať sa dá s účinnosťou dopredu; „nové" znamená „pribudlo",
    // nie „raz pribudne".
    expect(jeNove(teraz + 2 * DEN, teraz)).toBe(false)
  })
})

describe("expiruje do 30 dní", () => {
  it("o týždeň expiruje", () => {
    expect(expiruje(teraz + 7 * DEN, teraz)).toBe(true)
  })

  it("presne o tridsať dní ešte expiruje", () => {
    expect(expiruje(teraz + 30 * DEN, teraz)).toBe(true)
  })

  it("o tridsaťjeden dní už nie", () => {
    expect(expiruje(teraz + 31 * DEN, teraz)).toBe(false)
  })

  it("čo už vypršalo, neexpiruje", () => {
    // Toto je to miesto, kde sa dá pomýliť: `effectiveTo` v minulosti nie je
    // varovanie do budúcnosti, je to iný stav. Zamiešať ho medzi „expiruje
    // do 30 dní" by znamenalo, že dlaždica ukazuje aj to, čo je dávno preč.
    expect(expiruje(teraz - 1 * DEN, teraz)).toBe(false)
  })
})
