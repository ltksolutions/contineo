/**
 * curation.ts — overená odpoveď späť do znalostí (D11, kuračný cyklus).
 *
 * Hodnotiteľ potvrdí posudok a napíše, **ako mala odpoveď znieť**. Kurácia je
 * krok, ktorým sa to znenie stane vyhľadateľným: vloží sa do indexu ako úsek
 * so `sourceType: "qa"`.
 *
 * **Žiadna kolekcia `qa_pairs`** (revízia D11, rozhodnutie Jána Letka
 * 2026-09-15). Pravda o páre už je na zázname v `evaluations` — otázka,
 * `verifiedAnswer`, `correctSources`, kto a kedy to potvrdil. Vlastná
 * kolekcia by tie isté údaje uložila tretíkrát. Úsek v `document_chunks` nie
 * je druhá pravda, ale **premietnutie do indexu** — presne ten istý vzťah,
 * aký má dnes dokument a jeho úseky.
 *
 * **Nový pár nikdy potichu neprepíše schválený predpis.** Zverejnenie
 * *pridáva* úsek; žiadny úsek predpisu sa nemení ani nearchivuje. Opačný
 * smer platí tiež: keď predpis dostane nové znenie, páry z neho odvodené sa
 * archivujú (`expireCurationFor()`), aby overená odpoveď neprežila normu,
 * z ktorej vznikla.
 *
 * **Embedding sa nikde nepočíta.** `$vectorSearch` beží nad textovým poľom
 * (Atlas Automated Embedding), takže vložením úseku je pár vyhľadateľný.
 */

import { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { CHUNKS_COLLECTION } from "./libraryWrite"
import { RATINGS_COLLECTION } from "./ratings"
import type { RatingRecord, CurationState, AccessLevel } from "./ratings"
import { AppError } from "./appError"

export class CurationError extends AppError {}

/** Označenie úsekov, ktoré nevznikli z dokumentu, ale z overenej odpovede. */
export const QA_SOURCE_TYPE = "qa"

export type { CurationState, AccessLevel }

/**
 * Najprísnejšia úroveň zo zdrojov — jediné miesto, kde sa o prístupe k páru
 * rozhoduje.
 *
 * **Toto je bezpečnostná funkcia, nie pomôcka.** Overená odpoveď napísaná
 * nad interným predpisom je interná, aj keby vznikla popri desiatich
 * verejných. Preto:
 *
 *   • prázdny zoznam je `internal`, nie `public` — nevedieť znamená zavrieť;
 *   • neznáma hodnota (preklep, staré dáta, `null`) sa počíta ako `internal`;
 *   • `public` vyjde len vtedy, keď **každý** zdroj je výslovne `public`.
 *
 * Úroveň sa nikdy nezadáva ručne a nikdy neprichádza z prehliadača. Volajúci
 * načíta skutočné úseky z databázy a odovzdá ich hodnoty sem.
 */
export function strictestAccessLevel(levels: readonly (string | null | undefined)[]): AccessLevel {
  if (!levels.length) return "internal"
  return levels.every(l => l === "public") ? "public" : "internal"
}

export interface CurationInput {
  /** Znenie otázky. Hodnotiteľ ho smie upraviť — viď komentár nižšie. */
  question: string
  /** Overené znenie odpovede. */
  answer: string
  /** Úseky predpisov, z ktorých odpoveď vznikla. Identifikátory, nie obsah. */
  chunkIds: string[]
}

const MAX_QUESTION = 1000
const MAX_ANSWER = 4000

/** Úsek predpisu tak, ako ho kurácia potrebuje. */
interface SourceChunk {
  _id: ObjectId
  documentId?: string
  companyCode?: string
  accessLevel?: string
  sectionKey?: string
  language?: string
  scope?: string
}

/**
 * Zverejní overenú odpoveď ako úsek v indexe.
 *
 * Postupnosť je zámerná a nedá sa preskočiť:
 *
 *   1. záznam musí byť **posúdený** — kurovať neposúdenú odpoveď znamená
 *      vpustiť do znalostí niečo, čo nikto neoveril;
 *   2. zdrojové úseky sa načítajú **z databázy**, nie z toho, čo poslal
 *      prehliadač — z klienta prichádzajú len identifikátory;
 *   3. **každý** zdroj musí existovať a patriť tej istej organizácii; ak čo
 *      i len jeden chýba, zverejnenie zlyhá. Žiadne „zvyšok stačí";
 *   4. prístupová úroveň sa **odvodí** tou najprísnejšou stranou.
 *
 * Bod 3 je prísny naschvál: chýbajúci zdroj je jediný spôsob, ako by sa dala
 * úroveň odvodiť z menšej množiny, než z akej odpoveď naozaj vznikla.
 */
export async function publishCuration(
  recordId: string,
  input: CurationInput,
  person: string,
): Promise<CurationState> {
  if (!ObjectId.isValid(recordId)) {
    throw new CurationError("curation.unknownRecord", "Taký záznam o odpovedi neexistuje.")
  }

  const question = input.question.trim().slice(0, MAX_QUESTION)
  const answer = input.answer.trim().slice(0, MAX_ANSWER)
  if (!question || !answer) {
    throw new CurationError(
      "curation.empty",
      "Overená odpoveď aj otázka musia mať znenie — pár bez jedného z nich sa nedá nájsť ani použiť.",
    )
  }

  const ids = [...new Set(input.chunkIds)].filter(id => ObjectId.isValid(id))
  if (ids.length !== new Set(input.chunkIds).size || !ids.length) {
    throw new CurationError(
      "curation.noSources",
      "Vyber aspoň jeden úsek predpisu, z ktorého odpoveď vznikla. Bez zdrojov sa nedá určiť, kto ju smie vidieť.",
    )
  }

  const records = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const record = await records.findOne({ _id: new ObjectId(recordId) })
  if (!record) {
    throw new CurationError("curation.unknownRecord", "Taký záznam o odpovedi neexistuje.")
  }
  if (!record.evaluatedAt) {
    throw new CurationError(
      "curation.notEvaluated",
      "Odpoveď zatiaľ nikto neposúdil. Kurovať sa dá až potvrdené znenie.",
    )
  }
  const companyCode = record.companyCode
  if (!companyCode) {
    throw new CurationError(
      "curation.noTenant",
      "Záznam nemá organizáciu, takže sa nedá povedať, do koho znalostí by pár patril.",
    )
  }

  const chunkCol = await getCollection<SourceChunk>(CHUNKS_COLLECTION)
  const sources = await chunkCol
    .find({ _id: { $in: ids.map(id => new ObjectId(id)) } })
    .toArray()

  if (sources.length !== ids.length) {
    throw new CurationError(
      "curation.sourceMissing",
      "Niektorý z vybraných úsekov v knižnici nie je. Zverejnenie sa zastavilo — z neúplných zdrojov sa nedá bezpečne odvodiť prístup.",
    )
  }
  const foreign = sources.find(s => s.companyCode !== companyCode)
  if (foreign) {
    throw new CurationError(
      "curation.foreignSource",
      "Úsek patrí inej organizácii. Pár sa z neho odvodiť nedá (D32).",
    )
  }

  const accessLevel = strictestAccessLevel(sources.map(s => s.accessLevel))
  const derivedFrom = [...new Set(sources.map(s => s.documentId).filter((d): d is string => Boolean(d)))]
  if (!derivedFrom.length) {
    throw new CurationError(
      "curation.sourceMissing",
      "Zdrojové úseky nepatria žiadnemu dokumentu, takže by pár nemal z čoho expirovať.",
    )
  }

  const now = new Date()
  /*
   * Text úseku je otázka aj odpoveď spolu.
   *
   * Vyhľadáva sa nad ním celým, takže otázka v ňom nie je ozdoba — je to
   * práve tá formulácia, ktorou sa ľudia pýtajú, a vďaka nej pár nájde aj
   * ten, kto použije iné slová než norma.
   */
  const text = `Otázka: ${question}\n\nOverená odpoveď: ${answer}`

  const chunk = {
    text,
    heading: question,
    articleRef: null,
    chunkIndex: 0,
    chunkType: QA_SOURCE_TYPE,
    sourceType: QA_SOURCE_TYPE,
    /**
     * Pár sa pripína na prvý zdrojový dokument, aby mal v citácii názov —
     * `$lookup` v `mongoSearch.ts` ide práve cez `documentId`. `derivedFrom`
     * nesie všetky a rozhoduje o expirácii.
     */
    documentId: derivedFrom[0],
    derivedFrom,
    qaFrom: recordId,
    companyCode,
    accessLevel,
    sectionKey: sources[0].sectionKey,
    language: sources[0].language,
    scope: sources[0].scope,
    tags: [] as string[],
    embeddingModel: process.env.EMBEDDING_MODEL ?? "voyage-4",
    embeddingDim: Number(process.env.EMBEDDING_DIM ?? 1024),
    embeddingProvider: process.env.EMBEDDING_KIND ?? "atlas-auto",
    embeddedAt: now,
    isActive: true,
    effectiveFrom: now,
    effectiveTo: null,
    createdAt: now,
  }

  const inserted = await chunkCol.insertOne(chunk as never)

  const curation: CurationState = {
    state: "published",
    question,
    answer,
    derivedFrom,
    chunkId: String(inserted.insertedId),
    accessLevel,
    publishedAt: now,
    publishedBy: person,
  }
  await records.updateOne({ _id: new ObjectId(recordId) }, { $set: { curation } } as never)
  return curation
}

/**
 * Archivuje páry odvodené z dokumentu, ktorý dostal nové znenie (D11).
 *
 * **Archivuje, nemaže** — rovnako ako úseky predpisov (D6): do vyhľadávania
 * vstupujú len aktívne, ale otázka „čo sme odpovedali vlani" musí mať
 * odpoveď.
 *
 * Volá sa zo zverejnenia nového znenia. Zastaraná overená odpoveď je horšia
 * než žiadna: znie autoritatívne a odvoláva sa na text, ktorý už neplatí.
 */
export async function expireCurationFor(
  companyCode: string,
  documentId: string,
  when: Date = new Date(),
): Promise<number> {
  const chunkCol = await getCollection(CHUNKS_COLLECTION)
  const r = await chunkCol.updateMany(
    { companyCode, sourceType: QA_SOURCE_TYPE, derivedFrom: documentId, isActive: true } as never,
    { $set: { isActive: false, effectiveTo: when } },
  )
  if (r.modifiedCount === 0) return 0

  const records = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  await records.updateMany(
    { companyCode, "curation.state": "published", "curation.derivedFrom": documentId } as never,
    {
      $set: {
        "curation.state": "expired",
        "curation.expiredAt": when,
        "curation.expiredBecause": documentId,
      },
    } as never,
  )
  return r.modifiedCount
}
