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

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"
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

// ── práca riešiteľa (ADR-028 krok 4) ────────────────────────────────────────

export class TicketError extends AppError {}

export type TicketWithId = Ticket & { _id: ObjectId }

/** Otvorené stavy — čo riešiteľ vidí v hlavnej fronte. */
export const OPEN_STATES: TicketState[] = ["new", "drafted", "reopened"]

export interface TicketListItem {
  id: string
  channelKey: string
  source: TicketSource
  subject: string
  askerName: string | null
  askerEmail: string | null
  state: TicketState
  assigneeId: string | null
  messageCount: number
  lastMessageAt: Date
  createdAt: Date
}

function toListItem(t: TicketWithId): TicketListItem {
  const last = t.messages[t.messages.length - 1]
  return {
    id: String(t._id), channelKey: t.channelKey, source: t.source, subject: t.subject,
    askerName: t.asker.name, askerEmail: t.asker.email, state: t.state, assigneeId: t.assigneeId,
    messageCount: t.messages.length, lastMessageAt: last?.at ?? t.updatedAt, createdAt: t.createdAt,
  }
}

/**
 * Fronta kanálov riešiteľa. `channelKeys` prídu z `channelsForAgent()` —
 * ticket cudzieho kanála sa sem nedostane ani s uhádnutým identifikátorom
 * (D32: podmienka v dotaze, nie kontrola nad ním).
 */
export async function listTickets(
  companyCode: string,
  channelKeys: string[],
  view: "open" | "sent" | "closed" | "all" = "open",
  limit = 200,
): Promise<TicketListItem[]> {
  if (!channelKeys.length) return []
  const col = await getCollection<TicketWithId>(TICKETS_COLLECTION)
  const state = view === "open" ? { $in: OPEN_STATES } : view === "sent" ? "sent" : view === "closed" ? "closed" : undefined
  const rows = await col
    .find({ companyCode, channelKey: { $in: channelKeys }, ...(state ? { state } : {}) })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray()
  return rows.map(toListItem)
}

export async function ticketById(companyCode: string, channelKeys: string[], id: string): Promise<TicketWithId | null> {
  if (!channelKeys.length || !ObjectId.isValid(id)) return null
  const col = await getCollection<TicketWithId>(TICKETS_COLLECTION)
  return col.findOne({ _id: new ObjectId(id), companyCode, channelKey: { $in: channelKeys } })
}

async function loadForWrite(companyCode: string, channelKeys: string[], id: string): Promise<TicketWithId> {
  const t = await ticketById(companyCode, channelKeys, id)
  if (!t) throw new TicketError("ticket.notFound", "Taký ticket tu nie je.")
  return t
}

/** Posledná správa od pýtajúceho sa — na ňu sa odpovedá vo vlákne. */
export function lastIncoming(t: Ticket): TicketMessage | null {
  return [...t.messages].reverse().find(m => m.direction === "in") ?? null
}

/** Text otázky pre návrh odpovede: predmet a všetky prichádzajúce správy v poradí. */
export function questionText(t: Ticket): string {
  const parts = t.messages.filter(m => m.direction === "in").map(m => m.text.trim()).filter(Boolean)
  return [t.subject ? `Predmet: ${t.subject}` : "", ...parts].filter(Boolean).join("\n\n")
}

export async function assignTicket(companyCode: string, channelKeys: string[], id: string, assigneeId: string | null, actor: string): Promise<void> {
  const t = await loadForWrite(companyCode, channelKeys, id)
  const col = await getCollection<TicketWithId>(TICKETS_COLLECTION)
  await col.updateOne({ _id: t._id }, { $set: { assigneeId, updatedAt: new Date() } })
  await writeAudit({ companyCode, subject: "ticket", action: assigneeId ? "prevzaty" : "uvolneny", actor, targetId: id, targetLabel: t.subject })
}

/** Návrh odpovede — od AI alebo napísaný riešiteľom; prepíše predošlý. */
export async function saveTicketDraft(
  companyCode: string,
  channelKeys: string[],
  id: string,
  draft: { text: string; sources: unknown[]; model: string },
): Promise<void> {
  const t = await loadForWrite(companyCode, channelKeys, id)
  const text = draft.text.replace(/\r\n?/g, "\n").trim()
  if (!text) throw new TicketError("ticket.emptyDraft", "Prázdny návrh sa uložiť nedá.")
  const col = await getCollection<TicketWithId>(TICKETS_COLLECTION)
  await col.updateOne(
    { _id: t._id },
    { $set: { draft: { text, sources: draft.sources, model: draft.model, at: new Date() }, updatedAt: new Date(), ...(t.state === "new" || t.state === "reopened" ? { state: "drafted" as TicketState } : {}) } },
  )
}

/**
 * Odošle odpoveď (D12: vždy kliknutím človeka) a zapíše jej **kópiu** do
 * ticketu (D24). E-mailový ticket dostane odpoveď vo vlákne, ticket z chatu
 * novú správu na adresu pýtajúceho sa. Rozdiel medzi návrhom a odoslaným
 * textom zostáva v tickete — to je signál na učenie.
 */
export async function sendTicketAnswer(
  companyCode: string,
  channelKeys: string[],
  id: string,
  text: string,
  actor: { email: string; personId: string },
  send: (t: TicketWithId, text: string) => Promise<{ messageId: string | null }>,
): Promise<void> {
  const t = await loadForWrite(companyCode, channelKeys, id)
  const body = text.replace(/\r\n?/g, "\n").trim()
  if (!body) throw new TicketError("ticket.emptyAnswer", "Prázdna odpoveď sa odoslať nedá.")
  if (!t.asker.email && !lastIncoming(t)) throw new TicketError("ticket.noRecipient", "Ticket nemá komu odpovedať — chýba adresa.")
  const r = await send(t, body)
  const now = new Date()
  const col = await getCollection<TicketWithId>(TICKETS_COLLECTION)
  await col.updateOne(
    { _id: t._id },
    {
      $set: { state: "sent" as TicketState, sentAnswer: { text: body, by: actor.email, at: now, messageId: r.messageId }, assigneeId: t.assigneeId ?? actor.personId, updatedAt: now },
      $push: {
        messages: {
          internetMessageId: r.messageId, providerId: `sent:${now.getTime()}`, direction: "out" as const,
          from: null, subject: t.subject, text: body, at: now, attachments: [],
        },
      },
    },
  )
  await writeAudit({ companyCode, subject: "ticket", action: "odpoved-odoslana", actor: actor.email, targetId: id, targetLabel: t.subject, note: t.draft ? (t.draft.text === body ? "návrh bez zmeny" : "návrh upravený") : "bez návrhu" })
}

export async function closeTicket(companyCode: string, channelKeys: string[], id: string, actor: string): Promise<void> {
  const t = await loadForWrite(companyCode, channelKeys, id)
  const col = await getCollection<TicketWithId>(TICKETS_COLLECTION)
  await col.updateOne({ _id: t._id }, { $set: { state: "closed" as TicketState, closedAt: new Date(), updatedAt: new Date() } })
  await writeAudit({ companyCode, subject: "ticket", action: "zavrety", actor, targetId: id, targetLabel: t.subject })
}

export async function reopenTicket(companyCode: string, channelKeys: string[], id: string, actor: string): Promise<void> {
  const t = await loadForWrite(companyCode, channelKeys, id)
  const col = await getCollection<TicketWithId>(TICKETS_COLLECTION)
  await col.updateOne({ _id: t._id }, { $set: { state: "reopened" as TicketState, closedAt: null, updatedAt: new Date() } })
  await writeAudit({ companyCode, subject: "ticket", action: "znovu-otvoreny", actor, targetId: id, targetLabel: t.subject })
}

/**
 * Predvyplnenie záznamu FAQ z ticketu: otázka z predmetu alebo prvej správy,
 * odpoveď z odoslaného textu (prednostne) alebo návrhu, zdroje z návrhu.
 * Osobné údaje v otázke riešiteľ pred uložením prepíše — preto je to návrh,
 * nie zápis.
 */
export function faqPrefillFromTicket(t: Ticket): { question: string; answer: string; sources: { documentId: string; articleRef: string | null }[]; origin: { channelKey: string; threadRefs: string[]; messageIds: string[] } } {
  const first = t.messages.find(m => m.direction === "in")
  const question = (t.subject || first?.text.split("\n")[0] || "").replace(/^(re|fw|fwd):\s*/i, "").trim()
  const answer = t.sentAnswer?.text ?? t.draft?.text ?? ""
  const sources = (t.draft?.sources ?? [])
    .map(s => s as { documentId?: string; articleRef?: string | null })
    .filter(s => typeof s.documentId === "string")
    .map(s => ({ documentId: String(s.documentId), articleRef: s.articleRef ?? null }))
  return {
    question, answer, sources: [...new Map(sources.map(s => [s.documentId, s])).values()].slice(0, 5),
    origin: { channelKey: t.channelKey, threadRefs: t.threadRef ? [t.threadRef] : [], messageIds: t.messages.map(m => m.internetMessageId ?? m.providerId) },
  }
}

// ── ticket z chatu (ADR-028 krok 5, D166) ───────────────────────────────────

export interface ChatTicketInput {
  channelKey: string
  asker: Ticket["asker"]
  /** Čo človek napísal helpdesku po tom, čo mu asistent nepomohol. */
  message: string
  /**
   * Priebeh rozhovoru — identifikátory záznamov v `evaluations` (otázka,
   * odpoveď, hodnotenie); riešiteľ si ich otvorí, telá sa sem nekopírujú.
   */
  conversation: { recordId: string; question: string; verdict: 0 | 1 | null }[]
}

/**
 * Ticket z widgetu. Prvá správa je otázka pýtajúceho sa spolu so stručným
 * priebehom: čo sa pýtal a čo asistent odpovedal zle — riešiteľ tak nemusí
 * hádať, kde asistent zlyhal.
 */
export async function createChatTicket(companyCode: string, input: ChatTicketInput): Promise<string> {
  const message = input.message.replace(/\r\n?/g, "\n").trim()
  if (!message) throw new TicketError("ticket.emptyQuestion", "Ticket nemá text otázky.")
  const now = new Date()
  const history = input.conversation
    .map(c => `– ${c.question.trim()}${c.verdict === 0 ? " (odpoveď asistenta nepomohla)" : ""}`)
    .join("\n")
  const subject = (input.conversation[0]?.question ?? message).split("\n")[0].slice(0, 120)
  const col = await getCollection<Ticket & { conversation?: ChatTicketInput["conversation"] }>(TICKETS_COLLECTION)
  const r = await col.insertOne({
    companyCode, channelKey: input.channelKey, source: "chat", threadRef: null,
    asker: input.asker, subject,
    messages: [{
      internetMessageId: null, providerId: `chat:${now.getTime()}`, direction: "in",
      from: input.asker.email ? { address: input.asker.email, name: input.asker.name } : null,
      subject, text: history ? `${message}\n\nPredtým sa pýtal(a):\n${history}` : message, at: now, attachments: [],
    }],
    conversation: input.conversation,
    state: "new", assigneeId: null, draft: null, sentAnswer: null,
    createdAt: now, updatedAt: now, closedAt: null,
  })
  await writeAudit({ companyCode, subject: "ticket", action: "zalozeny-z-chatu", actor: input.asker.email ?? "widget", targetId: String(r.insertedId), targetLabel: subject, note: input.channelKey })
  return String(r.insertedId)
}
