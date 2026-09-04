/**
 * errors.test.ts — chyby z knižnice, veta až na obrazovke.
 *
 * `AppError` nesie kód a hodnoty. Zlyhania sú tu dve a obe tiché: kód, ktorý
 * v slovníku nikto nedoplnil, a dosadenie, ktoré v preklade vypadlo. Ani
 * jedno nespôsobí výnimku — človek len uvidí text, ktorý nedáva zmysel.
 */

import { describe, it, expect } from "vitest"
import { AppError } from "../src/lib/appError"
import { DICTIONARY, UI_LANGUAGES, errorText } from "../src/lib/i18n"
import { LibraryError } from "../src/lib/libraryWrite"

describe("chybové hlášky", () => {
  it("kód sa preloží do jazyka človeka", () => {
    const e = new LibraryError("library.versionNotFound", "Také znenie tu nie je.")
    expect(errorText(e, "sk")).toBe(DICTIONARY.sk.errors["library.versionNotFound"])
    expect(errorText(e, "en")).toBe(DICTIONARY.en.errors["library.versionNotFound"])
    expect(errorText(e, "en")).not.toBe(errorText(e, "sk"))
  })

  it("hodnoty sa dosadia", () => {
    const e = new AppError("file.tooLarge", "Súbor má 12 MB, strop je 8 MB.", { mb: 12, maxMb: 8 })
    for (const language of UI_LANGUAGES) {
      const text = errorText(e, language)
      expect(text, language).toContain("12")
      expect(text, language).toContain("8")
      expect(text, language).not.toContain("{")
    }
  })

  it("neznámy kód spadne na vetu z výnimky, nie na prázdno", () => {
    const e = new AppError("nieco.coNepoznam", "Slovenská záloha.")
    expect(errorText(e, "en")).toBe("Slovenská záloha.")
  })

  it("cudzia výnimka sa na obrazovku nerozbalí", () => {
    // Text cudzej chyby môže obsahovať čokoľvek — cesty, dotazy, kus konfigurácie.
    const text = errorText(new Error("ECONNREFUSED 10.0.0.1:27017"), "sk")
    expect(text).toBe(DICTIONARY.sk.errors.unknown)
    expect(text).not.toContain("27017")
  })

  it("každý kód má text vo všetkých troch jazykoch", () => {
    const sk = Object.keys(DICTIONARY.sk.errors).sort()
    for (const language of UI_LANGUAGES) {
      expect(Object.keys(DICTIONARY[language].errors).sort(), `jazyk ${language}`).toEqual(sk)
    }
  })

  it("dosadzovacie miesta sedia vo všetkých jazykoch", () => {
    // Chýbajúce `{count}` v preklade vyzerá ako hotová veta, len bez čísla —
    // a to si nikto nevšimne, kým sa nespýta, koľkých ľudí sa to týka.
    const places = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",")
    for (const [code, text] of Object.entries(DICTIONARY.sk.errors)) {
      for (const language of UI_LANGUAGES) {
        expect(places(DICTIONARY[language].errors[code]), `${language}.${code}`)
          .toBe(places(text))
      }
    }
  })
})
