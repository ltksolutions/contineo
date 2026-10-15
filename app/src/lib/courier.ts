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

import { externalLinksOf } from "./courierLinks"
import { fetchPreviews, type LinkPreview } from "./linkPreview"
import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { writeAudit } from "./audit"
import { audienceMembers, audienceLabel, type Audience } from "./assignments"
import { isHr } from "./hr"
import { isPeopleAdmin } from "./people"
import { isContentManager } from "./library"
import type { Person } from "./persons"

export const THREADS_COLLECTION = "courier_threads"
export const MESSAGES_COLLECTION = "courier_messages"
/** Rozpísaný oznam medzi krokom „Skontrolovať príjemcov" a odoslaním. */
export const DRAFTS_COLLECTION = "courier_drafts"

/** Stránkovanie od začiatku (D213). */
export const THREADS_PAGE = 50
export const MESSAGES_PAGE = 100

/**
 * Strop pre účastníkov v poli vo vlákne (D212). Nad ním patria do vlastnej
 * kolekcie `courier_participants` — tá ešte nie je; dovtedy sa väčší oznam
 * odmietne s chybou, nie uloží potichu nad limit dokumentu.
 */
export const INLINE_PARTICIPANTS_MAX = 500

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
  /** „Píše…" (D210): zapíše sa pri písaní, platí `TYPING_MS`; nič sa nemaže. */
  typingAt: Date | null
  /**
   * Kedy bolo vlákno naposledy v rannom súhrne tejto osoby (D207). Nová
   * správa ho vynuluje; súhrn tak nesie len to, čo odvtedy pribudlo, a to
   * isté neprečítané vlákno nechodí e-mailom každé ráno.
   */
  digestedAt: Date | null
}

export interface Thread {
  _id?: ObjectId
  companyCode: string
  kind: ThreadKind
  subject: string
  /**
   * Publikum oznamu v čase odoslania — kópia s názvami (ADR-005), aby bolo
   * o rok čitateľné, komu sa písalo. Pri 1:1 prázdne.
   */
  audience: Audience[]
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
  /**
   * Náhľady odkazov von, získané raz pri odoslaní a uložené ako kópia
   * (D222). Chýba pri správach spred D222 a pri správe bez odkazov von.
   */
  previews?: LinkPreview[]
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
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // vnútorné aj vonkajšie odkazy (D222)
  return plain.length > 120 ? `${plain.slice(0, 119).trimEnd()}…` : plain
}

/**
 * Náhľady odkazov von pri odoslaní (D222) — prázdny objekt, keď v texte
 * odkaz von nie je, aby sa pole `previews` neukladalo zbytočne.
 */
async function previewsFor(text: string, now: Date): Promise<{ previews?: LinkPreview[] }> {
  const links = externalLinksOf(text)
  if (!links.length) return {}
  const previews = await fetchPreviews(links, now)
  return previews.length ? { previews } : {}
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
  return { personId: p.personId, email: p.email.toLowerCase(), name: p.name, lastReadAt: readAt, mutedAt: null, typingAt: null, digestedAt: null }
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
    audience: [],
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
  await msgs.insertOne({ companyCode: input.companyCode, threadId, author: input.from, text, ...await previewsFor(text, now), at: now, editedAt: null })
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
  await msgs.insertOne({ companyCode: input.companyCode, threadId: input.threadId, author: input.author, text, ...await previewsFor(text, now), at: now, editedAt: null })

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
        "participants.$[other].digestedAt": null,
      },
    },
    { arrayFilters: [{ "me.personId": input.author.personId }, { "other.personId": { $ne: input.author.personId } }] },
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

/** Ako dlho platí „píše…" od posledného zápisu `typingAt`. */
export const TYPING_MS = 5_000

/** „Píše…": len účastník; zápis bez auditu — nie je to udalosť, ale stav na 5 s. */
export async function setTyping(companyCode: string, threadId: string, personId: string, now: Date = new Date()): Promise<void> {
  if (!ObjectId.isValid(threadId)) return
  const col = await threads()
  await col.updateOne(
    { _id: new ObjectId(threadId), companyCode, "participants.personId": personId },
    { $set: { "participants.$[me].typingAt": now } },
    { arrayFilters: [{ "me.personId": personId }] },
  )
}

/** Správy vlákna po danom čase — pre živé spojenie (D210). */
export async function messagesSince(companyCode: string, threadId: string, since: Date): Promise<Message[]> {
  const col = await messages()
  return col.find({ companyCode, threadId, at: { $gt: since } }).sort({ at: 1 }).limit(MESSAGES_PAGE).toArray()
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

/** Hromadne píšu len role (D204): správca osôb, HR, správca obsahu. */
export function canAnnounce(person: Pick<Person, "roles"> | null | undefined): boolean {
  return isHr(person as Person) || isPeopleAdmin(person as Person) || isContentManager(person as Person)
}

/**
 * Príjemcovia oznamu z publík: zjednotenie cez `audienceMembers()` —
 * jediné miesto s pravidlom príslušnosti (`matchesAudience`). Externé osoby
 * z okna pomoci oznam nedostanú (D204) a odosielateľ sa nepočíta — je
 * účastníkom ako autor, nie ako príjemca.
 */
export async function announcementRecipients(
  companyCode: string,
  audiences: Audience[],
  senderId: string,
): Promise<PersonRef[]> {
  const seen = new Map<string, PersonRef>()
  for (const a of audiences) {
    for (const m of await audienceMembers(companyCode, a)) {
      if (m.personType === "external" || m.id === senderId || seen.has(m.id)) continue
      seen.set(m.id, { personId: m.id, email: m.email, name: m.fullName })
    }
  }
  return [...seen.values()]
}

/**
 * Oznam publiku (D204). Príjemcovia sa zmrazia teraz; odpovede idú
 * súkromne odosielateľovi (`replyTo: "sender"`, D205). Audit nesie druhy
 * publika a počet, nie mená ani text.
 */
export async function createAnnouncement(input: {
  companyCode: string
  from: PersonRef
  audiences: Audience[]
  recipients: PersonRef[]
  subject: string
  text: string
  now?: Date
}): Promise<string> {
  if (input.audiences.length === 0 || input.recipients.length === 0) {
    throw new CourierError("courier.noRecipients", "Oznam nemá komu ísť.")
  }
  if (input.recipients.length > INLINE_PARTICIPANTS_MAX) {
    throw new CourierError("courier.tooManyRecipients", "Oznam má priveľa príjemcov.")
  }
  const { subject, text } = validateContent(input.subject, input.text)
  const now = input.now ?? new Date()
  const col = await threads()
  const thread: Thread = {
    companyCode: input.companyCode,
    kind: "announcement",
    subject,
    audience: input.audiences,
    participants: [participant(input.from, now), ...input.recipients.map(r => participant(r, null))],
    recipients: input.recipients.length,
    createdBy: input.from,
    createdAt: now,
    lastMessageAt: now,
    lastMessage: { authorName: input.from.name, preview: previewOf(text) },
    replyTo: "sender",
    parentThreadId: null,
    unreadFor: input.recipients.map(r => r.personId),
  }
  const r = await col.insertOne(thread)
  const threadId = String(r.insertedId)
  const msgs = await messages()
  await msgs.insertOne({ companyCode: input.companyCode, threadId, author: input.from, text, ...await previewsFor(text, now), at: now, editedAt: null })
  await writeAudit({
    companyCode: input.companyCode,
    subject: "courier",
    action: "oznam",
    actor: input.from.email,
    targetId: threadId,
    targetLabel: subject,
    note: `${input.audiences.map(audienceLabel).join(", ")} · ${input.recipients.length}`,
  })
  return threadId
}

/**
 * Odpoveď príjemcu na oznam (D205): nie do oznamu, ale do 1:1 vlákna
 * s odosielateľom. Ak také vlákno k tomuto oznamu už je, správa ide doň;
 * inak vznikne s predmetom „Re: …" a odkazom na oznam.
 */
export async function replyToAnnouncement(input: {
  companyCode: string
  threadId: string
  author: PersonRef
  text: string
  now?: Date
}): Promise<string> {
  const parent = await loadThread(input.companyCode, input.threadId, input.author.personId)
  if (!parent) throw new CourierError("courier.notFound", "Také vlákno tu nie je.")
  if (parent.kind !== "announcement" || parent.createdBy.personId === input.author.personId) {
    // Autor oznamu doň píše priamo — doplnenie ide všetkým.
    await postMessage(input)
    return input.threadId
  }
  const col = await threads()
  const existing = await col.findOne({
    companyCode: input.companyCode,
    kind: "direct",
    parentThreadId: input.threadId,
    "participants.personId": input.author.personId,
  })
  if (existing) {
    const id = String(existing._id)
    await postMessage({ ...input, threadId: id })
    return id
  }
  return createDirectThread({
    companyCode: input.companyCode,
    from: input.author,
    to: parent.createdBy,
    subject: `Re: ${parent.subject}`,
    text: input.text,
    parentThreadId: input.threadId,
    now: input.now,
  })
}

/**
 * Koncept oznamu — jeden na osobu. Krok náhľadu (R2: odoslanie až po
 * prečítaní, komu to ide) prejde cez presmerovanie a text oznamu je pridlhý
 * na adresu; preto ostane tu, nie v `?text=`. Po odoslaní sa zmaže. Fáza 2
 * (koncepty) ho rozšíri, nezaloží druhýkrát.
 */
export interface Draft {
  companyCode: string
  personId: string
  all: boolean
  audience: string[]
  subject: string
  text: string
  updatedAt: Date
}

export async function saveDraft(d: Omit<Draft, "updatedAt">, now: Date = new Date()): Promise<void> {
  const col = await getCollection<Draft>(DRAFTS_COLLECTION)
  await col.updateOne(
    { companyCode: d.companyCode, personId: d.personId },
    { $set: { ...d, updatedAt: now } },
    { upsert: true },
  )
}

export async function loadDraft(companyCode: string, personId: string): Promise<Draft | null> {
  const col = await getCollection<Draft>(DRAFTS_COLLECTION)
  return col.findOne({ companyCode, personId })
}

export async function clearDraft(companyCode: string, personId: string): Promise<void> {
  const col = await getCollection<Draft>(DRAFTS_COLLECTION)
  await col.deleteOne({ companyCode, personId })
}

/** Jedna položka súhrnu — predmet a kto písal, nikdy text (D207). */
export interface DigestItem {
  threadId: string
  subject: string
  from: string
}

export interface PendingDigest {
  personId: string
  email: string
  name: string
  items: DigestItem[]
}

/**
 * Komu ísť ranný súhrn (D207): osoby s neprečítaným vláknom, ktoré ešte
 * v súhrne nebolo (`digestedAt: null`). Jeden beh vezme najviac `limit` osôb;
 * zvyšok dobehne ďalší beh, lebo odoslané sa označia.
 */
export async function pendingDigests(companyCode: string, limit = 100): Promise<PendingDigest[]> {
  const col = await threads()
  const rows = await col
    .find({ companyCode, unreadFor: { $ne: [] }, participants: { $elemMatch: { digestedAt: null } } })
    .sort({ lastMessageAt: -1 })
    .limit(2000)
    .toArray()
  const byPerson = new Map<string, PendingDigest>()
  for (const t of rows) {
    for (const p of participantsOf(t)) {
      if (p.digestedAt !== null || !(t.unreadFor ?? []).includes(p.personId)) continue
      const entry = byPerson.get(p.personId) ?? { personId: p.personId, email: p.email, name: p.name, items: [] }
      entry.items.push({ threadId: String(t._id), subject: t.subject, from: t.lastMessage?.authorName ?? t.createdBy.name })
      byPerson.set(p.personId, entry)
    }
  }
  return [...byPerson.values()].slice(0, limit)
}

/** Po odoslaní súhrnu: tieto vlákna už tejto osobe v súhrne boli. */
export async function markDigested(companyCode: string, personId: string, threadIds: string[], now: Date = new Date()): Promise<void> {
  const ids = threadIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
  if (!ids.length) return
  const col = await threads()
  await col.updateMany(
    { companyCode, _id: { $in: ids }, "participants.personId": personId },
    { $set: { "participants.$[me].digestedAt": now } },
    { arrayFilters: [{ "me.personId": personId }] },
  )
}

/** „Prečítalo 45 zo 120" (D206): príjemcovia, ktorí oznam otvorili po poslednej správe. */
export function readStats(thread: Thread): { read: number; total: number } {
  const recipients = participantsOf(thread).filter(p => p.personId !== thread.createdBy.personId)
  const read = recipients.filter(p => p.lastReadAt && p.lastReadAt.getTime() >= thread.lastMessageAt.getTime()).length
  return { read, total: recipients.length }
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
