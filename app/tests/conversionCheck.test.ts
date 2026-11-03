/**
 * Kontrola slov prevodu modelom proti textovej vrstve PDF (ADR-046, D299).
 *
 * Testy sú o tom, čo sa hlási a čo nie: model smie meniť značkovanie,
 * medzery a delenie slov, nesmie meniť slová.
 */
import { describe, it, expect } from "vitest"
import { checkConversion, diffTokens, stripMarkup, unresolvedDifferences, type LayerPage } from "../src/lib/conversionCheck"

const page = (lines: string[], images = 0): LayerPage => ({ lines, images })

describe("čo nie je nezhoda", () => {
  it("značkovanie Markdownu, zoznam a tabuľka", () => {
    const pdf = [page(["Článok 1", "Predmet úpravy", "a) prvá položka", "Súťaž Rozmer", "II. L 105 x 68 m"])]
    const md = "## Článok 1\n\n**Predmet úpravy**\n\n- a) prvá položka\n\n| Súťaž | Rozmer |\n| --- | --- |\n| II. L | 105 x 68 m |"
    expect(checkConversion(pdf, md).differences).toEqual([])
  })

  it("slovo rozdelené na konci riadku a slovo rozbité medzerou", () => {
    const pdf = [page(["v súlade s pod-", "mienkami komis iám"])]
    expect(checkConversion(pdf, "v súlade s podmienkami komisiám").differences).toEqual([])
  })

  it("úvodzovky, pomlčky a odrážkové znaky", () => {
    const pdf = [page(["▪ „Majster SR“ – finále"])]
    expect(checkConversion(pdf, "- \"Majster SR\" - finále").differences).toEqual([])
  })

  it("hlavička na okraji viacerých strán a číslo strany", () => {
    const head = "Rozpis súťaží SFZ 2026/27"
    const pdf = [page([head, "prvý text", "1"]), page([head, "druhý text", "2"]), page([head, "tretí text", "3"])]
    const r = checkConversion(pdf, "prvý text\n\ndruhý text\n\ntretí text")
    expect(r.differences).toEqual([])
    expect(r.repeatedLines).toEqual(["Rozpis súťaží SFZ #/#"])
  })

  it("rovnaký riadok uprostred strán je obsah, nie hlavička", () => {
    const pdf = [1, 2, 3].map(n => page([`Súťaž ${n}`, `skupina ${n}`, "Hrací systém: každý s každým", `koniec ${n}`, "x"]))
    const md = [1, 2, 3].map(n => `Súťaž ${n}\n\nskupina ${n}\n\nkoniec ${n}\n\nx`).join("\n\n")
    const r = checkConversion(pdf, md)
    expect(r.differences.filter(d => d.kind === "missing")).toHaveLength(3)
  })
})

describe("čo je nezhoda", () => {
  it("iné slovo", () => {
    const r = checkConversion([page(["klub môže podať námietku"])], "klub musí podať námietku")
    expect(r.differences).toMatchObject([{ kind: "changed", pdfText: "môže", mdText: "musí", minor: false }])
  })

  it("vynechané slovo aj s okolím a stranou", () => {
    const r = checkConversion([page(["úvod"]), page(["poplatok je 30 eur splatný do konca mesiaca"])], "úvod\n\npoplatok je splatný do konca mesiaca")
    expect(r.differences).toMatchObject([{ kind: "missing", pdfText: "30 eur", before: "úvod poplatok je", pages: [2] }])
  })

  it("text navyše pri strane s obrázkom — prepis z obrázka", () => {
    const r = checkConversion([page(["Tabuľka A"], 1), page(["a) Odmeny DO"])], "Tabuľka A\n\n| R | 719 |\n\na) Odmeny DO")
    expect(r.differences).toMatchObject([{ kind: "added", mdText: "R 719", nearImage: true, line: 3 }])
  })

  it("veľké písmená sú zmena", () => {
    const r = checkConversion([page(["ROZPIS SÚŤAŽÍ"])], "Rozpis súťaží")
    expect(r.differences).toHaveLength(1)
  })

  it("len interpunkcia je drobná nezhoda", () => {
    const r = checkConversion([page(["Predseda Ján Kováčik"])], "Predseda: Ján Kováčik")
    expect(r.differences).toMatchObject([{ kind: "added", mdText: ":", minor: true }])
  })

  it("blízke nezhody sú jedno miesto", () => {
    const r = checkConversion([page(["3. ÚČASTNÍCI SÚŤAŽÍ"])], "## čl. 3 — ÚČASTNÍCI SÚŤAŽÍ")
    expect(r.differences).toHaveLength(1)
  })
})

describe("potvrdenie", () => {
  it("odtlačok je stabilný a potvrdená nezhoda už nečaká", () => {
    const pdf = [page(["klub môže podať námietku", "a odvolanie"])]
    const a = checkConversion(pdf, "klub musí podať námietku a odvolanie")
    const b = checkConversion(pdf, "klub musí podať námietku a odvolanie")
    expect(a.differences[0].id).toBe(b.differences[0].id)
    expect(unresolvedDifferences(a, [a.differences[0].id])).toEqual([])
    expect(unresolvedDifferences(a, [])).toHaveLength(1)
  })
})

describe("porovnanie postupností", () => {
  it("dlhé texty s jednou zmenou nájde presne", () => {
    const a = Array.from({ length: 20000 }, (_, i) => `w${i % 700}`)
    const b = [...a.slice(0, 9000), "nové", ...a.slice(9001)]
    const changed = diffTokens(a, b).filter(o => o.kind !== "same")
    expect(changed).toEqual([
      { kind: "del", aStart: 9000, aEnd: 9001, bStart: 9000, bEnd: 9000 },
      { kind: "ins", aStart: 9001, aEnd: 9001, bStart: 9000, bEnd: 9001 },
    ])
  })

  it("bez spoločných slov je všetko iné", () => {
    expect(diffTokens(["a", "b"], ["c"]).map(o => o.kind)).toEqual(["del", "ins"])
  })

  it("oddeľovač tabuľky a nadpis sa zo značkovania vyzlečú", () => {
    expect(stripMarkup("| --- | :---: |")).toBe("")
    expect(stripMarkup("### **7.2 Úhrada**")).toBe("7.2 Úhrada")
  })
})
