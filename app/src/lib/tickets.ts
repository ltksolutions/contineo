/**
 * tickets.ts — ticket helpdesku (ADR-028, D163).
 *
 * Jedna fronta pre oba kanály: správa zo schránky kanála aj eskalácia z chatu
 * (krok 5) sa stanú ticketom v tej istej kolekcii. Tu je dátový model a zápis
 * zo schránky (synchronizácia, krok 3); obrazovka riešiteľa a návrh odpovede
 * sú krok 4.
 *
 * **Vlákno = ticket.** Ďalšia správa v tom istom vlákne ticket dopĺňa; keď bol
 * zavretý, znova sa otvorí (`reopened`). Správa, ktorú ticket už má
 * (`internetMessageId`), sa nezapíše druhýkrát — delta synchronizácia po
 * vypršanej značke začína odznova a nesmie zdvojiť obsah.
 *
 * Ticket sa **nemaže**; zavretie je stav. Telá správ sa držia len tu, pri
 * tickete (D165); prílohy len názvom a veľkosťou.
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import type { MailMessage } from "./mailbox/types"
import { stripQuotedHistory } from "./mailbox/types"

export const TICKETS_COLLECTION = "tickets"

export type TicketSource = "chat" | "email"
export type TicketState = "new" | "drafted" | "sent" | "closed" | "reopened"

export interface TicketMessage {
  /** `Message-ID` správy — identita naprieč synchronizáciami. */
  internetMessageId: string | null
  /** Identifikátor u poskytovateľa — potrebný na odpoveď vo vlákne. */
  providerId: string
  direction: "in" | "out"
  from: { address: string; name: string | null } | null
  subject: string
  text: string
  at: Date
  attachments: { name: string; bytes: number }[]
}

export interface Ticket {
  companyCode: string
  channelKey: string
  source: TicketSource
  /** Vlákno u poskytovateľa (Graph `conversationId`). */
  threadRef: string | null
  asker: {
    personId: string | null
    email: string | null
    /** Kópia mena v čase vzniku (D24). */
    name: string | null
    roles: string[]
    club: string | null
  }
  subject: string
  messages: TicketMessage[]
  state: TicketState
  assigneeId: string | null
  draft: { text: string; sources: unknown[]; model: string; at: Date } | null
  sentAnswer: { text: string; by: string; at: Date; messageId: string | null } | null
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null
}

export function toTicketMessage(m: MailMessage): TicketMessage {
  return {
    internetMessageId: m.internetMessageId,
    providerId: m.id,
    direction: m.outgoing ? "out" : "in",
    from: m.from,
    subject: m.subject,
    text: stripQuotedHistory(m.text),
    at: m.receivedAt,
    attachments: m.attachments,
  }
}

export interface IngestResult {
  created: number
  appended: number
  skipped: number
}

/**
 * Zapíše správy zo schránky do ticketov podľa vlákna. Odchádzajúca správa
 * (odpoveď helpdesku z Outlooku) sa k ticketu pripojí tiež — riešiteľ vidí
 * celé vlákno — ale nový ticket nezakladá a stav nemení: na otázku, ktorá
 * prišla pred prvou synchronizáciou, nemá systém čo riešiť.
 */
export async function ingestMessages(
  companyCode: string,
  channelKey: string,
  messages: MailMessage[],
): Promise<IngestResult> {
  const col = await getCollection<Ticket>(TICKETS_COLLECTION)
  const result: IngestResult = { created: 0, appended: 0, skipped: 0 }
  const now = new Date()
  // Staršie najprv — vlákno má vznikať od prvej správy.
  const ordered = [...messages].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())

  for (const m of ordered) {
    const existing = await col.findOne({ companyCode, channelKey, threadRef: m.threadRef })
    const already = existing?.messages.some(x =>
      (m.internetMessageId && x.internetMessageId === m.internetMessageId) || x.providerId === m.id)
    if (already) { result.skipped += 1; continue }

    const tm = toTicketMessage(m)
    if (existing) {
      const reopen = !m.outgoing && (existing.state === "closed" || existing.state === "sent")
      await col.updateOne(
        { companyCode, channelKey, threadRef: m.threadRef },
        {
          $push: { messages: tm },
          $set: { updatedAt: now, ...(reopen ? { state: "reopened" as TicketState, closedAt: null } : {}) },
        },
      )
      result.appended += 1
      continue
    }
    if (m.outgoing) { result.skipped += 1; continue }

    const ticket: Ticket = {
      companyCode, channelKey, source: "email", threadRef: m.threadRef,
      asker: { personId: null, email: m.from?.address ?? null, name: m.from?.name ?? null, roles: [], club: null },
      subject: m.subject,
      messages: [tm],
      state: "new", assigneeId: null, draft: null, sentAnswer: null,
      createdAt: now, updatedAt: now, closedAt: null,
    }
    await col.insertOne(ticket)
    result.created += 1
  }

  if (result.created || result.appended) {
    await writeAudit({
      companyCode, subject: "ticket", action: "synchronizacia", actor: "system",
      targetId: channelKey, targetLabel: channelKey,
      note: `nové ${result.created} · doplnené ${result.appended} · preskočené ${result.skipped}`,
    })
  }
  return result
}

/** Počty vo fronte kanála — pre nastavenie kanála a neskôr obrazovku riešiteľa. */
export async function ticketCounts(companyCode: string, channelKey: string): Promise<Record<TicketState, number>> {
  const col = await getCollection<Ticket>(TICKETS_COLLECTION)
  const rows = await col.aggregate<{ _id: TicketState; n: number }>([
    { $match: { companyCode, channelKey } },
    { $group: { _id: "$state", n: { $sum: 1 } } },
  ]).toArray()
  const out: Record<TicketState, number> = { new: 0, drafted: 0, sent: 0, closed: 0, reopened: 0 }
  for (const r of rows) if (r._id in out) out[r._id] = r.n
  return out
}
