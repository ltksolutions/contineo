/**
 * helpdeskQuestions.ts — otázky z histórie helpdesku pre návrhy na doplnenie
 * manuálov (ADR-034, D220, D221).
 *
 * Do 14. 10. 2026 bola výstupom ťažby (ADR-030) fronta návrhov FAQ. FAQ
 * zaniklo; ťažba ukladá za tému zovšeobecnenú otázku a odpoveď helpdesku a
 * kontrola „Návrhy z helpdesku do manuálov" (`startHelpdeskReview`) z nich
 * navrhne, čo do manuálu doplniť. Pôvod (vlákna) sa neukladá — stačí téma
 * a počet vlákien (minimalizácia, odpovede DPO 9. 10. 2026).
 *
 * Nová ťažba otázky kanála nahradí. Beh kontroly si ich berie ako kópiu,
 * takže nahradenie ani zmazanie mu nič nevezme.
 */
import { randomBytes } from "node:crypto"
import { getCollection } from "./mongodb"
import { requireCompanyCode } from "./tenantScope"

export const HELPDESK_QUESTIONS_COLLECTION = "helpdesk_questions"

export interface HelpdeskQuestion {
  companyCode: string
  channelKey: string
  id: string
  topicKey: string
  topicLabel: string
  question: string
  answer: string
  /** Vlákna témy — dôležitosť otázky. */
  threads: number
  firstMonth: string | null
  lastMonth: string | null
  /** Dokumenty knižnice, o ktoré sa odpoveď opierala. */
  documentIds: string[]
  createdAt: Date
}

export type NewHelpdeskQuestion = Omit<HelpdeskQuestion, "companyCode" | "channelKey" | "id" | "createdAt">

async function col() {
  return getCollection<HelpdeskQuestion>(HELPDESK_QUESTIONS_COLLECTION)
}

export async function saveQuestions(companyCode: string, channelKey: string, list: NewHelpdeskQuestion[], now = new Date()): Promise<number> {
  const code = requireCompanyCode(companyCode, "saveQuestions")
  if (!list.length) return 0
  await (await col()).insertMany(list.map(q => ({ ...q, companyCode: code, channelKey, id: `q${randomBytes(6).toString("hex")}`, createdAt: now })))
  return list.length
}

/** Pred novou ťažbou — otázky kanála nahradí nová ťažba. */
export async function removeQuestions(companyCode: string, channelKey: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "removeQuestions")
  await (await col()).deleteMany({ companyCode: code, channelKey })
}

/** Otázky kanála od najčastejšej. */
export async function questionsFor(companyCode: string, channelKey: string): Promise<HelpdeskQuestion[]> {
  const code = requireCompanyCode(companyCode, "questionsFor")
  return (await col()).find({ companyCode: code, channelKey }, { projection: { _id: 0 } }).sort({ threads: -1, question: 1 }).toArray()
}

/** Počet otázok po kanáloch — karta na stránke Kontrola súladu. */
export async function questionCounts(companyCode: string): Promise<Map<string, number>> {
  const code = requireCompanyCode(companyCode, "questionCounts")
  const rows = await (await col()).aggregate<{ _id: string; n: number }>([{ $match: { companyCode: code } }, { $group: { _id: "$channelKey", n: { $sum: 1 } } }]).toArray()
  return new Map(rows.map(r => [r._id, r.n]))
}
