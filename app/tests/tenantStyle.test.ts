/**
 * tenantStyle.test.ts — CSS premenné farby organizácie.
 *
 * Farba tenanta je uložená v databáze, čiže **dáta**: môže byť prázdna,
 * skrátená na tri znaky alebo pokazená ručnou úpravou. Rozhranie sa musí
 * vykresliť vo všetkých troch prípadoch — a hlavne sa nesmie vykresliť
 * s premennou, ktorá vyzerá nastavená, ale prehliadač ju zahodí.
 */

import { describe, it, expect } from "vitest"
import { channels, soft, tenantStyle } from "../src/components/TenantHeader"

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
