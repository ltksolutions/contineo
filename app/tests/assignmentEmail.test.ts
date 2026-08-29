/**
 * assignmentEmail.test.ts — e-mail „bolo vám pridelené…" (Fáza 9 rozsah B).
 *
 * Testuje sa, čo môže spôsobiť škodu: chýbajúci dôvod (potom je to ďalšia
 * automatická správa, ktorú si ľudia odfiltrujú), obsah normy v schránke,
 * a rozsypané HTML kvôli ampersandu v názve.
 */

import { describe, it, expect } from "vitest"
import { assignmentEmail } from "../src/lib/ecomail"

const dokument = {
  title: "Súťažný poriadok futbalu SFZ",
  versionLabel: "1.0",
  effectiveFrom: "24. 6. 2026",
}
const DOVOD = "Novela čl. 12 — mení sa lehota na podanie odvolania."
const ODKAZ = "https://intranet.futbalsfz.sk/dokumenty/sfz%3Asutazny_poriadok"

function email(over: Partial<Parameters<typeof assignmentEmail>[2]> = {}, jazyk: "sk" | "cs" | "en" = "sk") {
  return assignmentEmail(ODKAZ, "intranet.futbalsfz.sk", { ...dokument, ...over }, DOVOD, jazyk, {
    displayName: "Slovenský futbalový zväz",
  })
}

describe("e-mail o pridelení", () => {
  it("nesie dôvod, ktorý napísal človek", () => {
    // Bez neho je to ďalšia automatická správa. S ním je to veta, z ktorej
    // sa dá pochopiť, či to treba čítať dnes alebo o týždeň (D30, D37).
    const e = email()
    expect(e.text).toContain(DOVOD)
    expect(e.html).toContain("lehota na podanie odvolania")
  })

  it("nesie názov, verziu aj platnosť", () => {
    const e = email()
    expect(e.text).toContain("Súťažný poriadok futbalu SFZ")
    expect(e.text).toContain("verzia 1.0")
    expect(e.text).toContain("24. 6. 2026")
  })

  it("odkaz vedie na dokument, nie na prihlásenie", () => {
    // Posielať prihlasovací odkaz by znamenalo vyrobiť druhý jednorazový
    // vstup do systému kvôli oznámeniu, ktoré nič nepotvrdzuje.
    const e = email()
    expect(e.text).toContain(ODKAZ)
    expect(e.html).toContain(`href="${ODKAZ}"`)
    expect(e.text).not.toContain("/prihlasenie")
  })

  it("predmet nesie organizáciu, nie názov softvéru", () => {
    // Človek zo zväzu dostane do schránky správu od zväzu.
    const e = email()
    expect(e.subject).toContain("Slovenský futbalový zväz")
    expect(e.subject).not.toContain("Contineo")
  })

  it("bez tenanta zostane značka dodávateľa, e-mail sa nerozsype", () => {
    const e = assignmentEmail(ODKAZ, "app.contineo.app", dokument, DOVOD, "sk")
    expect(e.subject).toContain("Contineo")
  })

  it("ampersand v názve nerozbije HTML", () => {
    // Názov píše človek. Nie je to obrana proti útoku, je to obrana proti
    // ampersandu v názve normy.
    const e = email({ title: "Pravidlá & poriadky <interné>" })
    expect(e.html).toContain("Pravidlá &amp; poriadky &lt;interné&gt;")
    expect(e.html).not.toContain("<interné>")
  })

  it("píše sa v jazyku príjemcu", () => {
    expect(email({}, "cs").text).toContain("Důvod")
    expect(email({}, "en").text).toContain("Reason")
    expect(email({}, "en").subject).toContain("New document to acknowledge")
  })

  it("neobsahuje obsah normy, len jej názov", () => {
    // Do schránky, ktorá môže byť súkromná alebo mimo našej správy, nepatrí
    // obsah interného predpisu.
    const e = email()
    expect(e.text.length).toBeLessThan(700)
  })

  it("chýbajúca platnosť sa nevydáva za dátum", () => {
    const e = email({ effectiveFrom: "—" })
    expect(e.text).toContain("platná od —")
  })
})
