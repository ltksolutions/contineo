/**
 * mailbox.test.ts — schranka cez adapter (ADR-028, D162).
 *
 * Cisty prevod spravy z Graphu na nas tvar: HTML → text, odchadzajuca podla
 * adresy schranky, odstrihnutie citovanej historie, bez obsahu priloh.
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import { htmlToText, stripQuotedHistory } from "../src/lib/mailbox/types"
import { toMailMessage, GraphMailbox } from "../src/lib/mailbox/graph"

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

describe("GraphMailbox.verify", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("cita len priecinok Dorucene, nie profil pouzivatela (zuzena aplikacia nema User.Read.All)", async () => {
    const urls: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes("/oauth2/v2.0/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      if (url.includes("/mailFolders/inbox")) return new Response(JSON.stringify({ id: "inbox", displayName: "Doručená pošta" }))
      return new Response(JSON.stringify({ error: { code: "Authorization_RequestDenied" } }), { status: 403 })
    }))
    const box = new GraphMailbox({ address: "Helpdesk@futbalsfz.sk", tenantId: "t", clientId: "c", clientSecret: "s" })
    await expect(box.verify()).resolves.toEqual({ address: "helpdesk@futbalsfz.sk", displayName: null })
    const graph = urls.filter(u => u.startsWith("https://graph.microsoft.com"))
    expect(graph).toHaveLength(1)
    expect(graph[0]).toContain("/users/helpdesk%40futbalsfz.sk/mailFolders/inbox")
  })

  it("403 na schranke je mailbox.forbidden", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/token")
      ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      : new Response(JSON.stringify({ error: { code: "ErrorAccessDenied" } }), { status: 403 })))
    vi.spyOn(console, "error").mockImplementation(() => {})
    const box = new GraphMailbox({ address: "helpdesk@futbalsfz.sk", tenantId: "t", clientId: "c", clientSecret: "s" })
    await expect(box.verify()).rejects.toMatchObject({ code: "mailbox.forbidden" })
  })
})
