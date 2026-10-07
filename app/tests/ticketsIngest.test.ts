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

const { ingestMessages, importTicketThread } = await import("../src/lib/tickets")

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
