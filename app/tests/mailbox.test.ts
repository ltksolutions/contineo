/**
 * mailbox.test.ts — schranka cez adapter (ADR-028, D162).
 *
 * Cisty prevod spravy z Graphu na nas tvar: HTML → text, odchadzajuca podla
 * adresy schranky, odstrihnutie citovanej historie, bez obsahu priloh.
 */

import { describe, it, expect } from "vitest"
import { htmlToText, stripQuotedHistory } from "../src/lib/mailbox/types"
import { toMailMessage } from "../src/lib/mailbox/graph"

describe("htmlToText", () => {
  it("odstrani znacky, zachova odseky a entity", () => {
    expect(htmlToText("<div><p>Dobrý deň,</p><p>ako sa <b>registruje</b> hráč?<br>Ďakujem &amp; pekný deň</p><style>p{}</style></div>"))
      .toBe("Dobrý deň,\nako sa registruje hráč?\nĎakujem & pekný deň")
  })
})

describe("stripQuotedHistory", () => {
  it("odstrihne Od:/From: blok, 'On ... wrote:' aj riadky s >", () => {
    expect(stripQuotedHistory("Ďakujem za odpoveď.\n\nOd: Helpdesk SFZ\nOdoslané: pondelok\nPredmet: Re: hráč\n\nText odpovede")).toBe("Ďakujem za odpoveď.")
    expect(stripQuotedHistory("Thanks\n\nOn Mon, Jan 1 2026, Helpdesk wrote:\n> old\n> text")).toBe("Thanks")
    expect(stripQuotedHistory("Áno.\n> citát\nĎalší riadok")).toBe("Áno.\nĎalší riadok")
  })
})

describe("toMailMessage", () => {
  const raw = {
    id: "AAMk1", internetMessageId: "<abc@x>", conversationId: "conv1",
    from: { emailAddress: { address: "Manazer@Klub.sk", name: "Manažér" } },
    toRecipients: [{ emailAddress: { address: "helpdesk@futbalsfz.sk", name: "Helpdesk" } }],
    subject: "Registrácia", body: { contentType: "html", content: "<p>Otázka?</p>" },
    receivedDateTime: "2026-10-06T08:00:00Z", hasAttachments: true,
  }
  it("prichadzajuca sprava: text z HTML, adresy male, bez priloh", () => {
    const m = toMailMessage(raw, "helpdesk@futbalsfz.sk")
    expect(m.outgoing).toBe(false)
    expect(m.from).toEqual({ address: "manazer@klub.sk", name: "Manažér" })
    expect(m.text).toBe("Otázka?")
    expect(m.threadRef).toBe("conv1")
    expect(m.attachments).toEqual([])
    expect(m.receivedAt.toISOString()).toBe("2026-10-06T08:00:00.000Z")
  })
  it("sprava zo schranky kanala je odchadzajuca", () => {
    const m = toMailMessage({ ...raw, from: { emailAddress: { address: "HELPDESK@futbalsfz.sk" } } }, "helpdesk@futbalsfz.sk")
    expect(m.outgoing).toBe(true)
  })
  it("bez conversationId je vlaknom sama sprava", () => {
    expect(toMailMessage({ id: "x" }, "h@h.sk").threadRef).toBe("x")
  })
})
