/**
 * znacka.test.ts — nahrávanie loga.
 *
 * Kontrola vstupu je tu jediné, čo môže spôsobiť škodu: logo sa servíruje
 * z **našej** domény, teda z tej istej, na ktorej sa potvrdzujú smernice.
 */

import { describe, it, expect } from "vitest"
import { skontrolujSubor, cestaZnacky, MAX_BAJTOV, ZnackaError } from "../src/lib/branding"

describe("kontrola nahrateho suboru", () => {
  it("bežné rastrové formáty prejdú", () => {
    for (const typ of ["image/png", "image/jpeg", "image/webp"]) {
      expect(() => skontrolujSubor(typ, 10_000)).not.toThrow()
    }
  })

  it("SVG neprejde, ani keď je malé", () => {
    // Je to spustiteľný dokument. Servírovať ho z našej domény znamená
    // pustiť cudzí kód tam, kde sa potvrdzujú smernice.
    expect(() => skontrolujSubor("image/svg+xml", 500)).toThrow(ZnackaError)
  })

  it("chyba pri SVG povie, čo namiesto neho", () => {
    // Hláška, ktorá nepovie, čo s ňou, je len iná podoba mlčania.
    expect(() => skontrolujSubor("image/svg+xml", 500)).toThrow(/PNG/)
  })

  it("neznámy ani chýbajúci typ neprejde", () => {
    expect(() => skontrolujSubor("application/pdf", 500)).toThrow(ZnackaError)
    expect(() => skontrolujSubor("", 500)).toThrow(ZnackaError)
  })

  it("prázdny súbor neprejde", () => {
    expect(() => skontrolujSubor("image/png", 0)).toThrow(ZnackaError)
  })

  it("príliš veľký súbor neprejde a povie koľko", () => {
    expect(() => skontrolujSubor("image/png", MAX_BAJTOV + 1)).toThrow(/kB/)
  })

  it("presne na hranici ešte prejde", () => {
    expect(() => skontrolujSubor("image/png", MAX_BAJTOV)).not.toThrow()
  })
})

describe("cesta k logu", () => {
  it("nesie verziu, takže sa nové logo ukáže hneď", () => {
    // Pamäť je nastavená na rok. Bez verzie v adrese by sa nové logo
    // neukázalo, kým si prehliadač nevyprázdni pamäť.
    const a = cestaZnacky("SFZ", "abc")
    const b = cestaZnacky("SFZ", "xyz")
    expect(a).not.toBe(b)
    expect(a).toContain("v=abc")
  })

  it("kód organizácie je v adrese malými písmenami a zakódovaný", () => {
    expect(cestaZnacky("SFZ", "v1")).toContain("/api/znacka/sfz")
    expect(cestaZnacky("A/B", "v1")).toContain("a%2Fb")
  })
})
