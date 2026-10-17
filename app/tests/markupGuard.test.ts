/**
 * markupGuard.test.ts — zmeny zápisu, ktoré človek nepísal (16. 10. 2026).
 */
import { describe, it, expect } from "vitest"
import { markupChanges, restoreMarkup, letters } from "../src/lib/markupGuard"

// Presne to, čo editor urobil so Súťažným poriadkom.
const before = [
  "(1) Prvý klub a druhý klub uzatvárajú dohodu, ktoré bude a) mať názov*",
  "(2) Strany dohody sa dohodli, že prvý klub/druhý klub****** bude…",
  "",
  "***Uvedie sa po mene a priezvisku aj označenie štatutárneho orgánu.",
  "(4) Strany dohody vyhlasujú, že si túto dohodu prečítali.",
].join("\n")

describe("markupChanges", () => {
  it("escapovanie hviezdičiek je zmena zápisu bez zmeny počtu; *** → * je zmena počtu", () => {
    const after = [
      "(1) Prvý klub a druhý klub uzatvárajú dohodu, ktoré bude a) mať názov\\*",
      "(2) Strany dohody sa dohodli, že prvý klub/druhý klub\\*\\*\\*\\*\\*\\* bude…",
      "",
      "*Uvedie sa po mene a priezvisku aj označenie štatutárneho orgánu.",
      "(4) Strany dohody vyhlasujú, že si túto dohodu prečítali.",
    ].join("\n")
    const changes = markupChanges(before, after)
    expect(changes.map(c => [c.line, c.stars])).toEqual([[0, false], [1, false], [3, true]])
  })

  it("skutočná úprava (iné písmená) nie je zmena zápisu", () => {
    const after = before.replace("prečítali", "prečítali a podpísali")
    expect(markupChanges(before, after)).toEqual([])
  })

  it("úprava človeka a zmena zápisu v tom istom uložení: strážca vidí len zápis", () => {
    const after = before
      .replace("prečítali.", "prečítali a pochopili.")
      .replace("***Uvedie", "*Uvedie")
    const changes = markupChanges(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ before: "***Uvedie sa po mene a priezvisku aj označenie štatutárneho orgánu.", stars: true })
  })

  it("vložený alebo zmazaný riadok nie je zmena zápisu", () => {
    expect(markupChanges("a\nb", "a\n**nový**\nb")).toEqual([])
    expect(markupChanges("a\n**b**\nc", "a\nc")).toEqual([])
  })
})

describe("restoreMarkup", () => {
  it("vráti pôvodný zápis v daných riadkoch, úpravy človeka ostanú", () => {
    const after = before.replace("prečítali.", "prečítali a pochopili.").replace("***Uvedie", "*Uvedie")
    const restored = restoreMarkup(after, markupChanges(before, after))
    expect(restored).toContain("***Uvedie sa")
    expect(restored).toContain("prečítali a pochopili.")
  })
})

describe("letters", () => {
  it("ignoruje značky, lomky a medzery", () => {
    expect(letters("klub\\*\\*\\* bude")).toBe("klub bude")
    expect(letters("## **Článok 5**  –  Pojmy")).toBe("Článok 5 – Pojmy")
  })
})
