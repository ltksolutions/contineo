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

/** Kam smie overená odpoveď — odvodzuje sa, nikdy sa nezadáva (`curation.ts`). */
export type AccessLevel = "public" | "internal"

/** Stav kurácie na zázname o odpovedi. Zapisuje ho `lib/curation.ts`. */
export interface CurationState {
  state: "published" | "expired"
  /** Znenie otázky tak, ako ho pripravil hodnotiteľ — nie nutne doslovne to, čo niekto napísal. */
  question: string
  answer: string
  /** Dokumenty, z ktorých pár vznikol. Podľa nich sa archivuje, keď sa zmenia. */
  derivedFrom: string[]
  chunkId: string
  accessLevel: AccessLevel
  publishedAt: Date
  publishedBy: string
  expiredAt?: Date
  expiredBecause?: string
}

export interface RatingRecord {
  _id?: ObjectId

  /**
   * Organizácia, v ktorej otázka vznikla.
   *
   * Zapisuje sa **z prihlásenej osoby, nikdy z tela požiadavky** (D32).
   * Záznamy spred 2026-09-15 ho nemajú — do žiadnej fronty sa preto
   * nedostanú, a je to tak správne: bez neho sa nedá povedať, komu patria.
   */
  companyCode?: string

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

  /** Ako mala odpoveď znieť — podklad pre kuráciu. */
  verifiedAnswer?: string
  /** Správne predpisy a §, napr. „SP čl. 78". */
  correctSources?: string
  note?: string

  /**
   * „Nahlásiť nepresnosť" — čo na odpovedi nesedelo, slovami toho, kto sa
   * pýtal.
   *
   * **Vlastné pole, nie `note`.** `note` patrí hodnotiteľovi a ukladá sa pri
   * každom opustení poľa; keby doň písali obaja, neskorší zápis by prepísal
   * skorší — a prepísané by bolo práve hlásenie, teda jediná veta, kvôli
   * ktorej sa vôbec niekto namáhal niečo napísať.
   *
   * **Záznam sa nezakladá, dopisuje sa.** Otázka, odpoveď aj zdroje v ňom už
   * sú z `recordAnswer()`; vlastná kolekcia hlásení by bola druhá kópia toho
   * istého, ktorá sa raz s prvou rozíde.
   */
  readerNote?: string
  readerNoteAt?: Date
  /** Kto hlásil. Nepodpisuje sa ako `reviewer` — neposudzoval, oznámil. */
  readerNoteBy?: string
  /**
   * „Sedí / nesedí" od toho, kto sa pýtal. `null` = nepovedal nič.
   *
   * Je to **iná vec než `correct`**: `correct` je posudok hodnotiteľa, teda
   * človeka, ktorý predpisu rozumie. Zliať ich do jedného poľa by znamenalo,
   * že sa spätne nedá povedať, čí je ktorý — a presne to bola chyba, ktorú
   * táto rola opravuje.
   */
  readerVerdict?: Verdict

  /**
   * Kurácia — či sa z potvrdeného posudku stala overená odpoveď v indexe.
   *
   * Typ je tu, a nie v `curation.ts`, aby si obe strany nemuseli importovať
   * navzájom: pole patrí záznamu, logika patrí kurácii.
   */
  curation?: CurationState

  /**
   * Kedy a kto posudok **potvrdil alebo opravil**. Prítomnosť `evaluatedAt`
   * je zároveň príznak „vybavené" — podľa nej sa záznam odstráni z fronty.
   */
  evaluatedAt?: Date
  evaluatedBy?: string

  reviewer: string
  createdAt: Date
  updatedAt: Date
}

/** Údaje, ktoré prídu z prehliadača po dobehnutí odpovede. */
export interface NewRating {
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

export const RATINGS_COLLECTION = "evaluations"

/**
 * Založí záznam o odpovedi. Hodnotenie zatiaľ prázdne.
 *
 * Text odpovede aj citácie sa ukladajú celé zámerne — pri neskoršej zmene
 * chunkovania či modelu sa už tá istá odpoveď nedá zopakovať a bez nej by
 * bolo hodnotenie neoveriteľné.
 */
export async function recordAnswer(
  z: NewRating,
  reviewer: string,
  companyCode?: string
): Promise<string> {
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const now = new Date()

  const record: RatingRecord = {
    ...z,
    // Organizácia aj e-mail idú z prihlásenia, nie z tela požiadavky (D32).
    ...(companyCode ? { companyCode } : {}),
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
  evaluator: string
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false

  /*
   * Posudok smie písať **len držiteľ roly `evaluator`** — bránu drží API,
   * nie táto funkcia; tu sa zapisuje, kto ho napísal a kedy.
   *
   * `evaluatedAt` je zároveň príznak „vybavené": podľa neho sa záznam
   * odstráni z fronty. Preto sa nastavuje **pri každom** posudku, aj keď
   * hodnotiteľ len potvrdí, že odpoveď bola v poriadku.
   */
  const now = new Date()

  // Prepisujeme len to, čo naozaj prišlo. Bez tejto kontroly by kliknutie
  // na „správna" zmazalo predtým vyplnené overené znenie.
  const changes: Record<string, unknown> = {
    updatedAt: now, reviewer: evaluator, evaluatedAt: now, evaluatedBy: evaluator,
  }
  for (const key of [
    "correct", "hallucination", "verifiedAnswer", "correctSources", "note",
  ] as const) {
    if (edit[key] !== undefined) changes[key] = edit[key]
  }

  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const r = await col.updateOne({ _id: new ObjectId(id) }, { $set: changes })
  return r.matchedCount === 1
}

/** Najdlhšie hlásenie, ktoré sa uloží. Popis chyby, nie príloha. */
export const MAX_READER_NOTE = 2000

/**
 * Pripíše k **už existujúcemu** záznamu to, čo povedal čitateľ — „sedí /
 * nesedí" a prípadne, čo bolo zle.
 *
 * Zámerne nemení `updatedAt` ani `reviewer`. `setProgress()` radí záznamy tej
 * istej otázky podľa `updatedAt` a berie posledný — hlásenie čitateľa nie je
 * posudok a nesmie prehodiť, ktorý posudok platí. A `reviewer` hovorí, kto
 * odpoveď posúdil; ten, kto nahlásil chybu, ju neposúdil.
 *
 * Druhé hlásenie k tej istej odpovedi prepíše prvé. Je to tá istá odpoveď
 * a spravidla ten istý človek, ktorý sa opravuje — nie dvaja svedkovia.
 *
 * Vracia `false`, keď záznam neexistuje alebo je hlásenie prázdne.
 */
export interface ReaderFeedback {
  /** „Sedí / nesedí". `undefined` = človek sa k tomu nevyjadril. */
  verdict?: Verdict
  /** Čo bolo zle. Povinné pri „nesedí", inak nepovinné. */
  note?: string
}

export async function saveReaderFeedback(
  id: string,
  feedback: ReaderFeedback,
  person: string
): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false

  const changes: Record<string, unknown> = {}
  if (feedback.verdict !== undefined) changes.readerVerdict = feedback.verdict
  if (feedback.note !== undefined) {
    const text = feedback.note.trim().slice(0, MAX_READER_NOTE)
    if (text) {
      changes.readerNote = text
      changes.readerNoteAt = new Date()
      changes.readerNoteBy = person
    }
  }
  if (!Object.keys(changes).length) return false

  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const r = await col.updateOne({ _id: new ObjectId(id) }, { $set: changes })
  return r.matchedCount === 1
}
