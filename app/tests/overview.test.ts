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
import { NEW_DAYS, EXPIRING_DAYS, pickRecent } from "../src/lib/overview"

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

describe("pickRecent — posledné dokumenty knižnice na Prehľade", () => {
  const asOf = new Date("2026-10-26")
  const doc = (documentId: string, versions: { label: string; publishedAt?: string }[]) => ({ documentId, title: `Dokument ${documentId}`, versions: versions as never })

  it("každý dokument raz, podľa najnovšie zverejneného znenia, najnovšie hore", () => {
    const out = pickRecent([
      doc("a", [{ label: "v1", publishedAt: "2026-01-01" }, { label: "v2", publishedAt: "2026-09-01" }]),
      doc("b", [{ label: "v1", publishedAt: "2026-10-01" }]),
    ], 10, asOf)
    expect(out.map(x => `${x.documentId}:${x.versionLabel}`)).toEqual(["b:v1", "a:v2"])
  })
  it("bez časovej hranice — aj rok staré dokumenty sú v paneli", () => {
    expect(pickRecent([doc("a", [{ label: "v1", publishedAt: "2024-01-01" }])], 5, asOf)).toHaveLength(1)
  })
  it("znenie zverejnené v budúcnosti a dokument bez zverejnenia sa vynechajú", () => {
    expect(pickRecent([doc("a", [{ label: "v1", publishedAt: "2027-01-01" }]), doc("b", [{ label: "v1" }])], 5, asOf)).toHaveLength(0)
  })
  it("strop počtu", () => {
    const docs = ["a", "b", "c"].map((id, i) => doc(id, [{ label: "v1", publishedAt: `2026-0${i + 1}-01` }]))
    expect(pickRecent(docs, 2, asOf).map(x => x.documentId)).toEqual(["c", "b"])
  })
})
