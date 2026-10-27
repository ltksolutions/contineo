/**
 * widgetTicketThread.test.ts — vlákno ticketu z widgetu (ADR-042, D277).
 *
 * Potvrdenie e-mailom založí vlákno; synchronizácia ho spozná a nepovažuje
 * za odpoveď; odpoveď človeka z e-mailu sa pripojí k tomu istému ticketu
 * a riešiteľ odpovedá vo vlákne — najprv na potvrdenie, potom na e-mail.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { ObjectId } from "mongodb"
import type { MailMessage, SentMail } from "../src/lib/mailbox/types"

type Doc = Record<string, unknown> & { _id: ObjectId }
const store: Doc[] = []
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
    for (const [k, v] of Object.entries(u.$set ?? {})) {
      const parts = k.split(".")
      let cur = d as Record<string, unknown>
      for (const p of parts.slice(0, -1)) cur = cur[p] as Record<string, unknown>
      cur[parts.at(-1)!] = v
    }
    for (const [k, v] of Object.entries(u.$push ?? {})) (d[k] as unknown[]).push(v)
  },
}
vi.mock("../src/lib/mongodb", () => ({ getCollection: vi.fn(async () => fake) }))
vi.mock("../src/lib/audit", () => ({ writeAudit: vi.fn(async () => {}) }))

const { createChatTicket, confirmChatTicket, ingestMessages, answerRoute, sendTicketAnswer } = await import("../src/lib/tickets")
type T = Parameters<typeof answerRoute>[0] & { _id: ObjectId; state: string; messages: { providerId: string; direction: string }[] }
const only = () => store[0] as unknown as T

const asker = { personId: "p1", email: "rodic@example.sk", name: "Peter Hráč", roles: ["HRAC"], club: null, reference: "1234567" }
const helpdesk = { address: "helpdesk@futbalsfz.sk", name: "Helpdesk SFZ" }
const sent: SentMail = { messageId: "<potvrdenie@x>", threadRef: "conv-w", providerId: "imm-1" }
const mail = (over: Partial<MailMessage>): MailMessage => ({
  id: "m", internetMessageId: null, threadRef: "conv-w", from: { address: "rodic@example.sk", name: "Rodič" }, to: [],
  subject: "Re: Prijali sme vašu správu", text: "", receivedAt: new Date(), outgoing: false, attachments: [], ...over,
})

async function confirmed(): Promise<string> {
  const id = await createChatTicket("SFZ", { channelKey: "k", asker, message: "Ako zaplatím členský poplatok?", conversation: [] })
  await confirmChatTicket("SFZ", id, { to: asker.email, subject: "Prijali sme vašu správu: Ako zaplatím členský poplatok?", text: "Dobrý deň,\n\nprijali sme vašu správu." }, async () => sent)
  return id
}

beforeEach(() => { store.length = 0 })

describe("potvrdenie ticketu z widgetu", () => {
  it("založí vlákno a stav nezmení — potvrdenie nie je odpoveď", async () => {
    await confirmed()
    expect(only().threadRef).toBe("conv-w")
    expect(only().confirmation).toMatchObject({ providerId: "imm-1", messageId: "<potvrdenie@x>" })
    expect(only().state).toBe("new")
    expect(only().messages.map(m => m.direction)).toEqual(["in", "out"])
  })

  it("synchronizácia potvrdenie z Odoslaných spozná a ticket nezodpovie", async () => {
    await confirmed()
    const r = await ingestMessages("SFZ", "k", [mail({ id: "sent-1", internetMessageId: "<potvrdenie@x>", outgoing: true, from: helpdesk, text: "iný tvar textu z HTML" })])
    expect(r).toEqual({ created: 0, appended: 0, skipped: 1 })
    expect(only().state).toBe("new")
    expect(store).toHaveLength(1)
  })

  it("odpoveď človeka z e-mailu sa pripojí k tomu istému ticketu, nový nevznikne", async () => {
    await confirmed()
    const r = await ingestMessages("SFZ", "k", [mail({ id: "in-2", internetMessageId: "<in2@x>", text: "Doplním: ide o hráča U13." })])
    expect(r).toEqual({ created: 0, appended: 1, skipped: 0 })
    expect(store).toHaveLength(1)
    expect(only().messages.map(m => m.direction)).toEqual(["in", "out", "in"])
  })
})

describe("cesta odpovede riešiteľa", () => {
  it("pred odpoveďou človeka na potvrdenie, adresát výslovne z ticketu", async () => {
    await confirmed()
    expect(answerRoute(only())).toEqual({ kind: "replyTo", providerId: "imm-1", to: "rodic@example.sk" })
  })
  it("po e-maile človeka odpoveďou na jeho správu", async () => {
    await confirmed()
    await ingestMessages("SFZ", "k", [mail({ id: "in-2", internetMessageId: "<in2@x>", text: "Doplním." })])
    expect(answerRoute(only())).toEqual({ kind: "reply", providerId: "in-2" })
  })
  it("bez potvrdenia novou správou; e-mailový ticket odpoveďou vo vlákne", async () => {
    await createChatTicket("SFZ", { channelKey: "k", asker, message: "Otázka.", conversation: [] })
    expect(answerRoute(only())).toEqual({ kind: "send", to: "rodic@example.sk" })
    store.length = 0
    await ingestMessages("SFZ", "k", [mail({ id: "e1", threadRef: "conv-e", text: "Otázka e-mailom." })])
    expect(answerRoute(only())).toEqual({ kind: "reply", providerId: "e1" })
  })
  it("bez adresy a bez e-mailu niet komu odpovedať", async () => {
    await createChatTicket("SFZ", { channelKey: "k", asker: { ...asker, email: null }, message: "Otázka.", conversation: [] })
    expect(() => answerRoute(only())).toThrow()
  })
  it("ticket bez potvrdenia dostane vlákno prvou odpoveďou", async () => {
    await createChatTicket("SFZ", { channelKey: "k", asker, message: "Otázka.", conversation: [] })
    const t = only()
    await sendTicketAnswer("SFZ", ["k"], String(t._id), "Odpoveď.", { email: "h@sfz.sk", personId: "h" }, async () => ({ messageId: "<a@x>", threadRef: "conv-a" }))
    expect(only().threadRef).toBe("conv-a")
    expect(only().state).toBe("sent")
  })
})

describe("adresa stránky z widgetu (ADR-042, D276)", () => {
  it("len z pôvodu brány, bez fragmentu; iné nič", async () => {
    const { widgetPage } = await import("../src/lib/tickets")
    const o = "https://issf.futbalsfz.sk"
    expect(widgetPage("https://issf.futbalsfz.sk/Pomoc?17#x", o)).toBe("https://issf.futbalsfz.sk/Pomoc?17")
    expect(widgetPage("https://zly.sk/Pomoc", o)).toBeNull()
    expect(widgetPage("javascript:alert(1)", o)).toBeNull()
    expect(widgetPage(42, o)).toBeNull()
    expect(widgetPage(`https://issf.futbalsfz.sk/${"a".repeat(600)}`, o)).toBeNull()
  })
})
