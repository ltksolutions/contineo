/**
 * acknowledgements.test.ts — odvolanie potvrdenia (D24).
 *
 * Tri veci, ktoré sa tu nesmú pokaziť:
 *
 *  1. **odvoláva len personalista** — doklad, ktorý si podpísaný môže sám
 *     zobrať späť, nie je doklad;
 *  2. **platnosť je potvrdenia mínus odvolania** — jedno pravidlo pre všetkých
 *     sedem miest, ktoré potvrdenia čítajú;
 *  3. **poradie pokusu rastie** — po odvolaní sa musí dať potvrdiť znova, a to
 *     je jediné, čo to umožní popri unikátnom indexe.
 */

import { describe, it, expect } from "vitest"
import { revokeProblem, isAcknowledged, nextCycle } from "../src/lib/acknowledgements"

describe("kto smie odvolať potvrdenie", () => {
  it("personalista s dôvodom smie", () => {
    expect(revokeProblem({ isHr: true, valid: 1, reason: "potvrdené omylom, osoba text nečítala" })).toBe(null)
  })

  it("kto nie je personalista, nesmie — ani keď dôvod vyplní", () => {
    expect(revokeProblem({ isHr: false, valid: 1, reason: "potvrdil som omylom" })).toBe("revocation.notHr")
  })

  it("rola sa pýta skôr než stav", () => {
    // Kto nesmie konať, nemá sa dozvedieť ani to, či je čo odvolať. Preto
    // „nie si personalista“ a nie „nie je čo odvolať“.
    expect(revokeProblem({ isHr: false, valid: 0 })).toBe("revocation.notHr")
  })

  it("bez dôvodu sa neodvoláva", () => {
    expect(revokeProblem({ isHr: true, valid: 1 })).toBe("revocation.reasonRequired")
    expect(revokeProblem({ isHr: true, valid: 1, reason: "   " })).toBe("revocation.reasonRequired")
  })

  it("odvolať sa nedá to, čo neplatí", () => {
    expect(revokeProblem({ isHr: true, valid: 0, reason: "omyl" })).toBe("revocation.nothingToRevoke")
  })
})

describe("platnosť potvrdenia", () => {
  it("potvrdené a neodvolané platí", () => {
    expect(isAcknowledged({ acknowledgements: 1, revocations: 0 })).toBe(true)
  })

  it("odvolané neplatí", () => {
    expect(isAcknowledged({ acknowledgements: 1, revocations: 1 })).toBe(false)
  })

  it("po odvolaní a novom potvrdení platí zase", () => {
    // Toto je celý zmysel cyklov: povinnosť ožila a človek ju znova splnil.
    expect(isAcknowledged({ acknowledgements: 2, revocations: 1 })).toBe(true)
  })

  it("nepotvrdené neplatí", () => {
    expect(isAcknowledged({ acknowledgements: 0, revocations: 0 })).toBe(false)
  })
})

describe("poradie pokusu", () => {
  it("prvé potvrdenie je 1", () => {
    expect(nextCycle(0)).toBe(1)
  })

  it("po odvolaní je druhé potvrdenie 2", () => {
    // Dve súbežné kliknutia vypočítajú to isté číslo a druhé odmietne
    // databáza — ochrana proti dvojitému potvrdeniu tým zostáva.
    expect(nextCycle(1)).toBe(2)
  })
})
