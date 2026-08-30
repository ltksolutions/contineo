/**
 * hodnotenia.ts — ukladanie odpovedí a ľudského posúdenia (D9).
 *
 * Prečo to vôbec je: z metrík D9 vie skript spočítať všetko okrem dvoch
 * vecí — *správnosti odpovede* a *halucinácií*. Tie vyžadujú úsudok. Pôvodný
 * plán bol dať hodnotiteľovi Excel so 74 otázkami; jenže hárok bez systému
 * je abstraktná domáca úloha a odpovede z neho vychádzajú formálne.
 *
 * Preto sa zbierajú priamo tu: hodnotiteľ sa pýta, vidí odpoveď aj citácie
 * a rovno povie, či sedí. Zlatá sada tak vzniká používaním.
 *
 * Dôležité: záznam sa ukladá **hneď po odpovedi**, ešte pred hodnotením.
 * Automatické metriky (hit@5, latencia, únik interného obsahu) sa dajú
 * počítať aj z neohodnotených odpovedí, takže by bola škoda ich zahodiť len
 * preto, že hodnotiteľ nedoklikal.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import type { AnswerSource, Citation } from "./sseClient"
import type { TokenCounts, Cost } from "./pricing"

/** Ľudský úsudok. `null` = zatiaľ neposúdené, čo je iný stav než 0. */
export type Verdict = 0 | 1 | null

export interface RatingRecord {
  _id?: ObjectId

  /** Väzba na zlatú sadu, napr. „D9-001". Chýba pri voľnom dotaze. */
  questionId?: string

  question: string
  answer: string
  sources: AnswerSource[]
  citations: Citation[]

  // Technické údaje — bez nich sa nedajú porovnať dve konfigurácie.
  model: string
  provider: string
  verifiedCitations: boolean
  ttftMs: number | null
  totalMs: number
  timings?: Record<string, number>

  /**
   * Spotreba a cena. Ukladá sa oboje zámerne: cena je historický fakt,
   * ktorý sa po zmene cenníka nedopočíta, tokeny sú nemenné a dovolia
   * prepočet podľa nových sadzieb. `naklad.verziaCennika` hovorí, ktoré
   * sumy sa smú sčítavať.
   */
  tokens?: TokenCounts
  cost?: Cost

  // To, čo vie povedať len človek (D9, kapitola 3).
  correct: Verdict
  hallucination: Verdict

  /** Overené znenie odpovede — napĺňa `goldAnswer` v zlatej sade. */
  verifiedAnswer?: string
  /** Správne predpisy a §, napr. „SP čl. 78". Napĺňa `goldSources`. */
  correctSources?: string
  note?: string

  reviewer: string
  createdAt: Date
  updatedAt: Date
}

/** Údaje, ktoré prídu z prehliadača po dobehnutí odpovede. */
export interface NewRating {
  questionId?: string
  question: string
  answer: string
  sources: AnswerSource[]
  citations: Citation[]
  model: string
  provider: string
  verifiedCitations: boolean
  ttftMs: number | null
  totalMs: number
  timings?: Record<string, number>
  tokens?: TokenCounts
  cost?: Cost
}

/** Polia, ktoré smie hodnotiteľ meniť. Nič iné sa cez API prepísať nedá. */
export interface RatingEdit {
  correct?: Verdict
  hallucination?: Verdict
  verifiedAnswer?: string
  correctSources?: string
  note?: string
}

const RATINGS_COLLECTION = "evaluations"

/**
 * Založí záznam o odpovedi. Hodnotenie zatiaľ prázdne.
 *
 * Text odpovede aj citácie sa ukladajú celé zámerne — pri neskoršej zmene
 * chunkovania či modelu sa už tá istá odpoveď nedá zopakovať a bez nej by
 * bolo hodnotenie neoveriteľné.
 */
export async function recordAnswer(
  z: NewRating,
  reviewer: string
): Promise<string> {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const now = new Date()

  const record: RatingRecord = {
    ...z,
    correct: null,
    hallucination: null,
    reviewer: reviewer,
    createdAt: now,
    updatedAt: now,
  }

  const r = await col.insertOne(record)
  return String(r.insertedId)
}

/**
 * Doplní ľudské posúdenie.
 *
 * Vracia `false`, keď záznam neexistuje — volajúci to má ohlásiť, nie
 * ticho prejsť. Stratené hodnotenie je horšie než chybová hláška.
 */
export async function saveVerdict(
  id: string,
  edit: RatingEdit,
  reviewer: string
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false

  // Prepisujeme len to, čo naozaj prišlo. Bez tejto kontroly by kliknutie
  // na „správna" zmazalo predtým vyplnené overené znenie.
  const changes: Record<string, unknown> = { updatedAt: new Date(), reviewer }
  for (const key of [
    "correct", "hallucination", "verifiedAnswer", "correctSources", "note",
  ] as const) {
    if (edit[key] !== undefined) changes[key] = edit[key]
  }

  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const r = await col.updateOne({ _id: new ObjectId(id) }, { $set: changes })
  return r.matchedCount === 1
}

/** Koľko otázok zo zlatej sady je už posúdených — na ukazovateľ postupu. */
export async function setProgress(): Promise<Record<string, Verdict>> {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const records = await col
    .find(
      { questionId: { $exists: true } },
      { projection: { questionId: 1, correct: 1, updatedAt: 1 } }
    )
    .sort({ updatedAt: 1 })
    .toArray()

  // Pri opakovanom hodnotení tej istej otázky platí posledné.
  const state: Record<string, Verdict> = {}
  for (const z of records) if (z.questionId) state[z.questionId] = z.correct
  return state
}
