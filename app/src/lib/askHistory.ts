/**
 * askHistory.ts — história otázok človeka (ASK-historia-otazok, H1–H4).
 *
 * **Nová kolekcia sa nezakladá (H1).** Každá odpoveď už je v `evaluations`
 * (`recordAnswer()`), s osobou, ktorá sa pýtala. História je pohľad na ňu —
 * druhá kópia tej istej otázky by sa raz s prvou rozišla.
 *
 * **Kto sa pýtal:** `askedBy`, u starších záznamov `reviewer`, ale len kým
 * záznam nebol posúdený — posudok do `reviewer` zapíše hodnotiteľa
 * (`ratings.ts`, `askedBy`). Posúdené staršie záznamy sa preto v histórii
 * neukážu; ich autor sa už spätne nedá zistiť.
 *
 * **Skrytie nie je výmaz (H2):** × a „Vymazať celú históriu" nastavia
 * `hiddenForAsker`. Záznam pre hodnotenie kvality ostáva do konca lehoty
 * (`privacy.retention.answersMonths`), potom ho zmaže retencia.
 *
 * Organizácia aj osoba idú vždy z prihlásenia (D32) a sú v podmienke dotazu,
 * nie v kontrole nad ním (D90).
 */

import { ObjectId, type Filter } from "mongodb"
import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"
import { RATINGS_COLLECTION, type RatingRecord, type Verdict } from "./ratings"
import { distinctQuestions, matchesQuery } from "./askHistoryMatch"

export interface HistoryItem {
  id: string
  question: string
  createdAt: Date
  /** Počet citácií — „3 citácie". */
  citations: number
  /** „Nič sa nenašlo" — bez textu a bez zdrojov. */
  none: boolean
  /** Vlastné „sedí / nesedí". `undefined` = nepovedal nič. */
  readerVerdict?: Verdict
}

/** Záznamy osoby v jej histórii — vlastné, v jej organizácii, neskryté. */
export function askerFilter(companyCode: string, personId: string): Filter<RatingRecord> {
  return {
    companyCode: requireCompanyCode(companyCode, "askerFilter"),
    hiddenForAsker: { $ne: true },
    $or: [
      { askedBy: personId },
      // Staršie záznamy: `reviewer` je ten, kto sa pýtal, kým ho posudok
      // neprepíše na hodnotiteľa.
      { askedBy: { $exists: false }, reviewer: personId, evaluatedAt: { $exists: false } },
    ],
  }
}

let indexReady: Promise<unknown> | null = null
async function collection() {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  // Index pre „moje otázky, najnovšie hore" — bez neho by každé otvorenie
  // plachty prechádzalo celú kolekciu.
  indexReady ??= Promise.all([
    col.createIndex({ companyCode: 1, askedBy: 1, createdAt: -1 }, { name: "ask_history" }),
    col.createIndex({ companyCode: 1, reviewer: 1, createdAt: -1 }, { name: "ask_history_legacy" }),
  ]).catch(e => { indexReady = null; throw e })
  await indexReady
  return col
}

const PROJECTION = { question: 1, createdAt: 1, citations: 1, sources: 1, answer: 1, readerVerdict: 1 } as const

function toItem(r: Pick<RatingRecord, "_id" | "question" | "createdAt" | "citations" | "sources" | "answer" | "readerVerdict">): HistoryItem {
  return {
    id: String(r._id),
    question: r.question,
    createdAt: r.createdAt,
    citations: r.citations?.length ?? 0,
    none: !r.answer?.trim() && !(r.sources?.length),
    ...(r.readerVerdict !== undefined ? { readerVerdict: r.readerVerdict } : {}),
  }
}

/** Koľko záznamov sa pri hľadaní prejde najviac — hľadá sa v aplikácii. */
const SCAN_LIMIT = 2000

/**
 * História po stranách, najnovšie hore. `q` filtruje slová bez diakritiky
 * (AND) — v aplikácii, nie v databáze: regulárny výraz v Mongu diakritiku
 * neignoruje a textový index by bol na jednu obrazovku priveľa.
 */
export async function listHistory(
  companyCode: string,
  personId: string,
  opts: { q?: string; before?: Date; limit?: number } = {},
): Promise<{ items: HistoryItem[]; hasMore: boolean }> {
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 100))
  const col = await collection()
  const filter: Filter<RatingRecord> = {
    ...askerFilter(companyCode, personId),
    ...(opts.before ? { createdAt: { $lt: opts.before } } : {}),
  }
  const q = opts.q?.trim() ?? ""
  const cursor = col.find(filter, { projection: PROJECTION }).sort({ createdAt: -1 }).limit(q ? SCAN_LIMIT : limit + 1)
  const items: HistoryItem[] = []
  for await (const r of cursor) {
    if (q && !matchesQuery(r.question, q)) continue
    items.push(toItem(r))
    if (items.length > limit) break
  }
  return { items: items.slice(0, limit), hasMore: items.length > limit }
}

/** Plachta otázky: posledných päť rôznych otázok, pri písaní zúžených. */
export async function recentQuestions(companyCode: string, personId: string, q = "", limit = 5): Promise<HistoryItem[]> {
  const { items } = await listHistory(companyCode, personId, { q, limit: 50 })
  return distinctQuestions(items).slice(0, limit)
}

/**
 * Uložená odpoveď (`/ask/a/{id}`, H3): otvorí ju ten, kto sa pýtal, a rola
 * s prístupom k hodnoteniu; inak `null` (stránka odpovie 404). Skrytá
 * z histórie sa otvorí stále — skrytie je o zozname, nie o prístupe.
 */
export async function answerForViewer(
  companyCode: string,
  id: string,
  personId: string,
  canEvaluate: boolean,
): Promise<RatingRecord | null> {
  if (!ObjectId.isValid(id)) return null
  const col = await collection()
  const r = await col.findOne({ _id: new ObjectId(id), companyCode: requireCompanyCode(companyCode, "answerForViewer") })
  if (!r) return null
  if (canEvaluate) return r
  const asker = r.askedBy ?? (r.evaluatedAt ? undefined : r.reviewer)
  return asker === personId ? r : null
}

/** × v histórii — len vlastný záznam; `false`, keď taký nie je. */
export async function hideQuestion(companyCode: string, personId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const col = await collection()
  const r = await col.updateOne(
    { ...askerFilter(companyCode, personId), _id: new ObjectId(id) },
    { $set: { hiddenForAsker: true, hiddenAt: new Date() } },
  )
  return r.matchedCount === 1
}

/** „Vrátiť" po ×. */
export async function unhideQuestion(companyCode: string, personId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false
  const col = await collection()
  const filter = askerFilter(companyCode, personId)
  const r = await col.updateOne(
    { ...filter, hiddenForAsker: true, _id: new ObjectId(id) },
    { $unset: { hiddenForAsker: "", hiddenAt: "" } },
  )
  return r.matchedCount === 1
}

/**
 * „Vymazať celú históriu" — skryje všetko naraz s jedným časom, aby
 * „Vrátiť" vrátilo práve tieto a nie aj skôr skryté jednotlivo.
 */
export async function hideAll(companyCode: string, personId: string): Promise<{ count: number; at: Date }> {
  const col = await collection()
  const at = new Date()
  const r = await col.updateMany(askerFilter(companyCode, personId), { $set: { hiddenForAsker: true, hiddenAt: at } })
  return { count: r.modifiedCount, at }
}

export async function unhideAll(companyCode: string, personId: string, at: Date): Promise<number> {
  const col = await collection()
  const filter = askerFilter(companyCode, personId)
  const r = await col.updateMany(
    { ...filter, hiddenForAsker: true, hiddenAt: at },
    { $unset: { hiddenForAsker: "", hiddenAt: "" } },
  )
  return r.modifiedCount
}
