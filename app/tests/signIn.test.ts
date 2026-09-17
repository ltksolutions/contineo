/**
 * signIn.test.ts — evidencia prihlásenia sa musí stihnúť zapísať.
 *
 * Regresný test na tichú chybu z 2026-08-28: `signIn` volal `recordSignIn`
 * bez `await` (`void recordSignIn(...)`). Na Verceli funkcia skončí hneď po
 * vrátení hodnoty a rozrobený zápis do Atlasu sa zahodí — človek sa prihlási,
 * ale `lastLoginAt` zostane prázdne a stav `invited`. Nikde to nezasvieti;
 * zistí sa to až vtedy, keď sa niekto spýta, kto sa už prihlásil.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

const { personMaySignIn, recordSignIn, hotovo: done } = vi.hoisted(() => {
  const done = { zapisane: false }
  return {
    hotovo: done,
    personMaySignIn: vi.fn(async (..._args: unknown[]) => true),
    // Atrapa dokončí zápis až na ďalšom kole slučky — presne ako skutočný
    // dotaz do databázy. Bez `await` sa `signIn` vráti skôr než sa to stane.
    recordSignIn: vi.fn(async (..._args: unknown[]) => {
      await new Promise(r => setTimeout(r, 0))
      done.zapisane = true
    }),
  }
})

vi.mock("../src/lib/persons", () => ({ personMaySignIn, recordSignIn }))
// Organizácia domény (D90). Mimo požiadavky nie je hostiteľ, takže sa podstrčí
// tenant priamo — test overuje evidenciu, nie rozlíšenie domény.
vi.mock("../src/lib/tenants", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/tenants")>()),
  resolveTenant: vi.fn(async () => ({ companyCode: "SFZ" })),
}))

import { authOptions } from "../src/lib/auth"

beforeEach(() => {
  personMaySignIn.mockClear()
  recordSignIn.mockClear()
  done.zapisane = false
})

function signIn(email: string, verificationRequest = false) {
  const cb = authOptions.callbacks?.signIn
  if (!cb) throw new Error("signIn callback chýba")
  return cb({ user: { id: "u1", email }, email: { verificationRequest } } as never)
}

describe("evidencia prihlásenia", () => {
  it("zápis je dokončený skôr, než sa prihlásenie vráti", async () => {
    const ok = await signIn("jan.letko@futbalsfz.sk")

    expect(ok).toBe(true)
    // Evidencia patrí osobe v organizácii domény (D90).
    expect(recordSignIn).toHaveBeenCalledWith("jan.letko@futbalsfz.sk", "SFZ")
    // Toto je celý zmysel súboru: `true` bez dokončeného zápisu je práve tá
    // chyba, ktorá sa na Verceli prejaví a lokálne nie.
    expect(done.zapisane).toBe(true)
  })

  it("kto neprejde bránou, sa do evidencie nedostane", async () => {
    personMaySignIn.mockResolvedValueOnce(false)

    const ok = await signIn("nikto@inde.sk")

    expect(ok).toBe(false)
    expect(recordSignIn).not.toHaveBeenCalled()
  })

  it("žiadosť o odkaz sa eviduje rovnako ako jeho použitie", async () => {
    // NextAuth volá `signIn` dvakrát — pri žiadosti aj pri kliknutí. Brána
    // musí platiť v oboch fázach, inak by odkaz dostal aj ten, kto naň
    // nemá nárok, a zistil by to až po kliknutí.
    await signIn("jan.letko@futbalsfz.sk", true)

    expect(personMaySignIn).toHaveBeenCalled()
  })

  it("prihlásenie bez adresy neprejde", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(await signIn("")).toBe(false)
    expect(personMaySignIn).not.toHaveBeenCalled()

    errors.mockRestore()
  })
})
