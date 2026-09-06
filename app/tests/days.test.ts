/**
 * days.test.ts — skloňovanie dní v hláseniach o meškaní.
 *
 * Vzniklo z chyby, ktorú vidno len na obrazovke: „nepotvrdené dlhšie než
 * 1 dní". Slovenčina aj čeština majú tri tvary a v kóde ich nikto nevidí,
 * lebo predvolený prah je 14 — teda práve ten tvar, ktorý je správny.
 */
import { describe, it, expect } from "vitest"
import { dictionary } from "../src/lib/i18n"

describe("dni v hlaseniach o meskani", () => {
  it("slovencina ma tri tvary", () => {
    const t = dictionary("sk").hr.reminders
    expect(t.none(1)).toContain("1 deň")
    expect(t.none(2)).toContain("2 dni")
    expect(t.none(4)).toContain("4 dni")
    expect(t.none(5)).toContain("5 dní")
    expect(t.none(14)).toContain("14 dní")
  })

  it("cestina ma tri tvary", () => {
    const t = dictionary("cs").hr.reminders
    expect(t.none(1)).toContain("1 den")
    expect(t.none(3)).toContain("3 dny")
    expect(t.none(14)).toContain("14 dní")
  })

  it("anglictina ma dva", () => {
    const t = dictionary("en").hr.reminders
    expect(t.none(1)).toContain("1 day")
    expect(t.none(2)).toContain("2 days")
  })

  it("riadok v e-maile sklonuje rovnako", () => {
    expect(dictionary("sk").reminderEmail.itemLine("1.0", 1)).toContain("1 deň")
    expect(dictionary("sk").reminderEmail.itemLine("1.0", 3)).toContain("3 dni")
    expect(dictionary("cs").reminderEmail.itemLine("1.0", 1)).toContain("1 den")
  })

  it("druhy riadok pri osobe tiez", () => {
    expect(dictionary("sk").hr.reminders.person(1, 1)).toContain("1 deň")
    expect(dictionary("sk").hr.reminders.person(1, 8)).toContain("8 dní")
  })

  it("ziadny jazyk nenecha holé cislo pri slove den", () => {
    // Poistka proti tomu, ze niekto prida jazyk a na tvary zabudne.
    for (const language of ["sk", "cs", "en"] as const) {
      const text = dictionary(language).hr.reminders.none(1)
      expect(text, language).not.toMatch(/1 (dní|dny|days)\b/)
    }
  })
})
