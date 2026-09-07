/**
 * multiSelect.test.ts — logika viacnásobného výberu.
 *
 * Testuje sa to, čo sa dá pokaziť ticho: tvar uloženej hodnoty a to, či sa
 * pri ukladaní nestratí niečo, čo nikto zmazať nechcel. Vykreslenie sa tu
 * neskúša — testy bežia v prostredí `node`, bez DOM.
 */

import { describe, it, expect } from "vitest"
import { fold, normalizeValue, mergeOptions, filterOptions, serialize } from "../src/components/MultiSelect"
import { normalizeKeys } from "../src/lib/persons"
import { splitList } from "../src/lib/oauth"

describe("normalizeValue", () => {
  it("robí to isté, čo server", () => {
    // Toto je jadro veci: keby klient normalizoval inak než `normalizeKeys()`,
    // vznikli by dve hodnoty pre tú istú vec a jedna z nich by nikdy nikomu
    // nesadla. Handoff navrhoval nahrádzať medzery podčiarkovníkom — server
    // to nerobí, takže sa to nerobí ani tu.
    for (const raw of ["  Právne a legislatíva ", "HR", "Ekonomika"]) {
      expect(normalizeValue(raw)).toBe(normalizeKeys([raw])[0])
    }
  })
})

describe("fold", () => {
  it("zahodí diakritiku aj veľkosť písmen", () => {
    expect(fold("Právne a legislatíva")).toBe("pravne a legislativa")
    expect(fold("ŽILINA")).toBe("zilina")
  })

  it("hľadanie bez diakritiky nájde položku s ňou", () => {
    const all = [
      { value: "pravne", label: "Právne a legislatíva" },
      { value: "hr", label: "Ľudské zdroje" },
    ]
    expect(filterOptions(all, "pravne").map(o => o.value)).toEqual(["pravne"])
    expect(filterOptions(all, "ĽUDSKÉ").map(o => o.value)).toEqual(["hr"])
    expect(filterOptions(all, "ludske").map(o => o.value)).toEqual(["hr"])
  })

  it("prázdny dotaz vráti všetko", () => {
    const all = [{ value: "a", label: "A" }, { value: "b", label: "B" }]
    expect(filterOptions(all, "   ")).toHaveLength(2)
  })
})

describe("mergeOptions", () => {
  it("ponúkne aj hodnotu, ktorú má len tento záznam", () => {
    // Útvar zrušili a zostal na jedinom dokumente. Keby v ponuke nebol,
    // uloženie formulára by ho ticho odstránilo — a nikto to nechcel.
    const merged = mergeOptions([{ value: "hr", label: "Ľudské zdroje" }], ["hr", "zrusene_stredisko"])
    expect(merged.map(o => o.value)).toEqual(["hr", "zrusene_stredisko"])
    expect(merged[1].label).toBe("zrusene_stredisko")
  })

  it("nezdvojí hodnotu, ktorá v ponuke už je", () => {
    const merged = mergeOptions([{ value: "HR", label: "Ľudské zdroje" }], ["hr"])
    expect(merged).toHaveLength(1)
  })
})

describe("serialize", () => {
  it("dá tvar, ktorý server prečíta späť", () => {
    const chosen = ["pravne", "hr", "ekonomika"]
    expect(serialize(chosen)).toBe("pravne, hr, ekonomika")
    // Kruh sa musí uzavrieť: čo komponent odošle, to `splitList()` rozloží
    // na tie isté hodnoty. Inak sa strata prejaví až u zákazníka.
    expect(splitList(serialize(chosen))).toEqual(chosen)
  })

  it("prázdny výber je prázdny reťazec, nie čiarka", () => {
    expect(serialize([])).toBe("")
    expect(splitList(serialize([]))).toEqual([])
  })
})
