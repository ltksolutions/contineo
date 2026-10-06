/**
 * tickets.test.ts — ticket helpdesku (ADR-028, D163).
 *
 * Ciste casti: sprava zo schranky → sprava ticketu (bez citovanej historie),
 * text otazky pre navrh, posledna prichadzajuca sprava, predvyplnenie FAQ
 * z odoslanej odpovede (bez duplicitnych zdrojov, s povodom).
 */

import { describe, it, expect, vi } from "vitest"

vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn() }))

import { toTicketMessage, questionText, lastIncoming, faqPrefillFromTicket, OPEN_STATES, type Ticket } from "../src/lib/tickets"

const at = (h: number) => new Date(`2026-10-06T0${h}:00:00Z`)
const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  companyCode: "SFZ", channelKey: "issf", source: "email", threadRef: "conv1",
  asker: { personId: null, email: "a@klub.sk", name: "Anna", roles: ["klubový manažér"], club: null },
  subject: "Re: Registrácia hráča",
  messages: [
    { internetMessageId: "<1>", providerId: "p1", direction: "in", from: { address: "a@klub.sk", name: "Anna" }, subject: "Registrácia hráča", text: "Ako registrovať hráča?", at: at(1), attachments: [] },
    { internetMessageId: null, providerId: "sent:1", direction: "out", from: null, subject: "Re", text: "Cez ISSF.", at: at(2), attachments: [] },
    { internetMessageId: "<3>", providerId: "p3", direction: "in", from: { address: "a@klub.sk", name: "Anna" }, subject: "Re", text: "A čo maloletý?", at: at(3), attachments: [] },
  ],
  state: "sent", assigneeId: null,
  draft: { text: "Návrh.", sources: [{ documentId: "sfz:rp", title: "RP", articleRef: "čl. 12" }, { documentId: "sfz:rp", articleRef: "čl. 12" }, { documentId: "sfz:faq", articleRef: null }], model: "m", at: at(2) },
  sentAnswer: { text: "Cez ISSF, maloletý so súhlasom rodiča.", by: "h@sfz.sk", at: at(2), messageId: null },
  createdAt: at(1), updatedAt: at(3), closedAt: null, ...over,
})

describe("toTicketMessage", () => {
  it("odstrihne citovanu historiu a nenesie obsah priloh", () => {
    const m = toTicketMessage({
      id: "x", internetMessageId: "<x>", threadRef: "t", from: { address: "a@b.sk", name: null }, to: [],
      subject: "S", text: "Odpoveď.\n\nOd: Niekto\nOdoslané: včera\n\nstarý text", receivedAt: at(1), outgoing: false, attachments: [{ name: "doklad.pdf", bytes: 10 }],
    })
    expect(m.text).toBe("Odpoveď.")
    expect(m.direction).toBe("in")
    expect(m.attachments).toEqual([{ name: "doklad.pdf", bytes: 10 }])
  })
})

describe("otazka a posledna sprava", () => {
  it("text otazky sklada predmet a vsetky prichadzajuce spravy", () => {
    expect(questionText(ticket())).toBe("Predmet: Re: Registrácia hráča\n\nAko registrovať hráča?\n\nA čo maloletý?")
  })
  it("odpoveda sa na poslednu prichadzajucu, nie na vlastnu odoslanu", () => {
    expect(lastIncoming(ticket())?.providerId).toBe("p3")
    expect(lastIncoming(ticket({ messages: [] }))).toBeNull()
  })
  it("otvorene stavy", () => {
    expect(OPEN_STATES).toEqual(["new", "drafted", "reopened"])
  })
})

describe("faqPrefillFromTicket", () => {
  it("otazka bez Re:, odpoved z odoslaneho textu, zdroje bez duplicit, povod s messageId", () => {
    const p = faqPrefillFromTicket(ticket())
    expect(p.question).toBe("Registrácia hráča")
    expect(p.answer).toBe("Cez ISSF, maloletý so súhlasom rodiča.")
    expect(p.sources).toEqual([{ documentId: "sfz:rp", articleRef: "čl. 12" }, { documentId: "sfz:faq", articleRef: null }])
    expect(p.origin).toEqual({ channelKey: "issf", threadRefs: ["conv1"], messageIds: ["<1>", "sent:1", "<3>"] })
  })
  it("bez odoslanej odpovede berie navrh; bez predmetu prvy riadok spravy", () => {
    const p = faqPrefillFromTicket(ticket({ sentAnswer: null, subject: "" }))
    expect(p.answer).toBe("Návrh.")
    expect(p.question).toBe("Ako registrovať hráča?")
  })
})
