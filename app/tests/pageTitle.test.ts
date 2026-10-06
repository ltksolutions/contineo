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
    // Záložky HR nesú vlastný názov (ZAKLAD-podmenu-a-akcie).
    expect(pageTitle("/hr/overview", "Intranet SFZ", t)).toBe("Výkaz potvrdení · Intranet SFZ")
    expect(pageTitle("/hr/reminders", "Intranet SFZ", t)).toBe("Pripomienky · Intranet SFZ")
    expect(pageTitle("/hr", "Intranet SFZ", t)).toBe(`${t.nav.assigned} · Intranet SFZ`)
    expect(pageTitle("/library/sfz:stanovy", "Intranet SFZ", t)).toBe(`${t.nav.library} · Intranet SFZ`)
  })

  it("bez adresy len organizácia", () => {
    expect(pageTitle(null, "Intranet SFZ", t)).toBe("Intranet SFZ")
  })

  // Do 6. 10. 2026 mali stránky mimo sekcií menu v karte len organizáciu —
  // desať kariet „Intranet SFZ" sa nedalo rozlíšiť (Ján, 6. 10. 2026).
  it("stránky mimo sekcií menu majú vlastný názov", () => {
    expect(pageTitle("/notifications", "Intranet SFZ", t)).toBe("Upozornenia · Intranet SFZ")
    expect(pageTitle("/acknowledgements", "Intranet SFZ", t)).toBe("Moje potvrdenia · Intranet SFZ")
    expect(pageTitle("/organisation/signin", "Intranet SFZ", t)).toBe("Prihlasovanie · Intranet SFZ")
    expect(pageTitle("/privacy", "Intranet SFZ", t)).toBe("Ochrana osobných údajov · Intranet SFZ")
  })

  it("Menu má vlastný názov", () => {
    expect(pageTitle("/more", "Intranet SFZ", t)).toBe(`${t.nav.menu} · Intranet SFZ`)
  })

  it("v záložke nikdy nie je testovacie rozhranie", () => {
    expect(pageTitle("/", "Intranet SFZ", t)).not.toMatch(/testovacie/)
    expect(t.home.metaTitle).not.toMatch(/testovacie/)
  })
})
