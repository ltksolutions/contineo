/**
 * complianceContext.test.ts — okolie nálezu v koncepte (23. 10. 2026).
 */
import { describe, it, expect } from "vitest"
import { findingContext } from "../src/lib/complianceView"

const base = [
  "## Kam sa obrátiť",
  "",
  "### Matrika SFZ",
  "",
  "Matrika SFZ rieši tieto veci:",
  "",
  "- zmena názvu klubu,",
  "- zrušenie registrácie hráča: žiadosť podáva hráč alebo klub v ISSF alebo písomne a doručí sa matrike SFZ.",
  "- schvaľovanie zmlúv.",
  "",
  "### Sekretár zväzu",
  "",
  "Zmena údajov klubu.",
].join("\n")

describe("findingContext", () => {
  it("vráti celý zoznam s úryvkom, nadpis oddielu a blok pred ním", () => {
    const c = findingContext(base, "v ISSF alebo písomne", "rovnakým spôsobom ako žiadosť o registráciu, t. j. elektronicky v ISSF,")!
    expect(c.heading).toBe("Matrika SFZ")
    expect(c.before).toBe("Matrika SFZ rieši tieto veci:")
    expect(c.block).toContain("- zmena názvu klubu,")
    expect(c.block).toContain("- schvaľovanie zmlúv.")
    expect(c.blockAfter).toContain("elektronicky v ISSF, a doručí")
    expect(c.blockAfter).not.toContain("alebo písomne")
    expect(c.after).toBeNull() // za zoznamom je nadpis ďalšieho oddielu
  })

  it("nájde úryvok aj bez Markdownu; blok po zmene vtedy nevie zložiť", () => {
    const c = findingContext(base.replace("zrušenie registrácie", "**zrušenie registrácie**"), "zrušenie registrácie hráča: žiadosť podáva hráč", "nové")!
    expect(c.block).toContain("**zrušenie registrácie**")
    expect(c.blockAfter).toBeNull()
  })

  it("úryvok, ktorý v koncepte nie je, vráti null", () => {
    expect(findingContext(base, "Tento text v manuáli nikdy nebol a nebude.", "x")).toBeNull()
  })
})
