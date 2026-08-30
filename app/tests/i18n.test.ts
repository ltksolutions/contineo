/**
 * i18n.test.ts — tri jazyky, jeden tvar.
 *
 * Chýbajúci kľúč v `cs` alebo `en` sa v TypeScripte prejaví, ale prázdny
 * reťazec nie: prekladateľ ho vyplní neskôr a na obrazovke zostane diera,
 * ktorú nikto nenahlási. Preto sa tu porovnáva tvar aj obsah.
 *
 * Slovenčina je referencia — je to jazyk, v ktorom sa texty píšu.
 */

import { describe, it, expect } from "vitest"
import { DICTIONARY, UI_LANGUAGES, dictionary, normalizeLanguage, formatDate } from "../src/lib/i18n"

/** Cesty ku všetkým listom slovníka (funkcie a polia sa berú ako listy). */
function paths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix]
  return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k))
}

/** Hodnoty listov — funkcia sa zavolá s neutrálnymi argumentmi. */
function leaf(value: unknown): string {
  if (typeof value === "function") {
    try { return String((value as (...a: unknown[]) => unknown)("x", "y", 1)) } catch { return "?" }
  }
  if (Array.isArray(value)) return value.join(" ")
  return String(value)
}

function leaves(value: unknown, prefix = ""): [string, unknown][] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [[prefix, value]]
  return Object.entries(value).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

describe("slovník", () => {
  it("čeština a angličtina majú rovnaké kľúče ako slovenčina", () => {
    const sk = paths(DICTIONARY.sk).sort()
    for (const language of UI_LANGUAGES) {
      expect(paths(DICTIONARY[language]).sort(), `jazyk ${language}`).toEqual(sk)
    }
  })

  it("žiadny text nie je prázdny", () => {
    for (const language of UI_LANGUAGES) {
      for (const [path, value] of leaves(DICTIONARY[language])) {
        expect(leaf(value).trim(), `${language}.${path}`).not.toBe("")
      }
    }
  })

  it("pole príkladov má v každom jazyku rovnaký počet", () => {
    const n = DICTIONARY.sk.ask.examples.length
    expect(n).toBeGreaterThan(0)
    for (const language of UI_LANGUAGES) {
      expect(DICTIONARY[language].ask.examples.length, `jazyk ${language}`).toBe(n)
    }
  })

  it("neznámy jazyk padá do slovenčiny, nie do angličtiny", () => {
    // Zákazník je slovenský; anglická obrazovka pri preklepe v `language`
    // vyzerá ako porucha, slovenská nie.
    expect(dictionary("de")).toBe(DICTIONARY.sk)
    expect(dictionary(undefined)).toBe(DICTIONARY.sk)
    expect(normalizeLanguage("cs-CZ")).toBe("cs")
    expect(normalizeLanguage("en_GB")).toBe("en")
  })

  it("dátum je v každom jazyku deterministický", () => {
    // Do potvrdenia sa ukladá text; keby závisel od locale servera, to isté
    // potvrdenie by v inom prostredí vyzeralo inak (D28).
    const d = new Date("2026-09-01T00:00:00Z")
    expect(formatDate(d, "sk")).toBe("1. 9. 2026")
    expect(formatDate(d, "cs")).toBe("1. 9. 2026")
    expect(formatDate(d, "en")).toBe("1 September 2026")
  })
})
