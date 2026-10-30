/**
 * unansweredQuestions.ts — otázky vo widgete, na ktoré sa nič nenašlo
 * (KANAL-statistika, 30. 10. 2026).
 *
 * Zodpovedaná otázka má záznam v `evaluations`, nezodpovedaná nemala nič:
 * pri „nenašlo sa" sa model nevolá, takže nie je ani v `ai_usage`. Bez
 * tohto počtu by štatistika kanála ukazovala 100 % zodpovedaných.
 *
 * **Len kanál a čas** — žiadne znenie otázky ani osoba. Na podiel
 * zodpovedaných stačí počet; otázka môže niesť osobné údaje (D158).
 * Prevádzkový údaj ako `ai_usage`, preto rovnakých 25 mesiacov (D159).
 *
 * Zápis nikdy nezhodí odpoveď — chýbajúci riadok je menšia škoda.
 */

import { getCollection } from "./mongodb"
import { AI_USAGE_RETENTION_DAYS } from "./aiUsage"

export const UNANSWERED_COLLECTION = "unanswered_questions"

export interface UnansweredQuestion {
  companyCode: string
  channelKey: string
  at: Date
}

let indexReady: Promise<unknown> | null = null
export async function unansweredCollection() {
  const col = await getCollection<UnansweredQuestion>(UNANSWERED_COLLECTION)
  indexReady ??= Promise.all([
    col.createIndex({ companyCode: 1, channelKey: 1, at: -1 }, { name: "unanswered_company_channel_at" }),
    col.createIndex({ at: 1 }, { name: "unanswered_ttl", expireAfterSeconds: AI_USAGE_RETENTION_DAYS * 24 * 3600 }),
  ]).catch(e => { indexReady = null; throw e })
  await indexReady
  return col
}

export async function recordUnanswered(companyCode: string, channelKey: string, at = new Date()): Promise<void> {
  try {
    await (await unansweredCollection()).insertOne({ companyCode, channelKey, at })
  } catch (e) {
    console.error("[widget] nezodpovedanú otázku sa nepodarilo zapísať:", e)
  }
}
