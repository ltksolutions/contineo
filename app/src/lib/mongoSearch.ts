/**
 * mongoSearch.ts
 * Three search functions for MongoDB Atlas:
 *   - fulltextSearch  → $search (Atlas Search / Lucene)
 *   - vectorSearch    → $vectorSearch (Automated Embedding)
 *   - hybridSearch    → $rankFusion (RRF combination) + $rerank
 *
 * Canonical data model = Model B. See docs/DATA_MODEL_konzistencia.md.
 */

import type { Collection, Document } from "mongodb"

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
  /**
   * Zahrnúť aj preambuly (titulné strany, zoznamy novelizácií, osnovy).
   * Predvolene NIE — vytláčali z top-5 skutočné články, lebo sú všeobecné
   * a podobajú sa na každý dotaz. Viď audit_chunkov.mjs.
   */
  includePreamble?: boolean
  accessLevel: "public" | "internal" | "all"
  limit?: number
  rerankLimit?: number
  /**
   * Organizácia, v ktorej obsahu sa hľadá. **Povinné a vždy práve jedna** (D90).
   *
   * Tenanti sú oddelení galvanicky: vyhľadávanie nikdy nesiahne za hranicu
   * organizácie — ani na verejný obsah inej, ani na „zdieľaný". Predtým tu
   * bolo nepovinné `companyCodes?: string[]` a `/api/chat` ho nevyplnil,
   * takže prihlásený človek z ktorejkoľvek organizácie dostával odpovede
   * z interných úsekov všetkých. Chýbajúci filter nevyzerá ako chyba —
   * odpoveď je len „lepšia". Preto sa to nekontroluje v route, ale tu:
   * bez organizácie sa nehľadá vôbec (`tenantFilter()` vyhodí výnimku).
   */
  companyCode: string
  sectionKey?: string
  /**
   * Zahrnúť aj archivované verzie (isActive: false).
   *
   * PREDVOLENE NIE. Pôvodne tu bola opačná voľba `onlyActive`, ktorú ale
   * nikto nenastavoval — takže vyhľadávanie vracalo aj zrušené znenia
   * noriem. V normatívnej doméne je to najhorší možný tichý defekt:
   * odpoveď vyzerá správne, ale cituje predpis, ktorý už neplatí.
   *
   * Archivované verzie majú zmysel len pri otázke „ako to bolo v roku X“
   * (pravidlo R3), a tam sa to musí vyžiadať výslovne.
   */
  includeArchived?: boolean
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
  /**
   * `"qa"` = úsek nevznikol z dokumentu, ale z **overenej odpovede** (D11).
   * Bez tohto poľa by sa v zozname zdrojov nedal odlíšiť od článku normy —
   * a čitateľ by kurovanú odpoveď považoval za znenie predpisu.
   */
  sourceType?: string
  /** Dokumenty, z ktorých overená odpoveď vznikla. */
  derivedFrom?: string[]
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
type ScoreMeta = "searchScore" | "vectorSearchScore" | "score"

function lookupDocument(scoreMeta: ScoreMeta): Document[] { return [
  {
    $lookup: {
      from: "documents",
      localField: "documentId",
      // Pozor: `documentId`, NIE `_id`. V kolekcii `documents` je _id
      // automatické ObjectId, kým documentId je čitateľný kľúč typu
      // "sfz:stanovy". Pri porovnaní s _id sa nikdy nič nenašlo a názvy
      // dokumentov ostávali prázdne — bez chyby, len ticho.
      foreignField: "documentId",
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
      articleRef: 1, heading: 1, chunkIndex: 1, tags: 1, chunkType: 1,
      sourceType: 1, derivedFrom: 1,
      embeddingModel: 1, isActive: 1, effectiveFrom: 1, effectiveTo: 1,
      document: 1,
      score: { $meta: scoreMeta }
    }
  }
] }

// ── Filters ──────────────────────────────────────────────────────────────────

/** Vyhľadávanie bez organizácie — programátorská chyba, nie stav pre človeka. */
export class MissingTenantError extends Error {
  constructor() {
    super("mongoSearch: chýba companyCode — bez organizácie sa nehľadá (D90)")
    this.name = "MissingTenantError"
  }
}

/**
 * Organizácia pre filter. Vyhodí výnimku, keď chýba alebo je prázdna.
 *
 * Kontroluje sa aj za behu, nielen typom: skripty v `scripts/` sú `.mjs`
 * a typovú kontrolu neprejdú. Prázdny reťazec je rovnaká chyba ako
 * `undefined` — filter `companyCode: ""` by síce nič nevrátil, ale
 * podmienka `if (opts.companyCode)` by ho pri budúcej úprave ľahko
 * ticho vynechala.
 */
export function tenantFilter(opts: Pick<SearchOptions, "companyCode">): string {
  const code = typeof opts?.companyCode === "string" ? opts.companyCode.trim() : ""
  if (!code) throw new MissingTenantError()
  return code
}

/** MQL-style filter for $vectorSearch. */
export function vectorFilter(opts: SearchOptions): Document {
  // Organizácia ide do filtra ako prvá a bez podmienky (D90).
  const filter: Document = { companyCode: tenantFilter(opts) }
  if (opts.accessLevel === "public") filter.accessLevel = "public"
  if (opts.sectionKey) filter.sectionKey = opts.sectionKey
  if (!opts.includeArchived) filter.isActive = true
  return filter
}

/** compound.filter clauses for $search. */
export function searchFilterClauses(opts: SearchOptions): Document[] {
  // Organizácia ide do filtra ako prvá a bez podmienky (D90).
  const clauses: Document[] = [{ equals: { path: "companyCode", value: tenantFilter(opts) } }]
  if (opts.accessLevel === "public") clauses.push({ equals: { path: "accessLevel", value: "public" } })
  if (opts.sectionKey) clauses.push({ equals: { path: "sectionKey", value: opts.sectionKey } })
  if (!opts.includeArchived) clauses.push({ equals: { path: "isActive", value: true } })
  return clauses
}

// ── 1. Fulltext search ($search) ─────────────────────────────────────────────

export async function fulltextSearch(
  collection: Collection,
  opts: SearchOptions
): Promise<ChunkResult[]> {
  // POZOR na dve rôzne čísla: `limit` je koľko kandidátov sa vytiahne,
  // `rerankLimit` koľko ich ide do kontextu modelu. Fulltext sa tu dlho
  // orezával na `limit`, takže vracal 20 chunkov, kým hybrid a vector po
  // reranku 5. Štvornásobok kontextu podľa toho, čo usúdil klasifikátor —
  // a keďže to nikde nebolo vidieť, ticho by to skreslilo metriku hit@5
  // aj porovnanie ceny a latencie medzi módmi.
  const { query, limit = 10, rerankLimit = 5 } = opts
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
          filter: clauses,
        }
      }
    },
    ...withoutPreamble(opts),
    // Rerank tu zámerne NIE JE: fulltext slúži na presné výrazy, §
    // a kódy noriem, kde je poradie podľa BM25 to, čo chceme. Počet
    // výsledkov sa ale musí zhodovať s ostatnými módmi, inak sa výsledky
    // nedajú porovnať. Či to fulltextu stačí, ukážu hodnotenia — majú naň
    // desať otázok.
    { $limit: Math.min(limit, rerankLimit) },
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
/** Odfiltruje preambuly. Ide medzi vyhľadávanie a rerank, takže nepotrebuje
 *  filter v indexe — index sa nemusí prebudovať. */
function withoutPreamble(opts: SearchOptions): Document[] {
  return opts.includePreamble
    ? []
    : [{ $match: { chunkType: { $ne: "preambula" } } }]
}

function rerankStages(opts: SearchOptions, candidateCount: number, resultCount: number): Document[] {
  if (opts.useStageRerank === false) return []
  return [
    {
      $rerank: {
        query: { text: opts.query },
        path: "text",
        model: opts.rerankModel ?? "rerank-2",
        numDocsToRerank: candidateCount,
      }
    },
    { $limit: resultCount },
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
        filter,
      }
    },
    // Voyage reranker. Pri on-prem režime stage vynechávame — rerank
    // rieši aplikačná vrstva cez adaptér (ADR-001).
    ...withoutPreamble(opts),
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
                  filter,
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
                    filter: clauses,
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
    ...withoutPreamble(opts),
    ...rerankStages(opts, limit, rerankLimit),
    ...lookupDocument("score"),
  ]

  return collection.aggregate<ChunkResult>(pipeline).toArray()
}
