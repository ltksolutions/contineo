/**
 * ticketsIngest.test.ts — synchronizacia schranky do ticketov (ADR-028, D163).
 *
 * Odpovede z Outlooku (priecinok Odoslane) sa pripoja a ticket zodpovedia,
 * kopia odpovede z Continea sa neprida druhykrat, novy ticket si dotiahne
 * historiu vlakna a jej zlyhanie ticket nezastavi.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { ObjectId } from "mongodb"
import type { MailMessage } from "../src/lib/mailbox/types"

type Doc = Record<string, unknown> & { _id: ObjectId }
const store: Doc[] = []

function setPath(doc: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".")
  let cur: Record<string, unknown> | unknown[] = doc
  for (const p of parts.slice(0, -1)) cur = (cur as Record<string, unknown>)[p] as Record<string, unknown>
  ;(cur as Record<string, unknown>)[parts.at(-1)!] = value
}
function matches(d: Doc, q: Record<string, unknown>) {
  return Object.entries(q).every(([k, v]) => {
    if (k === "_id") return String(d._id) === String(v)
    if (v && typeof v === "object" && "$in" in v) return (v.$in as unknown[]).includes(d[k])
    return d[k] === v
  })
}
const fake = {
  findOne: async (q: Record<string, unknown>) => store.find(d => matches(d, q)) ?? null,
  insertOne: async (doc: Record<string, unknown>) => { const _id = new ObjectId(); store.push({ ...structuredClone(doc), _id }); return { insertedId: _id } },
  updateOne: async (q: Record<string, unknown>, u: { $set?: Record<string, unknown>; $push?: Record<string, unknown> }) => {
    const d = store.find(x => matches(x, q))
    if (!d) return
    for (const [k, v] of Object.entries(u.$set ?? {})) setPath(d, k, v)
    for (const [k, v] of Object.entries(u.$push ?? {})) (d[k] as unknown[]).push(v)
  },
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => fake) }))
vi.mock("../src/lib/audit", () => ({ writeAudit: vi.fn(async () => {}) }))

const { ingestMessages, importTicketThread, answerRoute } = await import("../src/lib/tickets")

const at = (h: number) => new Date(`2026-10-07T${String(h).padStart(2, "0")}:00:00Z`)
const mail = (over: Partial<MailMessage>): MailMessage => ({
  id: "m", internetMessageId: null, threadRef: "conv1", from: { address: "klub@example.sk", name: "Klub" }, to: [],
  subject: "Zmena priezviska", text: "Ako zmeniť priezvisko hráča?", receivedAt: at(9), outgoing: false, attachments: [], ...over,
})
const helpdesk = { address: "helpdesk@futbalsfz.sk", name: "Helpdesk SFZ" }
type T = { state: string; messages: { providerId: string; direction: string; text: string; internetMessageId: string | null }[]; sentAnswer: { text: string; by: string } | null }
const only = () => store[0] as unknown as T

beforeEach(() => { store.length = 0 })

describe("ingestMessages — odoslana posta", () => {
  it("odpoved z Outlooku po otazke sa pripoji a ticket je zodpovedany", async () => {
    await ingestMessages("SFZ", "k", [mail({ id: "in1", internetMessageId: "<in1>" })])
    const r = await ingestMessages("SFZ", "k", [mail({ id: "out1", internetMessageId: "<out1>", outgoing: true, from: helpdesk, text: "Pošlite rodný list.\n\nOd: Klub\nAko zmeniť priezvisko hráča?", receivedAt: at(10) })])
    expect(r).toEqual({ created: 0, appended: 1, skipped: 0 })
    expect(only().state).toBe("sent")
    expect(only().sentAnswer).toMatchObject({ text: "Pošlite rodný list.", by: "helpdesk@futbalsfz.sk" })
    expect(only().messages.map(m => m.direction)).toEqual(["in", "out"])
  })

  it("kopia odpovede z Continea z Odoslanych sa neprida druhykrat, len si vezme identitu", async () => {
    await ingestMessages("SFZ", "k", [mail({ id: "in1", internetMessageId: "<in1>" })])
    only().messages.push({ internetMessageId: null, providerId: "sent:1", direction: "out", text: "Pošlite  rodný list.", from: null, subject: "", at: at(10), attachments: [] } as never)
    only().state = "sent"
    const r = await ingestMessages("SFZ", "k", [mail({ id: "out1", internetMessageId: "<out1>", outgoing: true, from: helpdesk, text: "Pošlite rodný list.\n\nFrom: Klub\nstaré", receivedAt: at(10) })])
    expect(r.skipped).toBe(1)
    expect(only().messages).toHaveLength(2)
    expect(only().messages[1]).toMatchObject({ providerId: "out1", internetMessageId: "<out1>" })
  })

  it("kopia HTML e-mailu sa sparuje s Markdownom v tickete (Jan 29. 10. 2026)", async () => {
    await ingestMessages("SFZ", "k", [mail({ id: "in1", internetMessageId: "<in1>" })])
    const markdown = "Dobrý deň,\n\n**Postup**\n\n1. Pošlite [rodný list](/documents/abc).\n\n3. Počkajte na potvrdenie.\n\nS pozdravom"
    only().messages.push({ internetMessageId: null, providerId: "sent:1", direction: "out", text: markdown, from: null, subject: "", at: at(10), attachments: [] } as never)
    only().state = "sent"
    // Tak ju vráti Graph: bez značiek, odkaz len textom, zoznam od 1, iné medzery.
    const copy = "Dobrý deň,\n\nPostup\n\n  1.  Pošlite rodný list.\n\n  1.  Počkajte na potvrdenie.\n\nS pozdravom"
    const r = await ingestMessages("SFZ", "k", [mail({ id: "out1", internetMessageId: "<out1>", outgoing: true, from: helpdesk, text: copy, receivedAt: at(10) })])
    expect(r.skipped).toBe(1)
    expect(only().messages).toHaveLength(2)
    expect(only().messages[1]).toMatchObject({ providerId: "out1", text: markdown })
  })

  it("ina odpoved sa nesparuje", async () => {
    await ingestMessages("SFZ", "k", [mail({ id: "in1", internetMessageId: "<in1>" })])
    only().messages.push({ internetMessageId: null, providerId: "sent:1", direction: "out", text: "Pošlite rodný list.", from: null, subject: "", at: at(10), attachments: [] } as never)
    await ingestMessages("SFZ", "k", [mail({ id: "out2", internetMessageId: "<out2>", outgoing: true, from: helpdesk, text: "Pošlite výpis z matriky.", receivedAt: at(11) })])
    expect(only().messages).toHaveLength(3)
  })

  it("odoslana bez ticketu ticket nezaklada", async () => {
    const r = await ingestMessages("SFZ", "k", [mail({ id: "out1", outgoing: true, from: helpdesk })])
    expect(r).toEqual({ created: 0, appended: 0, skipped: 1 })
    expect(store).toHaveLength(0)
  })
})

describe("ingestMessages — historia vlakna", () => {
  const history = [
    mail({ id: "old1", internetMessageId: "<old1>", text: "Ako zmeniť priezvisko hráča reg. č. 1?", receivedAt: at(7) }),
    mail({ id: "old2", internetMessageId: "<old2>", outgoing: true, from: helpdesk, text: "Pošlite e-mail hráča.", receivedAt: at(8) }),
  ]
  const fresh = mail({ id: "in3", internetMessageId: "<in3>", text: "Nech sa páči: jozko@example.sk", receivedAt: at(9) })

  it("novy ticket si dotiahne skorsie spravy vlakna, zoradene, bez duplicity a bez zmeny stavu", async () => {
    const thread = vi.fn(async () => [...history, fresh])
    const r = await ingestMessages("SFZ", "k", [fresh], { thread })
    expect(thread).toHaveBeenCalledWith("conv1")
    expect(r).toEqual({ created: 1, appended: 2, skipped: 0 })
    expect(only().messages.map(m => m.providerId)).toEqual(["old1", "old2", "in3"])
    expect(only().state).toBe("new")
  })

  it("zlyhanie historie ticket nezastavi", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await ingestMessages("SFZ", "k", [fresh], { thread: async () => { throw new Error("Graph 503") } })
    expect(r.created).toBe(1)
    expect(only().messages).toHaveLength(1)
  })

  it("rucne dotiahnutie doplni chybajuce a druhy raz uz nic", async () => {
    await ingestMessages("SFZ", "k", [fresh])
    const id = String(store[0]._id)
    expect(await importTicketThread("SFZ", ["k"], id, "agent@sfz.sk", async () => [...history, fresh])).toBe(2)
    expect(await importTicketThread("SFZ", ["k"], id, "agent@sfz.sk", async () => [...history, fresh])).toBe(0)
    expect(only().messages.map(m => m.providerId)).toEqual(["old1", "old2", "in3"])
  })
})

describe("ingestMessages — nova sprava na vybavenom tickete", () => {
  // Vo Vybavených sú odpovedané aj zavreté (Ján 29. 10. 2026); nová správa
  // pýtajúceho vráti oba do Otvorených.
  it.each(["sent", "closed"])("ticket v stave %s sa znova otvori", async state => {
    await ingestMessages("SFZ", "k", [mail({ id: "in1", internetMessageId: "<in1>" })])
    store[0].state = state
    store[0].closedAt = state === "closed" ? at(11) : null
    await ingestMessages("SFZ", "k", [mail({ id: "in2", internetMessageId: "<in2>", text: "Ešte jedna otázka.", receivedAt: at(12) })])
    expect(only().state).toBe("reopened")
    expect(store[0].closedAt).toBeNull()
    expect(only().messages).toHaveLength(2)
  })

  it("odpoved helpdesku vybaveny ticket neotvori", async () => {
    await ingestMessages("SFZ", "k", [mail({ id: "in1", internetMessageId: "<in1>" })])
    store[0].state = "closed"
    await ingestMessages("SFZ", "k", [mail({ id: "out1", internetMessageId: "<out1>", outgoing: true, from: helpdesk, text: "Doplnenie.", receivedAt: at(12) })])
    expect(only().state).toBe("closed")
  })
})

describe("ingestMessages — preposlane kolegom (Jan 30. 10. 2026)", () => {
  const fwd = (over: Partial<MailMessage> = {}) => mail({
    id: "f1", internetMessageId: "<f1>", from: { address: "kolega@futbalsfz.sk", name: "Kolega SFZ" }, subject: "Fwd: Nefunkčné prihlásenie",
    text: "Prosím o vybavenie.\n\nOd: Jana Vzorová <jana.vzorova@example.com>\n\nDobrý deň, neviem sa prihlásiť.", ...over,
  })
  type F = T & { asker: { email: string | null; name: string | null }; forwardedBy?: { address: string } }

  it("pytajucim sa je povodny odosielatel, kolega je v forwardedBy; odpoved ide povodnemu", async () => {
    await ingestMessages("SFZ", "k", [fwd()], { mailbox: "helpdesk@futbalsfz.sk" })
    const t = only() as unknown as F
    expect(t.asker).toMatchObject({ email: "jana.vzorova@example.com", name: "Jana Vzorová" })
    expect(t.forwardedBy).toEqual({ address: "kolega@futbalsfz.sk", name: "Kolega SFZ" })
    expect(answerRoute(t as never)).toEqual({ kind: "replyTo", providerId: "f1", to: "jana.vzorova@example.com" })
  })

  it("ked povodny odosielatel odpovie sam, ide obycajna odpoved vo vlakne", async () => {
    await ingestMessages("SFZ", "k", [fwd()], { mailbox: "helpdesk@futbalsfz.sk" })
    await ingestMessages("SFZ", "k", [mail({ id: "in2", internetMessageId: "<in2>", from: { address: "jana.vzorova@example.com", name: "Jana Vzorová" }, text: "Ďakujem.", receivedAt: at(11) })])
    expect(answerRoute(only() as never)).toEqual({ kind: "reply", providerId: "in2" })
  })

  it("bez adresy schranky (stare volanie) ostava odosielatel", async () => {
    await ingestMessages("SFZ", "k", [fwd()])
    expect((only() as unknown as F).asker.email).toBe("kolega@futbalsfz.sk")
    expect((only() as unknown as F).forwardedBy).toBeUndefined()
  })
})
