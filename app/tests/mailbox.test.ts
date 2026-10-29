/**
 * mailbox.test.ts — schranka cez adapter (ADR-028, D162).
 *
 * Cisty prevod spravy z Graphu na nas tvar: HTML → text, odchadzajuca podla
 * adresy schranky, odstrihnutie citovanej historie, bez obsahu priloh.
 */

import { describe, it, expect, vi, afterEach } from "vitest"
import { htmlToText, stripQuotedHistory, splitQuotedHistory } from "../src/lib/mailbox/types"
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

describe("splitQuotedHistory", () => {
  it("historiu necha zvlast — odpoved spred synchronizacie nesie otazku len v citacii", () => {
    const mail = "Nech sa páči: jozko@example.sk\n\nOd: Helpdesk SFZ\nOdoslané: pondelok\nPredmet: RE: Zmena priezviska\n\nPošlite e-mail hráča.\n\nOd: Ján\nPredmet: Zmena priezviska\n\nAko zmeniť priezvisko hráča?"
    const r = splitQuotedHistory(mail)
    expect(r.text).toBe("Nech sa páči: jozko@example.sk")
    expect(r.quoted).toContain("Pošlite e-mail hráča.")
    expect(r.quoted).toContain("Ako zmeniť priezvisko hráča?")
    expect(r.quoted.startsWith("Od: Helpdesk SFZ")).toBe(true)
  })
  it("riadky s > idu do citacie, bez historie je citacia prazdna", () => {
    expect(splitQuotedHistory("Áno.\n> citát\nĎalší riadok")).toEqual({ text: "Áno.\nĎalší riadok", quoted: "> citát" })
    expect(splitQuotedHistory("Len otázka.")).toEqual({ text: "Len otázka.", quoted: "" })
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

describe("GraphMailbox.listNew", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("prve kolo sa pyta len na spravy od zaciatku synchronizacie, nie na celu schranku", async () => {
    const urls: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      return new Response(JSON.stringify({ value: [], "@odata.deltaLink": "https://graph.microsoft.com/delta?$deltatoken=x" }))
    }))
    const box = new GraphMailbox({ address: "helpdesk@futbalsfz.sk", tenantId: "t", clientId: "c", clientSecret: "s" })
    const page = await box.listNew(null, new Date("2026-10-07T13:40:12.345Z"))
    const delta = urls.find(u => u.includes("/messages/delta"))!
    expect(decodeURIComponent(delta)).toContain("$filter=receivedDateTime ge 2026-10-07T13:40:12Z")
    expect(page).toMatchObject({ messages: [], more: false, cursor: "https://graph.microsoft.com/delta?$deltatoken=x" })
  })

  it("so znackou ide priamo na nu, filter nesie znacka", async () => {
    const urls: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      return new Response(JSON.stringify({ value: [] }))
    }))
    const box = new GraphMailbox({ address: "helpdesk@futbalsfz.sk", tenantId: "t", clientId: "c", clientSecret: "s" })
    await box.listNew("https://graph.microsoft.com/delta?$deltatoken=x", new Date())
    expect(urls.filter(u => u.startsWith("https://graph.microsoft.com"))).toEqual(["https://graph.microsoft.com/delta?$deltatoken=x"])
  })
})

describe("ticket — citovana historia", () => {
  it("toTicketMessage ulozi citaciu zvlast a questionText ju da asistentovi ako kontext", async () => {
    const { toTicketMessage, questionText } = await import("../src/lib/tickets")
    const msg = toTicketMessage({
      id: "AAMk1", internetMessageId: "<a@x>", threadRef: "c1", from: { address: "jan@example.sk", name: "Ján" }, to: [],
      subject: "Re: Zmena priezviska", text: "Nech sa páči: jozko@example.sk\n\nOd: Helpdesk SFZ\nPredmet: Zmena priezviska\n\nAko zmeniť priezvisko hráča?",
      receivedAt: new Date("2026-10-07T10:00:00Z"), outgoing: false, attachments: [],
    })
    expect(msg.text).toBe("Nech sa páči: jozko@example.sk")
    expect(msg.quoted).toContain("Ako zmeniť priezvisko hráča?")
    const q = questionText({ subject: "Re: Zmena priezviska", messages: [msg] } as Parameters<typeof questionText>[0])
    expect(q).toContain("Nech sa páči: jozko@example.sk")
    expect(q).toContain("Ako zmeniť priezvisko hráča?")
  })

  it("bez citacie pole quoted nevznika", async () => {
    const { toTicketMessage } = await import("../src/lib/tickets")
    const msg = toTicketMessage({
      id: "x", internetMessageId: null, threadRef: "x", from: null, to: [], subject: "", text: "Otázka?",
      receivedAt: new Date(0), outgoing: false, attachments: [],
    })
    expect("quoted" in msg).toBe(false)
  })
})

describe("GraphMailbox.send a replyTo (ADR-042, D277)", () => {
  afterEach(() => vi.unstubAllGlobals())
  type Call = { url: string; method: string; prefer: string | null; body: unknown }
  function stub(sendStatus = 202): Call[] {
    const calls: Call[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      const h = new Headers(init?.headers)
      calls.push({ url, method: init?.method ?? "GET", prefer: h.get("prefer"), body: init?.body ? JSON.parse(String(init.body)) : null })
      if (url.endsWith("/send")) return new Response(null, { status: sendStatus })
      if (init?.method === "DELETE") return new Response(null, { status: 204 })
      return new Response(JSON.stringify({ id: "imm-1", internetMessageId: "<c1@x>", conversationId: "conv-w" }), { status: 201 })
    }))
    return calls
  }
  const box = () => new GraphMailbox({ address: "helpdesk@futbalsfz.sk", tenantId: "t", clientId: "c", clientSecret: "s" })

  it("send: koncept s nemenným identifikátorom, potom odoslanie; vráti vlákno", async () => {
    const calls = stub()
    await expect(box().send("rodic@example.sk", "Prijali sme", "Text")).resolves.toEqual({ messageId: "<c1@x>", threadRef: "conv-w", providerId: "imm-1" })
    expect(calls.map(c => `${c.method} ${c.url.replace(/^.*\/users\/[^/]+/, "")}`)).toEqual(["POST /messages", "POST /messages/imm-1/send"])
    expect(calls.every(c => c.prefer === 'IdType="ImmutableId"')).toBe(true)
    expect(calls[0].body).toMatchObject({ subject: "Prijali sme", toRecipients: [{ emailAddress: { address: "rodic@example.sk" } }] })
  })

  it("replyTo: createReply na vlastnú správu s výslovným adresátom", async () => {
    const calls = stub()
    await box().replyTo("imm-1", "rodic@example.sk", "Odpoveď.")
    expect(calls[0].url).toContain("/messages/imm-1/createReply")
    expect(calls[0].body).toEqual({ message: { toRecipients: [{ emailAddress: { address: "rodic@example.sk" } }], body: { contentType: "Text", content: "Odpoveď." } } })
    expect(calls[1].url).toContain("/messages/imm-1/send")
  })

  /** Schránka zúžená na Mail.Read + Mail.Send: koncept 403, priame akcie 202. */
  function stubNoDrafts(): Call[] {
    const calls: Call[] = []
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      calls.push({ url, method: init?.method ?? "GET", prefer: new Headers(init?.headers).get("prefer"), body: init?.body ? JSON.parse(String(init.body)) : null })
      if (url.endsWith("/sendMail") || url.endsWith("/reply")) return new Response(null, { status: 202 })
      return new Response(JSON.stringify({ error: { code: "ErrorAccessDenied", message: "Access is denied." } }), { status: 403 })
    }))
    return calls
  }

  it("bez Mail.ReadWrite: send odíde cez sendMail, bez vlákna (29. 10. 2026)", async () => {
    const calls = stubNoDrafts()
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(box().send("rodic@example.sk", "Re: otázka", "Text")).resolves.toEqual({ messageId: null, threadRef: null, providerId: null })
    expect(calls.map(c => c.url.replace(/^.*\/users\/[^/]+/, ""))).toEqual(["/messages", "/sendMail"])
    expect(calls[1].body).toMatchObject({ saveToSentItems: true, message: { subject: "Re: otázka", toRecipients: [{ emailAddress: { address: "rodic@example.sk" } }] } })
  })

  it("bez Mail.ReadWrite: replyTo odíde cez reply s výslovným adresátom", async () => {
    const calls = stubNoDrafts()
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(box().replyTo("imm-1", "rodic@example.sk", "Odpoveď.")).resolves.toEqual({ messageId: null, threadRef: null, providerId: null })
    expect(calls[1].url).toContain("/messages/imm-1/reply")
    expect(calls[1].body).toEqual({ message: { toRecipients: [{ emailAddress: { address: "rodic@example.sk" } }], body: { contentType: "Text", content: "Odpoveď." } } })
  })

  it("iná chyba konceptu než 403 sa nezahladí", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/token")
      ? new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }))
      : new Response("{}", { status: 404 })))
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(box().send("rodic@example.sk", "S", "T")).rejects.toMatchObject({ code: "mailbox.notFound" })
  })

  it("neodoslaný koncept sa zmaže a chyba ide ďalej", async () => {
    const calls = stub(500)
    vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(box().send("rodic@example.sk", "S", "T")).rejects.toBeTruthy()
    expect(calls.at(-1)).toMatchObject({ method: "DELETE" })
    expect(calls.at(-1)!.url).toContain("/messages/imm-1")
  })
})
