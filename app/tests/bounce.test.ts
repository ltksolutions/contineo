/**
 * bounce.test.ts — správy o nedoručení nie sú tickety (Ján 8. 10. 2026).
 * Skutočné tvary zo schránky helpdesku SFZ: `mailer-daemon@mailout.futbalsfz.sk`,
 * „Undelivered Mail Returned to Sender", Outlookom predsadené „Nedoručiteľné:".
 */

import { describe, it, expect } from "vitest"
import { isBounce } from "../src/lib/mailbox/bounce"

const msg = (address: string, subject: string, outgoing = false) => ({ from: { address, name: null }, subject, outgoing })

describe("návrat od poštového servera", () => {
  it("rozpozná odosielateľa", () => {
    expect(isBounce(msg("mailer-daemon@mailout.futbalsfz.sk", "Hocičo"))).toBe(true)
    expect(isBounce(msg("postmaster@futbalsfz.sk", "Hocičo"))).toBe(true)
    expect(isBounce(msg("MicrosoftExchange329e71ec88ae4615bbc36ab6ce41109e@futbalsfz.sk", "x"))).toBe(true)
  })
  it("rozpozná predmet aj s predponou Outlooku", () => {
    expect(isBounce(msg("noreply@x.sk", "Nedoručiteľné: ISSF Uznesenie na komisiu"))).toBe(true)
    expect(isBounce(msg("noreply@x.sk", "Undelivered Mail Returned to Sender"))).toBe(true)
    expect(isBounce(msg("noreply@x.sk", "Delivery Status Notification (Failure)"))).toBe(true)
  })
  it("otázka človeka ani odchádzajúca odpoveď návratom nie je", () => {
    expect(isBounce(msg("hrac@gmail.com", "Nemôžem sa prihlásiť do ISSF"))).toBe(false)
    expect(isBounce(msg("hrac@gmail.com", "Re: nedoručiteľné heslo?"))).toBe(false)
    expect(isBounce(msg("mailer-daemon@x.sk", "Undelivered", true))).toBe(false)
  })
})
