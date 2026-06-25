/**
 * mongoSearch.ts
 * Three search functions for MongoDB Atlas:
 *   - fulltextSearch  → $search (Atlas Search / Lucene)
 *   - vectorSearch    → $vectorSearch (Automated Embedding)
 *   - hybridSearch    → $rankFusion (RRF combination) + $rerank
 *
 * Canonical data model = Model B. See docs/DATA_MODEL_konzistencia.md.
 */

import { Collection, Document } from "mongodb"

export interface SearchOptions {
  query: string
  accessLevel: "public" | "internal" | "all"
  limit?: number
  rerankLimit?: number
  // Optional domain filtering (Model B) — activated together with identity (ISSF).
  // When omitted, search behaves exactly as before.
  associationCodes?: string[]   // e.g. ["SsFZ", "SFZ"]
  sectionKey?: string
  onlyActive?: boolean          // only the valid version (isActive: true)
}

export interface ChunkResult {
  _id: string
  text: string
  documentId: string
  versionId?: string
  // tagging / domain filtering
  sectionKey?: string
  associationCode?: string
  scope?: "global" | "association" | "region"
  accessLevel?: string          // public | internal — visibility / RBAC
  language?: string
  // content
  articleRef?: string | null
  heading?: string
  chunkIndex?: number
  tags?: string[]
  // vector + state
  embeddingModel?: string
  isActive?: boolean
  effectiveFrom?: string
  effectiveTo?: string
  score?: number
  // joined from `documents` via $lookup
  document?: {
    title: string
    slug: string
    sourceUrl?: string
    category: string
  }
}

// ── Shared $lookup + $project appended to every pipeline ─────────────────────

const LOOKUP_DOCUMENT: Document[] = [
  {
    $lookup: {
      from: "documents",
      localField: "documentId",
      foreignField: "_id",
      as: "document",
      pipeline: [
        { $project: { title: 1, slug: 1, sourceUrl: 1, category: 1 } }
      ]
    }
  },
  { $unwind: { path: "$document", preserveNullAndEmpty: true } },
  {
    $project: {
      text: 1, documentId: 1, versionId: 1,
      sectionKey: 1, associationCode: 1, scope: 1, accessLevel: 1, language: 1,
      articleRef: 1, heading: 1, chunkIndex: 1, tags: 1,
      embeddingModel: 1, isActive: 1, effectiveFrom: 1, effectiveTo: 1,
      document: 1,
      score: { $meta: "searchScore" }
    }
  }
]

// ── Filters ──────────────────────────────────────────────────────────────────

/** MQL-style filter for $vectorSearch. */
function vectorFilter(opts: SearchOptions): Document {
  const filter: Document = {}
  if (opts.accessLevel === "public") filter.accessLevel = "public"
  if (opts.associationCodes?.length) filter.associationCode = { $in: opts.associationCodes }
  if (opts.sectionKey) filter.sectionKey = opts.sectionKey
  if (opts.onlyActive) filter.isActive = true
  return filter
}

/** compound.filter clauses for $search. */
function searchFilterClauses(opts: SearchOptions): Document[] {
  const clauses: Document[] = []
  if (opts.accessLevel === "public") clauses.push({ equals: { path: "accessLevel", value: "public" } })
  if (opts.associationCodes?.length) clauses.push({ in: { path: "associationCode", value: opts.associationCodes } })
  if (opts.sectionKey) clauses.push({ equals: { path: "sectionKey", value: opts.sectionKey } })
  if (opts.onlyActive) clauses.push({ equals: { path: "isActive", value: true } })
  return clauses
}

// ── 1. Fulltext search ($search) ─────────────────────────────────────────────

export async function fulltextSearch(
  collection: Collection,
  opts: SearchOptions
): Promise<ChunkResult[]> {
  const { query, limit = 10 } = opts
  const clauses = searchFilterClauses(opts)

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
          // Filter via compound.filter (faster than $match after $search)
          ...(clauses.length > 0 && { filter: clauses })
        }
      }
    },
    { $limit: limit },
    ...LOOKUP_DOCUMENT,
  ]

  return collection.aggregate<ChunkResult>(pipeline).toArray()
}

// ── 2. Vector search ($vectorSearch) ─────────────────────────────────────────

export async function vectorSearch(
  collection: Collection,
  opts: SearchOptions
): Promise<ChunkResult[]> {
  const { query, limit = 10, rerankLimit = 5 } = opts
  const filter = vectorFilter(opts)

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
    // Voyage reranker for better relevance
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

// ── 3. Hybrid search ($rankFusion) ───────────────────────────────────────────

export async function hybridSearch(
  collection: Collection,
  opts: SearchOptions
): Promise<ChunkResult[]> {
  const { query, limit = 10, rerankLimit = 5 } = opts
  const filter = vectorFilter(opts)
  const clauses = searchFilterClauses(opts)

  const pipeline: Document[] = [
    {
      $rankFusion: {
        input: {
          pipelines: {
            // Vector — semantics, natural language
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
            // Fulltext — exact match, codes, articles
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
                    ...(clauses.length > 0 && { filter: clauses })
                  }
                }
              },
              { $limit: limit * 2 }
            ]
          }
        },
        // Weights: vector weighs more for natural-language SK queries
        combination: {
          weights: { vector: 0.6, fulltext: 0.4 }
        }
      }
    },
    // Voyage reranker — reorders the fused results
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
