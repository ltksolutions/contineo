/**
 * accessLevel.test.ts — únik interného obsahu sa ráta podľa toho, **komu**
 * sa odpovedalo, nie len podľa zdrojov.
 *
 * 28.–29. 9. 2026 hlásila tvrdá brána štyri úniky; všetky boli odpovede
 * prihláseným zamestnancom SFZ, ktorí interné vidieť smú. Testy strážia,
 * aby sa brána nevrátila ani k falošnému poplachu, ani k mlčaniu.
 */
import { describe, it, expect } from "vitest"
import { accessLevelFor, answerAccessLevel, isInternalLeak, isInternalSourceForInternal } from "../src/lib/accessLevel"
import type { OnboardingContext } from "../src/lib/session"

const internal = [{ accessLevel: "internal" }, { accessLevel: "public" }]
const onlyPublic = [{ accessLevel: "public" }]

describe("accessLevelFor", () => {
  it("prihlásená osoba organizácie = internal", () => {
    expect(accessLevelFor({ state: "ready" } as OnboardingContext)).toBe("internal")
  })

  it("ktokoľvek iný = public", () => {
    for (const state of ["unknown-host", "not-signed-in", "not-in-tenant"] as const) {
      expect(accessLevelFor({ state } as OnboardingContext)).toBe("public")
    }
  })
})

describe("isInternalLeak", () => {
  it("verejná odpoveď s interným zdrojom je únik", () => {
    expect(isInternalLeak({ askerAccessLevel: "public", askedBy: "p1", sources: internal })).toBe(true)
  })

  it("interná odpoveď s interným zdrojom únik nie je", () => {
    const r = { askerAccessLevel: "internal" as const, askedBy: "p1", sources: internal }
    expect(isInternalLeak(r)).toBe(false)
    expect(isInternalSourceForInternal(r)).toBe(true)
  })

  it("verejná odpoveď len z verejných zdrojov únik nie je", () => {
    expect(isInternalLeak({ askerAccessLevel: "public", sources: onlyPublic })).toBe(false)
  })

  it("starší záznam s osobou je interný", () => {
    expect(answerAccessLevel({ reviewer: "p1" })).toBe("internal")
    expect(isInternalLeak({ reviewer: "p1", sources: internal })).toBe(false)
  })

  it("starší záznam bez osoby sa berie ako verejný — brána radšej zhodí", () => {
    expect(isInternalLeak({ sources: internal })).toBe(true)
  })

  it("zapísaná úroveň má prednosť pred odvodením z osoby", () => {
    expect(answerAccessLevel({ askerAccessLevel: "public", askedBy: "p1" })).toBe("public")
  })
})
