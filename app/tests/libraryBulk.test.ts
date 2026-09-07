/**
 * libraryBulk.test.ts — hromadné akcie.
 *
 * Testuje sa to, čo rozhoduje o dôkazných záznamoch: že knižnica výber len
 * **odovzdá** prideľovaniu v tvare, ktorý tá obrazovka číta, a že po dávke
 * je vidieť, čo neprešlo.
 */

import { describe, it, expect } from "vitest"
import { assignHref, summarize } from "../src/lib/libraryBulk"

describe("odovzdanie výberu prideľovaniu", () => {
  it("robí opakovaný kľúč `document`, ktorý tá obrazovka už číta", () => {
    expect(assignHref(["sfz:rpp", "sfz:scn"]))
      .toBe("/hr/assign?document=sfz%3Arpp&document=sfz%3Ascn")
  })

  it("duplicity a prázdne hodnoty vypadnú", () => {
    expect(assignHref([" sfz:rpp ", "sfz:rpp", "", "  "]))
      .toBe("/hr/assign?document=sfz%3Arpp")
  })

  it("bez výberu vedie odkaz na holú obrazovku", () => {
    expect(assignHref([])).toBe("/hr/assign")
  })
})

describe("výsledok dávky", () => {
  const ok = (moved: number) => `Presunuté: ${moved}.`
  const partly = (moved: number, total: number, failed: string) =>
    `Presunuté ${moved} z ${total}. Neprešli: ${failed}`

  it("keď prejde všetko, nespomína zlyhania", () => {
    expect(summarize({ moved: ["a", "b"], failed: [] }, ok, partly)).toBe("Presunuté: 2.")
  })

  it("keď časť neprejde, vypíše ktoré a prečo", () => {
    // Ticho presunúť 1 z 2 je horšie než nepresunúť nič — bez dôvodu sa to
    // nedá opraviť.
    const text = summarize(
      { moved: ["a"], failed: [{ documentId: "b", reason: "priečinok neexistuje" }] },
      ok, partly,
    )
    expect(text).toBe("Presunuté 1 z 2. Neprešli: b (priečinok neexistuje)")
  })

  it("keď neprejde nič, je to vidieť tiež", () => {
    const text = summarize(
      { moved: [], failed: [{ documentId: "a", reason: "chyba" }] },
      ok, partly,
    )
    expect(text).toContain("0 z 1")
  })
})
