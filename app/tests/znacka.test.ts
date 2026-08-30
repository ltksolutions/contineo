/**
 * znacka.test.ts — nahrávanie loga.
 *
 * Kontrola vstupu je tu jediné, čo môže spôsobiť škodu: logo sa servíruje
 * z **našej** domény, teda z tej istej, na ktorej sa potvrdzujú smernice.
 */

import { describe, it, expect } from "vitest"
import { checkFile, brandPath, MAX_BYTES, BrandError } from "../src/lib/branding"

describe("kontrola nahrateho suboru", () => {
  it("bežné rastrové formáty prejdú", () => {
    for (const typ of ["image/png", "image/jpeg", "image/webp"]) {
      expect(() => checkFile(typ, 10_000)).not.toThrow()
    }
  })

  it("SVG neprejde, ani keď je malé", () => {
    // Je to spustiteľný dokument. Servírovať ho z našej domény znamená
    // pustiť cudzí kód tam, kde sa potvrdzujú smernice.
    expect(() => checkFile("image/svg+xml", 500)).toThrow(BrandError)
  })

  it("chyba pri SVG povie, čo namiesto neho", () => {
    // Hláška, ktorá nepovie, čo s ňou, je len iná podoba mlčania.
    expect(() => checkFile("image/svg+xml", 500)).toThrow(/PNG/)
  })

  it("neznámy ani chýbajúci typ neprejde", () => {
    expect(() => checkFile("application/pdf", 500)).toThrow(BrandError)
    expect(() => checkFile("", 500)).toThrow(BrandError)
  })

  it("prázdny súbor neprejde", () => {
    expect(() => checkFile("image/png", 0)).toThrow(BrandError)
  })

  it("príliš veľký súbor neprejde a povie koľko", () => {
    expect(() => checkFile("image/png", MAX_BYTES + 1)).toThrow(/kB/)
  })

  it("presne na hranici ešte prejde", () => {
    expect(() => checkFile("image/png", MAX_BYTES)).not.toThrow()
  })
})

describe("cesta k logu", () => {
  it("nesie verziu, takže sa nové logo ukáže hneď", () => {
    // Pamäť je nastavená na rok. Bez verzie v adrese by sa nové logo
    // neukázalo, kým si prehliadač nevyprázdni pamäť.
    const a = brandPath("SFZ", "abc")
    const b = brandPath("SFZ", "xyz")
    expect(a).not.toBe(b)
    expect(a).toContain("v=abc")
  })

  it("kód organizácie je v adrese malými písmenami a zakódovaný", () => {
    expect(brandPath("SFZ", "v1")).toContain("/api/znacka/sfz")
    expect(brandPath("A/B", "v1")).toContain("a%2Fb")
  })
})
