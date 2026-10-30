/**
 * mailForward.test.ts — e-mail preposlaný kolegom na helpdesk (Jan 30. 10. 2026).
 *
 * Pytajucim sa je povodny odosielatel z hlavicky preposlanej spravy, len ked
 * preposiela adresa z domeny schranky a povodny odosielatel je mimo nej.
 * Udaje su vymyslene.
 */

import { describe, it, expect } from "vitest"
import { forwardedSender } from "../src/lib/mailbox/forward"
import type { MailMessage } from "../src/lib/mailbox/types"

const MAILBOX = "helpdesk@futbalsfz.sk"
const mail = (over: Partial<MailMessage>): MailMessage => ({
  id: "m", internetMessageId: null, threadRef: "t", from: { address: "kolega@futbalsfz.sk", name: "Kolega SFZ" }, to: [],
  subject: "Fwd: Nefunkčné prihlásenie", text: "Prosím o vybavenie.\n\nOd: Jana Vzorová <jana.vzorova@example.com>\nPredmet: Nefunkčné prihlásenie\n\nDobrý deň, neviem sa prihlásiť.",
  receivedAt: new Date("2026-10-30T08:00:00Z"), outgoing: false, attachments: [], ...over,
})

describe("forwardedSender", () => {
  it("Apple Mail: Od: Meno <adresa>", () => {
    expect(forwardedSender(mail({}), MAILBOX)).toEqual({ address: "jana.vzorova@example.com", name: "Jana Vzorová" })
  })
  it("Outlook do textu: <adresa<mailto:adresa>> bez mena", () => {
    const text = "---------- Forwarded message ---------\nFrom: <Klub.Vzor@Example.com<mailto:Klub.Vzor@Example.com>>\nDate: 8. 10. 2026"
    expect(forwardedSender(mail({ subject: "FW: Žiadosť", text }), MAILBOX)).toEqual({ address: "klub.vzor@example.com", name: null })
  })
  it("Outlook: tučné From: a Meno [mailto:adresa]", () => {
    const text = "Pozri.\n**From:** Peter Príklad [mailto:peter@example.org]\nSent: Thursday"
    expect(forwardedSender(mail({ subject: "WG: Frage", text }), MAILBOX)).toEqual({ address: "peter@example.org", name: "Peter Príklad" })
  })
  it("bez predpony preposlania nič — kolega sa pýta sám", () => {
    expect(forwardedSender(mail({ subject: "Nefunkčné prihlásenie" }), MAILBOX)).toBeNull()
  })
  it("človek zvonku, ktorý prepošle systémový e-mail ISSF, ostáva pýtajúcim sa", () => {
    const text = "Čo s tým?\n\nOd: <issf@futbalsfz.sk<mailto:issf@futbalsfz.sk>>\nSubject: ISSF Žiadosť"
    expect(forwardedSender(mail({ from: { address: "rodic@example.com", name: "Rodič" }, text }), MAILBOX)).toBeNull()
  })
  it("kolega prepošle systémový e-mail z vlastnej domény — nič", () => {
    const text = "Od: <issf@futbalsfz.sk<mailto:issf@futbalsfz.sk>>\nSubject: ISSF Žiadosť"
    expect(forwardedSender(mail({ text }), MAILBOX)).toBeNull()
  })
  it("odchádzajúca správa ani preposlanie bez hlavičky nič", () => {
    expect(forwardedSender(mail({ outgoing: true }), MAILBOX)).toBeNull()
    expect(forwardedSender(mail({ text: "Len text bez hlavičky." }), MAILBOX)).toBeNull()
  })
})
