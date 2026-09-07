/**
 * libraryProgress.test.ts — percento potvrdení.
 *
 * Číslo, ktoré človek na detaile uvidí ako prvé. Testuje sa zaokrúhľovanie
 * a hranice — delenie nulou a hodnoty, pri ktorých by „100 %" klamalo.
 */

import { describe, it, expect } from "vitest"
import { percentOf, EMPTY_PROGRESS } from "../src/lib/libraryProgress"

describe("percento potvrdení", () => {
  it("počíta z pridelených, nie z celej organizácie", () => {
    expect(percentOf(142, 210)).toBe(67)
    expect(percentOf(1, 2)).toBe(50)
  })

  it("zaokrúhľuje dole — sto percent znamená všetci", () => {
    // 199 z 200 je 99,5 %. Zaokrúhliť to na 100 % by znamenalo tvrdiť, že
    // potvrdili všetci, pritom jedného ešte treba osloviť — a pri dôkaznom
    // zázname je ten jeden dôvod, prečo sa to celé robí.
    expect(percentOf(199, 200)).toBe(99)
    expect(percentOf(200, 200)).toBe(100)
  })

  it("bez pridelených nie je percento, ale nič", () => {
    // Nula percent by tvrdila, že nikto nepotvrdil. Pravda je, že nebolo
    // komu prideliť — to je iná veta a na obrazovke aj inak vyzerá.
    expect(percentOf(0, 0)).toBeNull()
    expect(percentOf(5, 0)).toBeNull()
    expect(EMPTY_PROGRESS.percent).toBeNull()
  })

  it("viac potvrdení než pridelených nepretečie cez sto", () => {
    // Stať sa to môže: človek potvrdil a potom odišiel z oddelenia, ktorému
    // bolo znenie pridelené. 105 % by vyzeralo ako chyba výpočtu.
    expect(percentOf(12, 10)).toBe(100)
  })
})
