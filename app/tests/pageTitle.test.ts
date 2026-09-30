/**
 * pageTitle.test.ts — názov v záložke „{stránka} · {organizácia}"
 * (ASK-otazka-z-hlavicky, Q4).
 */

import { describe, it, expect } from "vitest"
import { pageTitle } from "../src/lib/pageTitle"
import { dictionary } from "../src/lib/i18n"

const t = dictionary("sk")

describe("názov v záložke", () => {
  it("Prehľad na domove", () => {
    expect(pageTitle("/", "Intranet SFZ", t)).toBe("Prehľad · Intranet SFZ")
  })

  it("sekcia a jej podstránka nesú názov sekcie", () => {
    expect(pageTitle("/ask", "Intranet SFZ", t)).toBe(`${t.nav.ask} · Intranet SFZ`)
    expect(pageTitle("/hr/assign", "Intranet SFZ", t)).toBe(`${t.nav.assigned} · Intranet SFZ`)
    expect(pageTitle("/library/sfz:stanovy", "Intranet SFZ", t)).toBe(`${t.nav.library} · Intranet SFZ`)
  })

  it("bez adresy alebo mimo sekcií len organizácia", () => {
    expect(pageTitle(null, "Intranet SFZ", t)).toBe("Intranet SFZ")
    expect(pageTitle("/notifications", "Intranet SFZ", t)).toBe("Intranet SFZ")
  })

  it("Viac má vlastný názov", () => {
    expect(pageTitle("/more", "Intranet SFZ", t)).toBe(`${t.nav.more} · Intranet SFZ`)
  })

  it("v záložke nikdy nie je testovacie rozhranie", () => {
    expect(pageTitle("/", "Intranet SFZ", t)).not.toMatch(/testovacie/)
    expect(t.home.metaTitle).not.toMatch(/testovacie/)
  })
})
