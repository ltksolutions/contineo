/**
 * ratings.ts — ukladanie odpovedí a ľudského posúdenia (D9).
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
import { requireCompanyCode } from "./tenantScope"
import type { AnswerSource, Citation } from "./sseClient"
import type { TokenCounts, Cost } from "./pricing"

/** Ľudský úsudok. `null` = zatiaľ neposúdené, čo je iný stav než 0. */
export type Verdict = 0 | 1 | null

/** Kam smie overená odpoveď — odvodzuje sa, nikdy sa nezadáva (`curation.ts`). */
export type AccessLevel = "public" | "internal"

/**
 * Stav kurácie na zázname o odpovedi. Zapisuje ho `lib/curation.ts`.
 *
 * Tri stavy, dvaja ľudia: **hodnotiteľ pripraví** znenie a vyberie úseky
 * predpisu (`draft`), **správca obsahu zverejní** (`published`), a keď
 * podkladová norma dostane nové znenie, pár sa archivuje (`expired`).
 *
 * Zverejnenie berie text **z tohto záznamu, nie z požiadavky**: kto
 * zverejňuje, schvaľuje to, čo napísal hodnotiteľ, a nemôže to cestou zmeniť.
 */
export interface CurationState {
  state: "draft" | "published" | "expired"
  /** Znenie otázky tak, ako ho pripravil hodnotiteľ — nie nutne doslovne to, čo niekto napísal. */
  question: string
  answer: string
  /** Úseky predpisu, z ktorých odpoveď vznikla. Pri zverejnení sa overia proti databáze. */
  chunkIds: string[]
  preparedAt: Date
  /** `persons.id` hodnotiteľa. Nie e-mail — viď poznámku pri `reviewer`. */
  preparedBy: string

  // ── až po zverejnení ──────────────────────────────────────────────────
  /** Dokumenty, z ktorých pár vznikol. Podľa nich sa archivuje, keď sa zmenia. */
  derivedFrom?: string[]
  chunkId?: string
  /** Odvodená úroveň — nikdy zadaná. Viď `strictestAccessLevel()`. */
  accessLevel?: AccessLevel
  publishedAt?: Date
  /** `persons.id` správcu obsahu. */
  publishedBy?: string
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
  /** Kto hlásil — `persons.id`. Nepodpisuje sa ako `reviewer`: neposudzoval, oznámil. */
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
  /** `persons.id` hodnotiteľa. */
  evaluatedBy?: string

  /**
   * Kto je za záznamom — **`persons.id`, nie e-mail** (O17, 2026-09-16).
   *
   * **Prečo tu odkaz stačí, a v `acknowledgements` nie.** Potvrdenie je dôkaz
   * o oboznámení so zäväzným predpisom a platí pri ňom „kópia, nie odkaz"
   * (D24): o rok musí byť čitateľné bez dohľadávania v kolekcii, ktorá sa
   * medzitým zmenila. **Tento záznam dôkaz nie je** — je to meranie kvality
   * odpovedí. Odkaz preto stačí a má vlastnosť, ktorú kópia nemá: keď osobu
   * z `persons` zmažeme, väzba zmizne s ňou. Presne to sa pri žiadosti
   * o výmaz očakáva (`GDPR_DATA_PROTECTION.md` kap. 3).
   *
   * **Chýbajúce pole znamená „nikto nebol prihlásený"** — verejný widget.
   * Externé identifikátory (Sportnet, Entra, Google) sem **nepatria**: sú na
   * `persons.externalRef` a osoba prihlásená cez cudzí systém sa zakladá
   * automaticky (D47), takže `personId` má. Dve miesta pre tú istú identitu
   * by sa raz rozšli.
   */
  reviewer?: string
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
  personId: string | null,
  companyCode: string
): Promise<string> {
  // Povinná (D90). Kým bola nepovinná, vznikali záznamy bez organizácie, ktoré
  // nepatrili do žiadnej fronty — a teda ich nikto nikdy neposúdil.
  const code = requireCompanyCode(companyCode, "recordAnswer")
  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const now = new Date()

  const record: RatingRecord = {
    ...z,
    // Organizácia aj osoba idú z prihlásenia, nie z tela požiadavky (D32).
    companyCode: code,
    correct: null,
    hallucination: null,
    // Chýbajúce pole = nikto prihlásený. Prázdny reťazec by bol tretí stav.
    ...(personId ? { reviewer: personId } : {}),
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
  evaluator: string,
  /** Organizácia hodnotiteľa — z relácie, nikdy z požiadavky (D90). */
  companyCode: string,
): Promise<boolean> {
  const code = requireCompanyCode(companyCode, "saveVerdict")
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
  // Organizácia v podmienke (D90): záznam inej organizácie sa tvári ako
  // neexistujúci. Do 2026-09-17 tu bolo len `_id` — hodnotiteľ ktorejkoľvek
  // organizácie zapísal posudok do cudzieho záznamu, keď poznal jeho ObjectId.
  const r = await col.updateOne({ _id: new ObjectId(id), companyCode: code }, { $set: changes })
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
  /** `persons.id`, alebo `null` pri neprihlásenom — vtedy sa podpis nezapisuje. */
  personId: string | null,
  /** Organizácia čitateľa — z relácie, nikdy z požiadavky (D90). */
  companyCode: string,
): Promise<boolean> {
  const code = requireCompanyCode(companyCode, "saveReaderFeedback")
  if (!ObjectId.isValid(id)) return false

  const changes: Record<string, unknown> = {}
  if (feedback.verdict !== undefined) changes.readerVerdict = feedback.verdict
  if (feedback.note !== undefined) {
    const text = feedback.note.trim().slice(0, MAX_READER_NOTE)
    if (text) {
      changes.readerNote = text
      changes.readerNoteAt = new Date()
      if (personId) changes.readerNoteBy = personId
    }
  }
  if (!Object.keys(changes).length) return false

  const col = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  // Organizácia v podmienke (D90) — rovnaký dôvod ako pri `saveVerdict()`.
  const r = await col.updateOne({ _id: new ObjectId(id), companyCode: code }, { $set: changes })
  return r.matchedCount === 1
}
