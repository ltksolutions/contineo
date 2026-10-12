/**
 * courier.ts — Kuriér: správy medzi ľuďmi v organizácii (ADR-033).
 *
 * Zvonček (`notifications.ts`) nesie udalosti systému; Kuriér nesie to, čo
 * **napísal človek človeku**. Základ je vlákno (`courier_threads`): predmet,
 * zmrazení účastníci a správy (`courier_messages`). Oznam 120 ľuďom
 * a rozhovor dvoch kolegov sú ten istý model (D204) — líšia sa len tým, komu
 * ide odpoveď (D205).
 *
 * **Dve kolekcie, nie pole správ vo vlákne** (D213): vlákno s odpoveďami by
 * rástlo bez stropu a dokument má limit 16 MB.
 *
 * **Účastníci sú kópia** (D204, ako publikum pridelenia v ADR-005): meno
 * a adresa v čase odoslania. Kto príde do oddelenia o mesiac, starý oznam
 * nedostane; kto odíde, ostane mu v archíve. Čítajú sa **len cez
 * `participantsOf()`** — nad 500 príjemcov pôjdu do vlastnej kolekcie (D212)
 * a obrazovky to nemajú zistiť.
 *
 * **Čo sa tu neukladá:** text správy do auditu (D209) — audit nesie kto, kedy,
 * komu (druh a počet) a predmet.
 *
 * ## `unreadFor` — výnimka z „stav sa odvodzuje" (D27)
 *
 * Zoznam osôb, ktoré vlákno od poslednej správy neotvorili, je **uložený**,
 * hoci by sa dal dopočítať z `lastMessageAt` a `lastReadAt` účastníka. Dôvod:
 * počet neprečítaných sa ráta pri **každom vykreslení hlavičky** (obálka,
 * D214) a porovnanie dvoch polí vnútri poľa účastníkov (`$expr` nad
 * `$filter`) index nevyužije. `countDocuments({ unreadFor: personId })` nad
 * indexom áno. Zdroj pravdy pre „prečítané" pri 1:1 ostáva `lastReadAt`;
 * `unreadFor` je len index pre počet a mení sa na tých istých miestach.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { writeAudit } from "./audit"

export const THREADS_COLLECTION = "courier_threads"
export const MESSAGES_COLLECTION = "courier_messages"

/** Stránkovanie od začiatku (D213). */
export const THREADS_PAGE = 50
export const MESSAGES_PAGE = 100

/** Predmet a text majú strop — správa nie je dokument. */
export const SUBJECT_MAX = 200
export const TEXT_MAX = 20_000

export class CourierError extends AppError {}

export type ThreadKind = "announcement" | "direct"

/** Komu ide odpoveď (D205): pri ozname súkromne odosielateľovi. */
export type ReplyTo = "sender" | "all"

/** Osoba tak, ako vstupuje do vlákna — kópia, nie odkaz. */
export interface PersonRef {
  personId: string
  email: string
  name: string
}

export interface Participant extends PersonRef {
  /** Kedy vlákno naposledy otvoril; `null` = nikdy. Zdroj pre „prečítané" pri 1:1. */
  lastReadAt: Date | null
  /** Stlmené vlákno (fáza 2) — nateraz vždy `null`. */
  mutedAt: Date | null
}

export interface Thread {
  _id?: ObjectId
  companyCode: string
  kind: ThreadKind
  subject: string
  participants: Participant[]
  /** Počet príjemcov v čase odoslania — pri ozname aj po zmene oddelení. */
  recipients: number
  createdBy: PersonRef
  createdAt: Date
  lastMessageAt: Date
  /** Kópia pre zoznam — zoznam vlákien nečíta kolekciu správ. */
  lastMessage: { authorName: string; preview: string }
  replyTo: ReplyTo
  /** Vlákno, na ktoré je toto súkromnou odpoveďou (D205). */
  parentThreadId: string | null
  /** Viď hlavičku súboru. */
  unreadFor: string[]
}

export interface Message {
  _id?: ObjectId
  companyCode: string
  threadId: string
  author: PersonRef
  /** Ľahký Markdown; vykresľuje `formatText.ts`, nikdy HTML (D208). */
  text: string
  at: Date
  editedAt: Date | null
}

/** Riadok zoznamu vlákien — čo vidí jedna osoba. */
export interface ThreadRow {
  id: string
  kind: ThreadKind
  subject: string
  /** Druhá strana pri 1:1, inak autor poslednej správy. */
  counterpart: string
  recipients: number
  preview: string
  lastMessageAt: Date
  unread: boolean
}

let indexReady: Promise<unknown> | null = null

/** Indexy sa zakladajú v kóde pri prvom použití, nie ručne v Atlase (D213). */
async function threads() {
  const col = await getCollection<Thread>(THREADS_COLLECTION)
  indexReady ??= Promise.all([
    col.createIndex({ companyCode: 1, "participants.personId": 1, lastMessageAt: -1 }, { name: "courier_threads_person" }),
    col.createIndex({ companyCode: 1, unreadFor: 1 }, { name: "courier_threads_unread" }),
  ]).catch(e => { indexReady = null; throw e })
  await indexReady
  return col
}

let messagesIndexReady: Promise<unknown> | null = null

async function messages() {
  const col = await getCollection<Message>(MESSAGES_COLLECTION)
  messagesIndexReady ??= col
    .createIndex({ companyCode: 1, threadId: 1, at: -1 }, { name: "courier_messages_thread" })
    .catch(e => { messagesIndexReady = null; throw e })
  await messagesIndexReady
  return col
}

/**
 * Účastníci vlákna. Jediné miesto, ktoré vie, kde sú uložení (D212) —
 * nateraz v poli vo vlákne.
 */
export function participantsOf(thread: Pick<Thread, "participants">): Participant[] {
  return thread.participants ?? []
}

export function isParticipant(thread: Pick<Thread, "participants">, personId: string): boolean {
  return participantsOf(thread).some(p => p.personId === personId)
}

/** Ukážka do zoznamu: prvý riadok bez značiek Markdownu, najviac 120 znakov. */
export function previewOf(text: string): string {
  const line = text.split("\n").map(l => l.trim()).find(l => l.length > 0) ?? ""
  const plain = line
    .replace(/^#+\s*/, "")
    .replace(/^\s*[-*•]\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  return plain.length > 120 ? `${plain.slice(0, 119).trimEnd()}…` : plain
}

/** Prázdny predmet alebo text sa neposiela; dlhý sa neukladá potichu skrátený. */
export function validateContent(subject: string, text: string): { subject: string; text: string } {
  const s = subject.trim().replace(/\s+/g, " ")
  const t = text.replace(/\r\n/g, "\n").trim()
  if (!s) throw new CourierError("courier.emptySubject", "Predmet chýba.")
  if (s.length > SUBJECT_MAX) throw new CourierError("courier.subjectTooLong", "Predmet je pridlhý.")
  if (!t) throw new CourierError("courier.emptyText", "Správa je prázdna.")
  if (t.length > TEXT_MAX) throw new CourierError("courier.textTooLong", "Správa je pridlhá.")
  return { subject: s, text: t }
}

function participant(p: PersonRef, readAt: Date | null): Participant {
  return { personId: p.personId, email: p.email.toLowerCase(), name: p.name, lastReadAt: readAt, mutedAt: null }
}

/**
 * Nové 1:1 vlákno (D204 — smie ktokoľvek). Odosielateľ ho má hneď prečítané,
 * adresát nie. Sebe sa nepíše: vlákno s jedným účastníkom by nemalo komu
 * ukázať „prečítané".
 */
export async function createDirectThread(input: {
  companyCode: string
  from: PersonRef
  to: PersonRef
  subject: string
  text: string
  parentThreadId?: string | null
  now?: Date
}): Promise<string> {
  if (input.from.personId === input.to.personId) {
    throw new CourierError("courier.selfRecipient", "Správu si nemôžete poslať sami sebe.")
  }
  const { subject, text } = validateContent(input.subject, input.text)
  const now = input.now ?? new Date()
  const col = await threads()
  const thread: Thread = {
    companyCode: input.companyCode,
    kind: "direct",
    subject,
    participants: [participant(input.from, now), participant(input.to, null)],
    recipients: 1,
    createdBy: input.from,
    createdAt: now,
    lastMessageAt: now,
    lastMessage: { authorName: input.from.name, preview: previewOf(text) },
    replyTo: "all",
    parentThreadId: input.parentThreadId ?? null,
    unreadFor: [input.to.personId],
  }
  const r = await col.insertOne(thread)
  const threadId = String(r.insertedId)
  const msgs = await messages()
  await msgs.insertOne({ companyCode: input.companyCode, threadId, author: input.from, text, at: now, editedAt: null })
  await writeAudit({
    companyCode: input.companyCode,
    subject: "courier",
    action: "odoslane",
    actor: input.from.email,
    targetId: threadId,
    targetLabel: subject,
    note: "direct · 1",
  })
  return threadId
}

/** Vlákno pre prihlásenú osobu — `null`, keď nie je jeho účastníkom (D209). */
export async function loadThread(companyCode: string, threadId: string, personId: string): Promise<Thread | null> {
  if (!ObjectId.isValid(threadId)) return null
  const col = await threads()
  // `companyCode` v podmienke dotazu (D32); účastníctvo tiež — cudzie vlákno
  // sa nevráti ani správcovi.
  return col.findOne({ _id: new ObjectId(threadId), companyCode, "participants.personId": personId })
}

/** Správy vlákna, najstaršie hore, najviac `MESSAGES_PAGE` posledných. */
export async function threadMessages(companyCode: string, threadId: string): Promise<Message[]> {
  const col = await messages()
  const rows = await col.find({ companyCode, threadId }).sort({ at: -1 }).limit(MESSAGES_PAGE).toArray()
  return rows.reverse()
}

/**
 * Odpoveď vo vlákne. Autor musí byť účastník; ostatným sa vlákno označí
 * ako neprečítané. Kto smie odpovedať pri ozname rieši D205 nad touto
 * funkciou — tu je už len zápis.
 */
export async function postMessage(input: {
  companyCode: string
  threadId: string
  author: PersonRef
  text: string
  now?: Date
}): Promise<void> {
  const thread = await loadThread(input.companyCode, input.threadId, input.author.personId)
  if (!thread) throw new CourierError("courier.notFound", "Také vlákno tu nie je.")
  const text = input.text.replace(/\r\n/g, "\n").trim()
  if (!text) throw new CourierError("courier.emptyText", "Správa je prázdna.")
  if (text.length > TEXT_MAX) throw new CourierError("courier.textTooLong", "Správa je pridlhá.")
  const now = input.now ?? new Date()

  const msgs = await messages()
  await msgs.insertOne({ companyCode: input.companyCode, threadId: input.threadId, author: input.author, text, at: now, editedAt: null })

  const others = participantsOf(thread).map(p => p.personId).filter(id => id !== input.author.personId)
  const col = await threads()
  await col.updateOne(
    { _id: thread._id, companyCode: input.companyCode },
    {
      $set: {
        lastMessageAt: now,
        lastMessage: { authorName: input.author.name, preview: previewOf(text) },
        unreadFor: others,
        "participants.$[me].lastReadAt": now,
      },
    },
    { arrayFilters: [{ "me.personId": input.author.personId }] },
  )
  await writeAudit({
    companyCode: input.companyCode,
    subject: "courier",
    action: "odpoved",
    actor: input.author.email,
    targetId: input.threadId,
    targetLabel: thread.subject,
    note: `${thread.kind} · ${others.length}`,
  })
}

/** Otvorenie vlákna: `lastReadAt` a vyradenie z `unreadFor` naraz. */
export async function markThreadRead(companyCode: string, threadId: string, personId: string, now: Date = new Date()): Promise<void> {
  if (!ObjectId.isValid(threadId)) return
  const col = await threads()
  await col.updateOne(
    { _id: new ObjectId(threadId), companyCode, "participants.personId": personId },
    { $set: { "participants.$[me].lastReadAt": now }, $pull: { unreadFor: personId } },
    { arrayFilters: [{ "me.personId": personId }] },
  )
}

/**
 * Počet neprečítaných vlákien — obálka v hlavičke (D214). Volá sa pri každom
 * vykreslení, takže `countDocuments` nad indexom a nič viac; zlyhanie je nula,
 * hlavička sa pre ozdobu nerozbije.
 */
export async function unreadThreadCount(companyCode: string, personId: string): Promise<number> {
  if (!companyCode?.trim() || !personId?.trim()) return 0
  try {
    const col = await threads()
    return await col.countDocuments({ companyCode, unreadFor: personId })
  } catch (e) {
    console.error("[courier] pocet neprecitanych zlyhal:", e)
    return 0
  }
}

function counterpartOf(thread: Thread, personId: string): string {
  if (thread.kind === "direct") {
    return participantsOf(thread).find(p => p.personId !== personId)?.name ?? thread.createdBy.name
  }
  return thread.lastMessage.authorName
}

/** Vlákna osoby, najnovšie hore, po stránkach (D213). */
export async function listThreads(companyCode: string, personId: string, page = 1): Promise<{ rows: ThreadRow[]; hasMore: boolean }> {
  const col = await threads()
  const skip = Math.max(0, page - 1) * THREADS_PAGE
  const found = await col
    .find({ companyCode, "participants.personId": personId })
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(THREADS_PAGE + 1)
    .toArray()
  const hasMore = found.length > THREADS_PAGE
  const rows = found.slice(0, THREADS_PAGE).map(t => ({
    id: String(t._id),
    kind: t.kind,
    subject: t.subject,
    counterpart: counterpartOf(t, personId),
    recipients: t.recipients,
    preview: t.lastMessage?.preview ?? "",
    lastMessageAt: t.lastMessageAt,
    unread: (t.unreadFor ?? []).includes(personId),
  }))
  return { rows, hasMore }
}
