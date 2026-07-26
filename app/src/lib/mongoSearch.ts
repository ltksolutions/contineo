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
  /**
   * Cesta pre $vectorSearch. Pri Automated Embedding je to TEXTOVÉ pole
   * ("text"), pri vlastných vektoroch pole s vektorom ("embedding").
   * Predvolene "text" — zodpovedá cloudovému režimu.
   */
  vectorPath?: string
  /**
   * Pridať $rerank stage do agregačnej pipeline (ADR-001).
   * true  = cloud, Atlas rieši reranking sám (kind: "atlas-stage")
   * false = on-prem, rerank spraví aplikačná vrstva cez adaptér
   * Predvolene true — zachováva doterajšie správanie.
   */
  useStageRerank?: boolean
  /**
   * Model pre $rerank. Stage ho vyžaduje ako povinné pole — bez neho
   * server odmietne spec. Berie sa z profilu tenanta.
   */
  rerankModel?: string
  accessLevel: "public" | "internal" | "all"
  limit?: number
  rerankLimit?: number
  // Optional domain filtering (Model B) — activated together with identity (ISSF).
  // When omitted, search behaves exactly as before.
  companyCodes?: string[]   // e.g. ["SsFZ", "SFZ"]
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
  companyCode?: string
  scope?: "global" | "company" | "region"
  accessLevel?: string          // public | internal — visibility / RBAC
  language?: string
  // content
  articleRef?: string | null
  heading?: string
  chunkIndex?: number
  tags?: string[]
  // vector — identita vektorového priestoru (ADR-001, sekcia 4)
  embeddingModel?: string       // ktorý model vektor vyrobil — POVINNÉ na nových chunkoch
  embeddingDim?: number         // kontrola pri zápise aj čítaní
  embeddingProvider?: string    // atlas-auto | tei | infinity
  embeddedAt?: string | Date    // pre plánovanie re-embedu
  // state
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

/**
 * Názov metadáta so skóre sa líši podľa toho, čo pipeline vyprodukovalo:
 *
 *   $search        → "searchScore"
 *   $vectorSearch  → "vectorSearchScore"
 *   $rankFusion    → "score"
 *   $rerank        → "score"   (prebije predchádzajúce)
 *
 * Zlý názov nevráti nulu — server agregáciu odmietne. Preto to nie je
 * konštanta, ale parameter.
 */
type SkoreMeta = "searchScore" | "vectorSearchScore" | "score"

function lookupDocument(skoreMeta: SkoreMeta): Document[] { return [
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
  // Pozor na názov: `preserveNullAndEmptyArrays`, nie `...AndEmpty`.
  // Server neznámu voľbu neignoruje — celú agregáciu odmietne.
  { $unwind: { path: "$document", preserveNullAndEmptyArrays: true } },
  {
    $project: {
      text: 1, documentId: 1, versionId: 1,
      sectionKey: 1, companyCode: 1, scope: 1, accessLevel: 1, language: 1,
      articleRef: 1, heading: 1, chunkIndex: 1, tags: 1,
      embeddingModel: 1, isActive: 1, effectiveFrom: 1, effectiveTo: 1,
      document: 1,
      score: { $meta: skoreMeta }
    }
  }
] }

// ── Filters ──────────────────────────────────────────────────────────────────

/** MQL-style filter for $vectorSearch. */
function vectorFilter(opts: SearchOptions): Document {
  const filter: Document = {}
  if (opts.accessLevel === "public") filter.accessLevel = "public"
  if (opts.companyCodes?.length) filter.companyCode = { $in: opts.companyCodes }
  if (opts.sectionKey) filter.sectionKey = opts.sectionKey
  if (opts.onlyActive) filter.isActive = true
  return filter
}

/** compound.filter clauses for $search. */
function searchFilterClauses(opts: SearchOptions): Document[] {
  const clauses: Document[] = []
  if (opts.accessLevel === "public") clauses.push({ equals: { path: "accessLevel", value: "public" } })
  if (opts.companyCodes?.length) clauses.push({ in: { path: "companyCode", value: opts.companyCodes } })
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
    // fulltext nemá rerank stage — skóre pochádza priamo z $search
    ...lookupDocument("searchScore"),
  ]

  return collection.aggregate<ChunkResult>(pipeline).toArray()
}


/**
 * Zostaví $rerank stage (Atlas 8.3+), alebo prázdne pole pri on-prem režime.
 *
 * Tvar spec-u je overený proti serveru (`app/scripts/rerank_probe.mjs`),
 * nie prevzatý z dokumentácie — tá je pre tento stage neúplná. Konkrétne:
 *
 *   query              MUSÍ byť { text: "..." }, nie holý reťazec
 *   model              povinné
 *   path               povinné
 *   numDocsToRerank    povinné — koľko kandidátov sa prehodnotí
 *   index              NEPOVINNÉ — samostatný rerank index netreba zakladať
 *
 * Orezanie na finálny počet robí až samostatný $limit. Stage síce možno
 * pozná vlastný `limit`, ale spoliehať sa naň netreba — $limit je istota.
 */
function rerankStages(opts: SearchOptions, kandidatov: number, vysledkov: number): Document[] {
  if (opts.useStageRerank === false) return []
  return [
    {
      $rerank: {
        query: { text: opts.query },
        path: "text",
        model: opts.rerankModel ?? "rerank-2",
        numDocsToRerank: kandidatov,
      }
    },
    { $limit: vysledkov },
  ]
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
        path: opts.vectorPath ?? "text",
        query,                        // text → MongoDB auto-embed (Voyage AI)
        numCandidates: limit * 10,
        limit,
        ...(Object.keys(filter).length > 0 && { filter }),
      }
    },
    // Voyage reranker. Pri on-prem režime stage vynechávame — rerank
    // rieši aplikačná vrstva cez adaptér (ADR-001).
    ...rerankStages(opts, limit, rerankLimit),
    ...lookupDocument(opts.useStageRerank !== false ? "score" : "vectorSearchScore"),
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
                  path: opts.vectorPath ?? "text",
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
    // Voyage reranker. Pri on-prem režime stage vynechávame — rerank
    // rieši aplikačná vrstva cez adaptér (ADR-001).
    ...rerankStages(opts, limit, rerankLimit),
    ...lookupDocument("score"),
  ]

  return collection.aggregate<ChunkResult>(pipeline).toArray()
}
