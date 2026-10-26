/**
 * lawSearch.ts — hľadanie v katalógu legislatívy pri odpovedi (ADR-039,
 * D258, D259).
 *
 * Katalóg je zdieľaný a bez `companyCode` (menovitá výnimka z D90,
 * `lawCatalog.ts`); **čo sa v ňom hľadá, určuje odber organizácie** — tu je
 * `companyCode` v podmienke ako všade inde. Predvolene sa hľadá v znení
 * účinnom v deň otázky; otázka k inému dňu dostane znenie účinné vtedy
 * (D258), rovnako ako knižnica (`searchScope()`).
 *
 * Výsledok má tvar úseku knižnice (`ChunkResult`), aby rerank, generovanie
 * a citácie išli tou istou cestou — ako pri živom zdroji (`liveSources.ts`).
 * Zlyhanie katalógu nikdy nezhodí odpoveď z knižnice: vráti sa prázdny
 * zoznam a príznak, ktorý stream pošle ako poznámku.
 */

import type { Document } from "mongodb"
import { getCollection } from "./mongodb"
import { rerankStages, type ChunkResult } from "./mongoSearch"
import {
  LAW_CHUNKS_COLLECTION, LAW_VERSIONS_COLLECTION, LAW_SOURCE_TYPE, effectiveVersions, lawSourceState, citationUrl, refOfActId,
  type LawActVersion, type LawChunk,
} from "./lawCatalog"
import { actNumber } from "./slovLex"
import { lawDocumentsFor } from "./lawLibraryLink"

export const LAW_VECTOR_INDEX = process.env.LAW_VECTOR_INDEX ?? "law_vector_index"
export const LAW_TEXT_INDEX = process.env.LAW_TEXT_INDEX ?? "law_text_index"

/** Kandidáti a koľko ich ide modelu — menej než knižnica (20/5): zákon je doplnok, nie hlavný zdroj. */
const LIMIT = 12
const RERANK_LIMIT = 4

export interface LawSearchInput {
  companyCode: string
  query: string
  /** Deň, ku ktorému sa pýta — znenie účinné vtedy (D258). */
  asOf: Date
  /**
   * `true` = človek si zdroj nevybral výslovne (bez piluliek) — hľadá sa len
   * keď má organizácia „používať predvolene". `false` = vybral ho.
   */
  byDefault: boolean
  useStageRerank: boolean
  rerankModel?: string
  vectorPath?: string
  /**
   * Koľko úsekov vrátiť; chýba = 4 ako na portáli. Nastavuje ho len MCP server
   * podľa organizácie (posuvník v AI asistentoch, ADR-038).
   */
  limit?: number
}

export interface LawSearchResult {
  chunks: ChunkResult[]
  /** Katalóg sa volal (organizácia má odber a zdroj bol na rade). */
  asked: boolean
  /** Zlyhal — odpoveď je bez neho (poznámka pod odpoveďou). */
  failed: boolean
}

type VersionHead = Pick<LawActVersion, "actId" | "timepoint" | "versionKey" | "effectiveFrom" | "effectiveTo" | "amendment" | "title">

/** Filter `$vectorSearch` — len znenia, ktoré sú na rade. Exportované pre test proti definícii indexu. */
export function lawVectorFilter(versionKeys: string[]): Document {
  return { versionKey: { $in: versionKeys }, sourceType: LAW_SOURCE_TYPE }
}

/** Klauzuly `compound.filter` pre `$search`. */
export function lawSearchFilterClauses(versionKeys: string[]): Document[] {
  return [{ in: { path: "versionKey", value: versionKeys } }, { equals: { path: "sourceType", value: LAW_SOURCE_TYPE } }]
}

/** Úsek katalógu → úsek pre odpoveď. Exportované kvôli testom. */
export function lawChunkToResult(c: LawChunk & { _id?: unknown; score?: number }, v: VersionHead): ChunkResult {
  const ref = refOfActId(v.actId)
  const url = citationUrl(ref, v.timepoint, c.articleRef)
  return {
    _id: String(c._id ?? `${c.versionKey}#${c.chunkIndex}`),
    text: c.text,
    documentId: `law:${v.actId}`,
    versionId: v.versionKey,
    accessLevel: "public",
    language: "sk",
    articleRef: c.articleRef ?? null,
    heading: c.heading,
    chunkIndex: c.chunkIndex,
    sourceType: LAW_SOURCE_TYPE,
    embeddingModel: c.embeddingModel,
    embeddingDim: c.embeddingDim,
    embeddingProvider: c.embeddingProvider,
    score: c.score,
    document: { title: v.title, slug: "", sourceUrl: url, category: "law" },
    // Znenie ako kópia (ako `attachVersions()` pri knižnici): o rok má byť jasné, z ktorého znenia odpoveď bola.
    version: { label: v.amendment ? `novela ${v.amendment}` : v.timepoint.replace(/^(\d{4})(\d{2})(\d{2})$/, "$3. $2. $1"), effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo },
    law: { actId: v.actId, number: actNumber(ref), timepoint: v.timepoint, url },
  }
}

/** Znenia odoberaných predpisov účinné k danému dňu. */
async function versionsAsOf(actIds: string[], asOf: Date): Promise<VersionHead[]> {
  const all = await (await getCollection<LawActVersion>(LAW_VERSIONS_COLLECTION))
    .find({ actId: { $in: actIds } }, { projection: { actId: 1, timepoint: 1, versionKey: 1, effectiveFrom: 1, effectiveTo: 1, amendment: 1, title: 1 } })
    .toArray()
  return effectiveVersions(all, asOf)
}

export async function lawSearch(input: LawSearchInput): Promise<LawSearchResult> {
  try {
    const state = await lawSourceState(input.companyCode)
    if (!state.active) return { chunks: [], asked: false, failed: false }
    if (input.byDefault && !state.defaultOn) return { chunks: [], asked: false, failed: false }

    // Zákon, ktorý má organizácia zverejnený v knižnici, odpovedá z knižnice
    // (schválené znenie, D260) — z katalógu by prišiel druhýkrát.
    const inLibrary = await lawDocumentsFor(input.companyCode, state.actIds, input.asOf)
    const actIds = state.actIds.filter(id => !inLibrary.get(id)?.published)
    if (!actIds.length) return { chunks: [], asked: true, failed: false }
    const versions = await versionsAsOf(actIds, input.asOf)
    if (!versions.length) return { chunks: [], asked: true, failed: false }
    const keys = versions.map(v => v.versionKey)
    const resultCount = input.limit ?? RERANK_LIMIT
    const byKey = new Map(versions.map(v => [v.versionKey, v]))

    const pipeline: Document[] = [
      {
        $rankFusion: {
          input: {
            pipelines: {
              vector: [{
                $vectorSearch: {
                  index: LAW_VECTOR_INDEX, path: input.vectorPath ?? "text", query: input.query,
                  numCandidates: LIMIT * 10, limit: LIMIT * 2, filter: lawVectorFilter(keys),
                },
              }],
              fulltext: [
                {
                  $search: {
                    index: LAW_TEXT_INDEX,
                    compound: {
                      must: [{ text: { query: input.query, path: "text", fuzzy: { maxEdits: 1, prefixLength: 3 } } }],
                      filter: lawSearchFilterClauses(keys),
                    },
                  },
                },
                { $limit: LIMIT * 2 },
              ],
            },
          },
          combination: { weights: { vector: 0.6, fulltext: 0.4 } },
        },
      },
      ...rerankStages({ useStageRerank: input.useStageRerank, rerankModel: input.rerankModel, query: input.query }, Math.max(LIMIT, resultCount * 3), resultCount),
      ...(input.useStageRerank ? [] : [{ $limit: Math.max(LIMIT, resultCount * 3) }]),
      {
        $project: {
          text: 1, versionKey: 1, actId: 1, timepoint: 1, chunkIndex: 1, heading: 1, articleRef: 1, chunkType: 1,
          embeddingModel: 1, embeddingDim: 1, embeddingProvider: 1,
          score: { $meta: "score" },
        },
      },
    ]
    const rows = await (await getCollection<LawChunk>(LAW_CHUNKS_COLLECTION)).aggregate<LawChunk & { _id: unknown; score?: number }>(pipeline).toArray()
    const chunks = rows.flatMap(r => { const v = byKey.get(r.versionKey); return v ? [lawChunkToResult(r, v)] : [] })
    return { chunks, asked: true, failed: false }
  } catch (e) {
    console.error("[legislativa] hľadanie v katalógu zlyhalo:", e)
    return { chunks: [], asked: true, failed: true }
  }
}
