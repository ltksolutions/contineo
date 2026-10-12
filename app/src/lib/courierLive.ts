/**
 * courierLive.ts — živé udalosti Kuriéra pre jedno spojenie (ADR-033, D210, D211).
 *
 * Jedna slučka, jeden zdroj pravdy: **dotaz** (`poll()`), ktorý porovná stav
 * s tým, čo už spojenie videlo, a vráti rozdiel. Change stream Atlasu
 * (D211) slučku len **budí** — keď príde zmena vo vlákne alebo v účastníkoch
 * osoby, dotaz sa spustí hneď namiesto o 2 s. Keď `watch()` nie je
 * (lokálny Mongo bez repliky), ostane len časovač a obrazovky o rozdiele
 * nevedia. Tak nemôže vzniknúť stav, že change stream a polling vracajú
 * niečo iné: oba cesty vedú cez ten istý `poll()`.
 *
 * Generátor sa skončí po `maxMs` (spojenie na Verceli má limit) — prehliadač
 * (`EventSource`) sa pripojí znova sám.
 */

import { getCollection } from "./mongodb"
import {
  THREADS_COLLECTION, MESSAGES_COLLECTION, TYPING_MS,
  loadThread, messagesSince, participantsOf, unreadThreadCount,
  type Thread, type Message,
} from "./courier"

export type LiveEvent =
  | { type: "unread"; count: number }
  | { type: "message"; id: string; author: { personId: string; name: string }; text: string; at: string }
  | { type: "status"; others: { personId: string; name: string; typing: boolean; lastReadAt: string | null }[] }

/** Stav spojenia — čo už odišlo, aby odišiel len rozdiel. */
export interface LiveState {
  since: Date
  unread: number | null
  status: string | null
}

/** Stav ostatných účastníkov tak, ako ide klientovi; `now` rozhodne o „píše…". */
export function othersStatus(thread: Pick<Thread, "participants">, personId: string, now: Date): LiveEvent & { type: "status" } {
  return {
    type: "status",
    others: participantsOf(thread)
      .filter(p => p.personId !== personId)
      .map(p => ({
        personId: p.personId,
        name: p.name,
        typing: Boolean(p.typingAt && now.getTime() - p.typingAt.getTime() < TYPING_MS),
        lastReadAt: p.lastReadAt ? p.lastReadAt.toISOString() : null,
      })),
  }
}

export function messageEvent(m: Message): LiveEvent {
  return { type: "message", id: String(m._id), author: { personId: m.author.personId, name: m.author.name }, text: m.text, at: m.at.toISOString() }
}

/**
 * Jeden dotaz: počet neprečítaných, nové správy vlákna a stav ostatných.
 * Vráti len to, čo sa od minula zmenilo, a stav posunie.
 */
export async function poll(
  input: { companyCode: string; personId: string; threadId: string | null },
  state: LiveState,
  now: Date = new Date(),
): Promise<LiveEvent[]> {
  const out: LiveEvent[] = []
  const unread = await unreadThreadCount(input.companyCode, input.personId)
  if (unread !== state.unread) { state.unread = unread; out.push({ type: "unread", count: unread }) }
  if (!input.threadId) return out

  const fresh = await messagesSince(input.companyCode, input.threadId, state.since)
  for (const m of fresh) {
    out.push(messageEvent(m))
    if (m.at > state.since) state.since = m.at
  }
  const thread = await loadThread(input.companyCode, input.threadId, input.personId)
  if (thread) {
    const status = othersStatus(thread, input.personId, now)
    const key = JSON.stringify(status.others)
    if (key !== state.status) { state.status = key; out.push(status) }
  }
  return out
}

/**
 * Budík z change streamu (D211): sľub, ktorý sa splní pri prvej zmene, alebo
 * `null`, keď `watch()` nie je k dispozícii. Vráti aj `close()`.
 */
async function changeTrigger(
  input: { companyCode: string; personId: string; threadId: string | null },
  onChange: () => void,
): Promise<() => Promise<void>> {
  const closers: (() => Promise<void>)[] = []
  try {
    const threads = await getCollection<Thread>(THREADS_COLLECTION)
    // `updateLookup`: pri `update` je inak v udalosti len rozdiel, nie dokument,
    // a bez dokumentu sa nedá povedať, či sa zmena týka tejto osoby.
    const ts = threads.watch(
      [{ $match: { "fullDocument.companyCode": input.companyCode, "fullDocument.participants.personId": input.personId } }],
      { fullDocument: "updateLookup" },
    )
    ts.on("change", onChange)
    ts.on("error", () => { /* budík stíchne, časovač ostáva */ })
    closers.push(() => ts.close())
    if (input.threadId) {
      const messages = await getCollection<Message>(MESSAGES_COLLECTION)
      const ms = messages.watch([{ $match: { operationType: "insert", "fullDocument.companyCode": input.companyCode, "fullDocument.threadId": input.threadId } }])
      ms.on("change", onChange)
      ms.on("error", () => {})
      closers.push(() => ms.close())
    }
  } catch {
    // Bez repliky (lokálny Mongo) `watch()` padne hneď — polling stačí.
  }
  return async () => { for (const c of closers) await c().catch(() => {}) }
}

/**
 * Udalosti jedného spojenia. Prvý beh pošle aktuálny stav (počet, stav
 * ostatných), ďalšie len rozdiely. Skončí po `maxMs` alebo pri `signal`.
 */
export async function* liveEvents(
  input: { companyCode: string; personId: string; threadId: string | null },
  options: { signal?: AbortSignal; pollMs?: number; maxMs?: number; since?: Date } = {},
): AsyncGenerator<LiveEvent> {
  const pollMs = options.pollMs ?? 2_000
  const maxMs = options.maxMs ?? 55_000
  const state: LiveState = { since: options.since ?? new Date(), unread: null, status: null }
  const started = Date.now()

  let wake: (() => void) | null = null
  const close = await changeTrigger(input, () => { wake?.(); wake = null })
  try {
    while (!options.signal?.aborted && Date.now() - started < maxMs) {
      for (const e of await poll(input, state)) yield e
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { wake = null; resolve() }, pollMs)
        wake = () => { clearTimeout(timer); resolve() }
        options.signal?.addEventListener("abort", () => { clearTimeout(timer); resolve() }, { once: true })
      })
    }
  } finally {
    await close()
  }
}
