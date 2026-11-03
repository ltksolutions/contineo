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
