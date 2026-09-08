/**
 * tenantStyle.test.ts — CSS premenné farby organizácie.
 *
 * Farba tenanta je uložená v databáze, čiže **dáta**: môže byť prázdna,
 * skrátená na tri znaky alebo pokazená ručnou úpravou. Rozhranie sa musí
 * vykresliť vo všetkých troch prípadoch — a hlavne sa nesmie vykresliť
 * s premennou, ktorá vyzerá nastavená, ale prehliadač ju zahodí.
 */

import { describe, it, expect } from "vitest"
import { channels, soft, tenantStyle, accentVars, ACCENT_VARS } from "../src/components/TenantHeader"

describe("kanály farby", () => {
  it("prečíta dlhý aj krátky zápis", () => {
    expect(channels("#232a35")).toEqual([35, 42, 53])
    expect(channels("232a35")).toEqual([35, 42, 53])
    expect(channels("#abc")).toEqual([170, 187, 204])
  })

  it("nečitateľná hodnota je null, nie odhad", () => {
    expect(channels("modrá")).toBeNull()
    expect(channels("")).toBeNull()
    expect(channels("#12345")).toBeNull()
  })
})

describe("soft()", () => {
  it("dá rgba s 11 % alfou", () => {
    expect(soft("#232a35")).toBe("rgba(35, 42, 53, 0.11)")
  })

  it("alfa sa dá prebiť", () => {
    expect(soft("#232a35", 0.2)).toBe("rgba(35, 42, 53, 0.2)")
  })

  it("pri pokazenej farbe nevráti nič", () => {
    // Musí to byť `undefined`, nie reťazec: premenná sa vtedy nenastaví
    // a platí predvolená z `globals.css`. Pokazená hodnota by zahodila aj tú.
    expect(soft("modrá")).toBeUndefined()
  })
})

describe("tenantStyle()", () => {
  it("bez farby nenastaví nič", () => {
    expect(tenantStyle(undefined)).toEqual({})
    expect(tenantStyle({ displayName: "SFZ" })).toEqual({})
  })

  it("nastaví všetky štyri premenné", () => {
    const style = tenantStyle({ displayName: "SFZ", accentColor: "#1f4ed8" })
    expect(style).toEqual({
      "--accent": "#1f4ed8",
      // Koeficient stmavenia je 0.16 a zámerne sa nemení: iná hodnota by
      // potichu prekreslila hover stavy u všetkých existujúcich tenantov.
      "--accent-strong": "#1a42b5",
      "--on-accent": "#ffffff",
      "--accent-soft": "rgba(31, 78, 216, 0.11)",
    })
  })

  it("pokazená farba nezhodí vykreslenie a soft sa vynechá", () => {
    const style = tenantStyle({ displayName: "SFZ", accentColor: "modrá" })
    expect(style).toEqual({
      "--accent": "modrá",
      "--accent-strong": "modrá",
      "--on-accent": "#ffffff",
    })
    expect(style).not.toHaveProperty("--accent-soft")
  })
})

describe("accentVars()", () => {
  it("dá tie isté hodnoty ako tenantStyle — je to jeden výpočet", () => {
    // Živý náhľad v nastavení organizácie nastavuje premenné cez
    // `setProperty()`, obal stránky ich sype do `style`. Keby to boli dva
    // výpočty, náhľad by raz ukázal inú farbu, než sa uloží.
    expect(accentVars("#1f4ed8")).toEqual(tenantStyle({ displayName: "SFZ", accentColor: "#1f4ed8" }))
  })

  it("prázdna hodnota aj biele znaky znamenajú „nenastavovať nič“", () => {
    expect(accentVars(undefined)).toEqual({})
    expect(accentVars("")).toEqual({})
    expect(accentVars("   ")).toEqual({})
  })

  it("obstrihne biele znaky okolo hodnoty", () => {
    // Vlastnú hodnotu píše človek do poľa a medzera na konci je bežná —
    // `#1f4ed8 ` by prehliadač zahodil a farba by sa potichu nezmenila.
    expect(accentVars("  #1f4ed8  ")["--accent"]).toBe("#1f4ed8")
  })

  it("zoznam premenných pokrýva všetko, čo accentVars nastavuje", () => {
    // Podľa tohto zoznamu živý náhľad po sebe uklidí. Keby v ňom premenná
    // chýbala, zostala by na stránke aj po odchode z nastavenia.
    const keys = Object.keys(accentVars("#1f4ed8"))
    for (const k of keys) expect(ACCENT_VARS).toContain(k as (typeof ACCENT_VARS)[number])
    expect(keys).toHaveLength(ACCENT_VARS.length)
  })
})
