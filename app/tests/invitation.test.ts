/**
 * invitation.test.ts — komu sa ponúka pozvánka.
 *
 * Pravidlo, ktoré sa pokazí ticho a draho: keby sa kritérium na tlačidle
 * rozišlo s kritériom v `neverSignedIn()`, personalista by klikal na akciu,
 * ktorú server odmietne — alebo, horšie, posielal pozvánky ľuďom, ktorí už
 * dávno pracujú v systéme.
 */
import { describe, it, expect } from "vitest"
import { needsInvitation } from "../src/lib/personFields"

describe("kto potrebuje pozvánku", () => {
  it("pozvaná a ešte nikdy neprihlásená áno", () => {
    expect(needsInvitation({ status: "invited" })).toBe(true)
  })

  it("kto už raz bol dnu, nie", () => {
    // Aj keď stav ostal `invited` — rozhoduje prvé prihlásenie, nie stav.
    expect(needsInvitation({ status: "invited", firstLoginAt: new Date() })).toBe(false)
    expect(needsInvitation({ status: "active", firstLoginAt: new Date() })).toBe(false)
  })

  it("aktívna osoba z importu áno — pozvánku nikdy nedostala", () => {
    // D47: osoby z importu a zo samozaloženia majú `active` od začiatku,
    // takže podľa stavu by vypadli, hoci sú presne tí, koho treba osloviť.
    expect(needsInvitation({ status: "active" })).toBe(true)
  })

  it("vyradená nie, nech je akokoľvek neprihlásená", () => {
    // Pozvánka niekomu, kto v organizácii už nie je, je horšia než žiadna.
    expect(needsInvitation({ status: "inactive" })).toBe(false)
  })
})
