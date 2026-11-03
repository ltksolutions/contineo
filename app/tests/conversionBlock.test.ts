import { describe, expect, it } from "vitest"
import { itemBlocks, type Block, type Seg } from "../src/lib/conversionBlock"
import type { ReviewItem } from "../src/lib/conversionReview"

function item(p: Partial<ReviewItem> & Pick<ReviewItem, "kind" | "line">): ReviewItem {
  return { ids: ["x"], pdfText: "", mdText: "", before: "", after: "", pages: [1], ...p }
}

const show = (segs: Seg[]) => segs.map(s => s.mark === "new" ? `[+${s.text}]` : s.mark === "gone" ? `[-${s.text}]` : s.text).join("")
const text = (b: Block) => b.kind === "text" ? b.lines.map(l => show(l.segs)) : []

describe("itemBlocks", () => {
  it("doplnená hlavička tabuľky je zelená v hlavičke celej tabuľky", () => {
    const md = ["### 2.2.1 ASISTENTKY", "", "| Priezvisko a meno | Bydlisko |", "| --- | --- |", "| **Alezárová** Ivana | Ďurďošík |", "| Obertová Miroslava | Partizánske |"].join("\n")
    const [b] = itemBlocks(md, item({ kind: "added", mdText: "Priezvisko a meno Bydlisko", line: 3 }))
    expect(b.kind).toBe("table")
    if (b.kind !== "table") return
    expect(b.head.map(show)).toEqual(["[+Priezvisko a meno]", "[+Bydlisko]"])
    expect(b.rows.map(r => r.map(show))).toEqual([["Alezárová Ivana", "Ďurďošík"], ["Obertová Miroslava", "Partizánske"]])
  })

  it("chýbajúce slovo je prečiarknuté na svojom mieste v celom odseku", () => {
    const md = "Úvod.\n\nNovinári, rozhlasoví reportéri a pracovníci televízie akreditácia redakcií sa vykoná pred otvorením.\n\nĎalší odsek."
    const [b] = itemBlocks(md, item({ kind: "missing", pdfText: "o", before: "reportéri a pracovníci televízie", after: "akreditácia redakcií", line: 3 }))
    expect(text(b)).toEqual(["Novinári, rozhlasoví reportéri a pracovníci televízie [-o] akreditácia redakcií sa vykoná pred otvorením."])
  })

  it("iné slovo: pôvodné prečiarknuté pred novým", () => {
    const [b] = itemBlocks("Logo s veľkosťou 5 cm² na drese.", item({ kind: "changed", pdfText: "cm", mdText: "cm²", line: 1 }))
    expect(text(b)).toEqual(["Logo s veľkosťou 5 [-cm] [+cm²] na drese."])
  })

  it("presun medzi blokmi ukáže obe miesta", () => {
    const md = "Prvý odsek s textom.\n\nDruhý odsek, kde je Bratislava navyše."
    const blocks = itemBlocks(md, item({ kind: "moved", pdfText: "Bratislava", mdText: "Bratislava", before: "s textom", line: 1, toLine: 3 }))
    expect(blocks.map(text)).toEqual([["Prvý odsek s textom [-Bratislava]."], ["Druhý odsek, kde je [+Bratislava] navyše."]])
  })

  it("dlhú tabuľku skráti na riadky okolo rozdielu", () => {
    const rows = Array.from({ length: 20 }, (_, i) => `| Osoba ${i + 1} | Mesto ${i + 1} |`)
    const md = ["| Meno | Mesto |", "| --- | --- |", ...rows].join("\n")
    const [b] = itemBlocks(md, item({ kind: "added", mdText: "Mesto 10", line: 12 }))
    if (b.kind !== "table") throw new Error("tabuľka")
    expect(b.skippedBefore).toBe(6)
    expect(b.rows).toHaveLength(7)
    expect(b.skippedAfter).toBe(7)
    expect(show(b.rows[3][1])).toBe("[+Mesto 10]")
  })
})
