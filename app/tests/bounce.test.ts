/**
 * bounce.test.ts — správy o nedoručení nie sú tickety (Ján 8. 10. 2026).
 * Skutočné tvary zo schránky helpdesku SFZ: `mailer-daemon@mailout.futbalsfz.sk`,
 * „Undelivered Mail Returned to Sender", Outlookom predsadené „Nedoručiteľné:".
 */

import { describe, it, expect } from "vitest"
import { isBounce, isAutoReply, isMachineMail } from "../src/lib/mailbox/bounce"

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

describe("automatická odpoveď o neprítomnosti (Ján 29. 10. 2026)", () => {
  it("rozpozná predponu v jazyku schránky", () => {
    for (const s of [
      "Automatische Antwort: ISSF Žiadosť o zmenu termínu",
      "Automatic reply: Re: Prestup hráča",
      "Automatická odpoveď: Re: Registračný preukaz",
      "Automatická odpověď: Dotaz",
      "Out of Office: Re: ISSF",
      "Abwesenheitsnotiz: Anfrage",
      "AutoReply: x",
    ]) expect(isAutoReply(msg("klub@example.sk", s)), s).toBe(true)
  })
  it("otázku človeka nechá tak", () => {
    expect(isAutoReply(msg("klub@example.sk", "Re: automatická odpoveď z ISSF nefunguje"))).toBe(false)
    expect(isAutoReply(msg("klub@example.sk", "Out of office request na zápas"))).toBe(false)
    expect(isAutoReply(msg("helpdesk@futbalsfz.sk", "Automatic reply: x", true))).toBe(false)
  })
  it("strojová pošta = návrat alebo automatická odpoveď", () => {
    expect(isMachineMail(msg("postmaster@x.sk", "Hocičo"))).toBe(true)
    expect(isMachineMail(msg("klub@example.sk", "Automatische Antwort: x"))).toBe(true)
    expect(isMachineMail(msg("klub@example.sk", "Prestup hráča"))).toBe(false)
  })
})
