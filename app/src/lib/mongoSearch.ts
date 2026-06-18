/**
 * mongoSearch.ts
 * Tri search funkcie pre MongoDB Atlas:
 *   - fulltextSearch  → $search (Atlas Search / Lucene)
 *   - vectorSearch    → $vectorSearch (Automated Embedding)
 *   - hybridSearch    → $rankFusion (RRF kombinácia oboch) + $rerank
 */

import { Collection, Document } from "mongodb"

export interface SearchOptions {
  query: string
  accessLevel: "public" | "internal" | "all"
  limit?: number
  rerankLimit?: number
}

export interface ChunkResult {
  _id: string
  text: string
  document_id: string
  access_level: string
  chunk_index: number
  tags: string[]
  score?: number
  // z rag_documents cez $lookup
  document?: {
    title: string
    slug: string
    source_url?: string
    category: string
  }
}

// ── Spoločný $lookup a $project na koniec každého pipeline ───────────────────

const LOOKUP_DOCUMENT: Document[] = [
  {
    $lookup: {
      from: "rag_documents",
      localField: "document_id",
      foreignField: "_id",
      as: "document",
      pipeline: [
        { $project: { title: 1, slug: 1, source_url: 1, category: 1 } }
      ]
    }
  },
  { $unwind: { path: "$document", preserveNullAndEmpty: true } },
  {
    $project: {
      text: 1, document_id: 1, access_level: 1,
      chunk_index: 1, tags: 1, document: 1,
      score: { $meta: "searchScore" }
    }
  }
]

// ── Filter prístupu ──────────────────────────────────────────────────────────

function accessFilter(accessLevel: SearchOptions["accessLevel"]): Document {
  if (accessLevel === "all") return {}
  if (accessLevel === "internal") return {}  // interný vidí všetko
  return { access_level: "public" }
}

// ── 1. Fulltextové vyhľadávanie ($search) ────────────────────────────────────

export async function fulltextSearch(
  collection: Collection,
  opts: SearchOptions
): Promise<ChunkResult[]> {
  const { query, accessLevel, limit = 10 } = opts
  const filter = accessFilter(accessLevel)

  const pipeline: Document[] = [
    {
      $search: {
        index: "rag_text_index",
        compound: {
          must: [
            {
              text: {
                query,
                path: "text",
                fuzzy: { maxEdits: 1, prefixLength: 3 },
              }
            }
          ],
          // Filter access_level cez compound.filter (rýchlejší ako $match po $search)
          ...(Object.keys(filter).length > 0 && {
            filter: [
              { equals: { path: "access_level", value: "public" } }
            ]
          })
        }
      }
    },
    { $limit: limit },
    ...LOOKUP_DOCUMENT,
  ]

  return collection.aggregate<ChunkResult>(pipeline).toArray()
}

// ── 2. Vektorové vyhľadávanie ($vectorSearch) ────────────────────────────────

export async function vectorSearch(
  collection: Collection,
  opts: SearchOptions
): Promise<ChunkResult[]> {
  const { query, accessLevel, limit = 10, rerankLimit = 5 } = opts
  const filter = accessFilter(accessLevel)

  const pipeline: Document[] = [
    {
      $vectorSearch: {
        index: "rag_vector_index",
        path: "embedding",
        query,                        // text → MongoDB auto-embed (Voyage AI)
        numCandidates: limit * 10,
        limit,
        ...(Object.keys(filter).length > 0 && { filter }),
      }
    },
    // Voyage reranker pre zlepšenie relevancie
    {
      $rerank: {
        index: "rag_rerank_index",
        query,
        path: "text",
        limit: rerankLimit,
      }
    },
    ...LOOKUP_DOCUMENT,
  ]

  return collection.aggregate<ChunkResult>(pipeline).toArray()
}

// ── 3. Hybrid vyhľadávanie ($rankFusion) ─────────────────────────────────────

export async function hybridSearch(
  collection: Collection,
  opts: SearchOptions
): Promise<ChunkResult[]> {
  const { query, accessLevel, limit = 10, rerankLimit = 5 } = opts
  const filter = accessFilter(accessLevel)
  const accessFilter_ = Object.keys(filter).length > 0
    ? [{ equals: { path: "access_level", value: "public" } }]
    : []

  const pipeline: Document[] = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            // Vektorové – sémantika, prirodzený jazyk
            vector: [
              {
                $vectorSearch: {
                  index: "rag_vector_index",
                  path: "embedding",
                  query,
                  numCandidates: limit * 10,
                  limit: limit * 2,
                  ...(Object.keys(filter).length > 0 && { filter }),
                }
              }
            ],
            // Fulltextové – presná zhoda, kódy, paragrafy
            fulltext: [
              {
                $search: {
                  index: "rag_text_index",
                  compound: {
                    must: [
                      {
                        text: {
                          query,
                          path: "text",
                          fuzzy: { maxEdits: 1, prefixLength: 3 },
                        }
                      }
                    ],
                    ...(accessFilter_.length > 0 && { filter: accessFilter_ })
                  }
                }
              },
              { $limit: limit * 2 }
            ]
          }
        },
        // Váhy: vector má väčšiu váhu pre prirodzený jazyk SK
        combination: {
          weights: { vector: 0.6, fulltext: 0.4 }
        }
      }
    },
    // Voyage reranker na záver – preusporiada zlúčené výsledky
    {
      $rerank: {
        index: "rag_rerank_index",
        query,
        path: "text",
        limit: rerankLimit,
      }
    },
    ...LOOKUP_DOCUMENT,
  ]

  return collection.aggregate<ChunkResult>(pipeline).toArray()
}
