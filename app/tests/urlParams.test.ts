/**
 * urlParams.test.ts — preklad starých kľúčov a hodnôt v adrese.
 *
 * Testuje sa presne to, čo by pri chybe potichu rozbilo staré odkazy:
 * záložku v e-maile, stránku v obľúbených, formulár vykreslený pred
 * nasadením. Chyba by sa neprejavila výnimkou — stránka by sa otvorila,
 * len by ukázala niečo iné, než človek čakal.
 */

import { describe, it, expect } from "vitest"
import { normalizeQuery, tabValue, LEGACY_QUERY_KEYS } from "../src/lib/urlParams"

describe("preklad kľúčov v adrese", () => {
  it("starý kľúč sa prepíše na nový", () => {
    expect(normalizeQuery({ sprava: "Uložené" })).toEqual({ msg: "Uložené" })
    expect(normalizeQuery({ chyba: "1" })).toEqual({ error: "1" })
    expect(normalizeQuery({ zalozka: "utvary" })).toEqual({ tab: "utvary" })
  })

  it("nový kľúč vyhráva nad starým", () => {
    // Adresa môže niesť oboje: starý odkaz sa preklikne na novú stránku,
    // ktorá k nemu pridá svoj kľúč. Prepísať nový starým by vrátilo človeka
    // tam, odkiaľ prišiel.
    expect(normalizeQuery({ tab: "audit", zalozka: "vzhlad" })).toEqual({ tab: "audit" })
  })

  it("neznáme kľúče prejdú bez zmeny", () => {
    expect(normalizeQuery({ q: "test", category: "norma" })).toEqual({ q: "test", category: "norma" })
  })

  it("prázdny vstup nič nevyrobí", () => {
    expect(normalizeQuery({})).toEqual({})
  })

  it("každý starý kľúč má nový a žiadny sa neprekrýva", () => {
    const news = Object.values(LEGACY_QUERY_KEYS)
    expect(new Set(news).size).toBe(news.length)
    expect(news.every(n => !(n in LEGACY_QUERY_KEYS))).toBe(true)
  })
})

describe("preklad hodnoty záložky", () => {
  it("dve generácie starých kľúčov vedú na tú istú záložku", () => {
    // `utvary` → `oddelenia` → `departments`. Odkaz z prvej generácie musí
    // fungovať rovnako ako z druhej.
    expect(tabValue("utvary")).toBe("departments")
    expect(tabValue("oddelenia")).toBe("departments")
  })

  it("ostatné slovenské záložky sa preložia", () => {
    expect(tabValue("vzhlad")).toBe("branding")
    expect(tabValue("domeny")).toBe("domains")
    expect(tabValue("prihlasenie")).toBe("signin")
    expect(tabValue("ciselniky")).toBe("codelists")
    expect(tabValue("clenenie")).toBe("chunking")
  })

  it("nová hodnota aj neznáma prejdú tak, ako prišli", () => {
    expect(tabValue("departments")).toBe("departments")
    expect(tabValue("audit")).toBe("audit")
    expect(tabValue("nieco")).toBe("nieco")
    expect(tabValue(undefined)).toBeUndefined()
  })
})
