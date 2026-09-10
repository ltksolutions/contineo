/**
 * approvalEmail.test.ts — e-mail „znenie čaká na vaše rozhodnutie" (ADR-006).
 *
 * Testuje sa to, čo môže spôsobiť škodu: chýbajúce meno predkladateľa (potom
 * je to anonymná automatická správa, ktorú si človek odfiltruje), poznámka,
 * ktorá tam nemá byť, keď ju predkladateľ nenapísal, a rozsypané HTML kvôli
 * ampersandu v názve dokumentu.
 */

import { describe, it, expect } from "vitest"
import { approvalEmail } from "../src/lib/ecomail"

const version = { title: "Súťažný poriadok futbalu SFZ", versionLabel: "4.2", effectiveFrom: "1. 1. 2027" }
const LINK = "https://intranet.futbalsfz.sk/approvals"
const BY = "marek.horak@futbalsfz.sk"

function email(note = "Upravený článok 4.", language: "sk" | "cs" | "en" = "sk") {
  return approvalEmail(LINK, "intranet.futbalsfz.sk", version, BY, note, language, {
    displayName: "Slovenský futbalový zväz",
  })
}

describe("e-mail o predložení na schválenie", () => {
  it("hovorí, kto znenie predložil", () => {
    // Anonymné „znenie čaká na schválenie" je ďalšia automatická správa.
    // S menom je to prosba od konkrétneho človeka.
    const e = email()
    expect(e.text).toContain(BY)
    expect(e.html).toContain(BY)
  })

  it("nesie označenie znenia aj dátum účinnosti", () => {
    // Schvaľuje sa konkrétne znenie (D68) a účinnosť je iná os než schválenie
    // (D73) — z e-mailu musí byť vidieť oboje.
    const e = email()
    expect(e.text).toContain("4.2")
    expect(e.text).toContain("1. 1. 2027")
  })

  it("odkaz vedie na zoznam, nie na jedno kolo", () => {
    // Kto má pred sebou tri znenia, potrebuje jedno miesto, nie tri odkazy.
    expect(email().text).toContain("/approvals")
  })

  it("bez poznámky sa nadpis poznámky neukáže", () => {
    // Prázdny nadpis nad prázdnym miestom vyzerá ako chyba šablóny.
    const s = email("")
    expect(s.text).not.toContain("Čo sa v znení mení")
    expect(s.html).not.toContain("Čo sa v znení mení")
    expect(email().html).toContain("Čo sa v znení mení")
  })

  it("ampersand v názve nerozsype HTML", () => {
    const e = approvalEmail(LINK, "host", { ...version, title: "Práva & povinnosti" }, BY, "", "sk")
    expect(e.html).toContain("Práva &amp; povinnosti")
    expect(e.html).not.toContain("Práva & povinnosti")
  })

  it("predmet je v jazyku príjemcu", () => {
    expect(email("", "sk").subject).toContain("schválenie")
    expect(email("", "cs").subject).toContain("schválení")
    expect(email("", "en").subject).toContain("approve")
  })
})
