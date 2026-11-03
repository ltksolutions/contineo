import { describe, expect, it } from "vitest"
import { reviewDifferences } from "../src/lib/conversionReview"
import type { CheckDifference } from "../src/lib/conversionCheck"

function diff(p: Partial<CheckDifference> & Pick<CheckDifference, "id" | "kind">): CheckDifference {
  return { pdfText: "", mdText: "", before: "", after: "", pages: [1], line: 1, nearImage: false, words: 1, minor: false, ...p }
}

describe("reviewDifferences", () => {
  it("spojí „chýba“ a „navyše“ s tými istými slovami do presunu", () => {
    const r = reviewDifferences([
      diff({ id: "a", kind: "missing", pdfText: "Bratislava", pages: [11], line: 412 }),
      diff({ id: "b", kind: "added", mdText: "| Bratislava", pages: [11], line: 415 }),
    ])
    expect(r.pages).toHaveLength(1)
    expect(r.pages[0].items).toEqual([expect.objectContaining({ kind: "moved", ids: ["a", "b"], line: 412, toLine: 415 })])
  })

  it("páruje s najbližším riadkom, keď sa text opakuje", () => {
    const r = reviewDifferences([
      diff({ id: "m", kind: "missing", pdfText: "02 123", pages: [11], line: 400 }),
      diff({ id: "far", kind: "added", mdText: "02 123", pages: [12], line: 480 }),
      diff({ id: "near", kind: "added", mdText: "02 123", pages: [11], line: 402 }),
    ])
    const items = r.pages.flatMap(g => g.items)
    expect(items.find(i => i.kind === "moved")?.ids).toEqual(["m", "near"])
    expect(items.find(i => i.ids.includes("far"))?.kind).toBe("added")
  })

  it("iné poradie slov v jednej zmene je presun, iné slovo nie", () => {
    const r = reviewDifferences([
      diff({ id: "x", kind: "changed", pdfText: "Bratislava 02 123", mdText: "02 123 | Bratislava", line: 5 }),
      diff({ id: "y", kind: "changed", pdfText: "cm²", mdText: "cm", line: 9 }),
    ])
    expect(r.pages[0].items.map(i => i.kind)).toEqual(["moved", "changed"])
  })

  it("text pri obrázku je opis obrázka, interpunkcia ide zvlášť", () => {
    const r = reviewDifferences([
      diff({ id: "i", kind: "added", mdText: "Obrázok v origináli: logo", nearImage: true }),
      diff({ id: "p", kind: "added", mdText: ":", minor: true }),
    ])
    expect(r.pages[0].items.map(i => i.kind)).toEqual(["image"])
    expect(r.minor.map(d => d.id)).toEqual(["p"])
  })

  it("zoskupí podľa prvej strany a zoradí strany aj riadky", () => {
    const r = reviewDifferences([
      diff({ id: "c", kind: "missing", pdfText: "o", pages: [26], line: 903 }),
      diff({ id: "d", kind: "changed", pdfText: "cm²", mdText: "cm", pages: [7], line: 188 }),
      diff({ id: "e", kind: "missing", pdfText: "hlavička", pages: [7, 8], line: 180 }),
    ])
    expect(r.pages.map(g => [g.from, g.to])).toEqual([[7, 8], [26, 26]])
    expect(r.pages[0].items.map(i => i.ids[0])).toEqual(["e", "d"])
  })
})

describe("presuny v tabuľke", () => {
  const md = [
    "| Meno | Adresa | Telefón |",
    "|---|---|---|",
    "| MUDr. Pavel Malovič | amb. telových. lekárstva, Lehnice 15 | 0910 703 757 |",
    "| MUDr. Robert Dinka | Nábr. Gen Svobodu, Bratislava | 0918 462 173 |",
    "| MUDr. Michal Fečík | Lúčna 57 | 0908 801 549 |",
  ].join("\n")

  it("presun v jednom riadku tabuľky ide medzi drobnosti s bunkami riadku", () => {
    const r = reviewDifferences([
      diff({ id: "a", kind: "missing", pdfText: "0910 703 757", pages: [12], line: 3 }),
      diff({ id: "b", kind: "added", mdText: "0910 703 757", pages: [12], line: 3 }),
      diff({ id: "c", kind: "changed", pdfText: "0918 462 173 Bratislava", mdText: "Bratislava | 0918 462 173", pages: [11], line: 4 }),
    ], md)
    expect(r.pages).toEqual([])
    expect(r.rowOrder.map(i => [i.ids, i.cells[0], i.marked])).toEqual([
      [["a", "b"], "MUDr. Pavel Malovič", 2],
      [["c"], "MUDr. Robert Dinka", -1],
    ])
  })

  it("presun medzi riadkami ostáva položkou s menami riadkov", () => {
    const r = reviewDifferences([
      diff({ id: "a", kind: "missing", pdfText: "Bratislava", pages: [11], line: 5 }),
      diff({ id: "b", kind: "added", mdText: "Bratislava", pages: [11], line: 4 }),
    ], md)
    expect(r.rowOrder).toEqual([])
    expect(r.pages[0].items[0]).toEqual(expect.objectContaining({ kind: "moved", fromRow: "MUDr. Michal Fečík", toRow: "MUDr. Robert Dinka" }))
  })

  it("mimo tabuľky sa presun nemení", () => {
    const r = reviewDifferences([
      diff({ id: "a", kind: "missing", pdfText: "slovo", line: 1 }),
      diff({ id: "b", kind: "added", mdText: "slovo", line: 1 }),
    ], "Obyčajný odsek so slovo.")
    expect(r.rowOrder).toEqual([])
    expect(r.pages[0].items[0].kind).toBe("moved")
  })
})

describe("presun na konci riadku tabuľky", () => {
  it("medzera na začiatku ďalšieho riadku patrí riadku, ktorým okolie končí", () => {
    const md = [
      "| MUDr. Robert Dinka | Nábr. Gen Svobodu, Bratislava | 0918 462 173 |",
      "| MUDr. Michal Fečík | Lúčna 57 | 0908 801 549 |",
    ].join("\n")
    const r = reviewDifferences([
      diff({ id: "a", kind: "missing", pdfText: "Bratislava", before: "Svobodu, Bratislava 0918 462 173", after: "MUDr. Michal", line: 2 }),
      diff({ id: "b", kind: "added", mdText: "Bratislava", before: "Nábr. Gen Svobodu,", after: "0918 462 173", line: 1 }),
    ], md)
    expect(r.pages).toEqual([])
    expect(r.rowOrder[0].cells[0]).toBe("MUDr. Robert Dinka")
  })
})
