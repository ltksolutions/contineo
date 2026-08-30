/**
 * route.ts  →  /api/chat
 *
 * Hlavný RAG endpoint s hybrid search.
 * Flow:
 *   1. Validácia vstupu + autentifikácia
 *   2. Klasifikácia dotazu (heuristika / LLM)
 *   3. [Voliteľne] LLM preprocessing (rewriting, decomposition)
 *   4. Vyhľadávanie: fulltext | vector | hybrid (podľa klasifikátora)
 *   5. LLM generovanie odpovede (Ollama → Claude fallback, streaming SSE)
 *
 * Použitie:
 *   POST /api/chat
 *   Body: { query: string, useLLMClassifier?: boolean, usePreprocessing?: boolean }
 *   Headers: Authorization: Bearer <nextauth-token>  (pre internal prístup)
 */

import { NextRequest } from "next/server"
import { getToken }    from "next-auth/jwt"

import { classifyQuery }      from "@/lib/queryClassifier"
import { preprocessQuery }    from "@/lib/queryPreprocessor"
import { getCollection }      from "@/lib/mongodb"
import { fulltextSearch, vectorSearch, hybridSearch } from "@/lib/mongoSearch"
import type { SearchOptions } from "@/lib/mongoSearch"
import { generateAnswer }     from "@/lib/llmGenerator"
import { defaultProfile }     from "@/lib/tenantProfile"
import { getProviders }       from "@/lib/providers/factory"
import { assertEmbeddingSpace, EmbeddingSpaceMismatchError } from "@/lib/embeddingGuard"

// ── Typy ────────────────────────────────────────────────────────────────────

interface ChatRequest {
  query:              string
  useLLMClassifier?:  boolean   // default: false (heuristika)
  usePreprocessing?:  boolean   // default: true pre vector/hybrid
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parsovanie a validácia
  let body: ChatRequest
  try {
    body = await req.json()
  } catch {
    return new Response("Neplatný JSON", { status: 400 })
  }

  // Preprocessing stojí ~2,5 s PRED vyhľadávaním a platí sa zaň priamo
  // v čase po prvý token (D9: p95 < 2 s). Či za to stojí, ukáže až zlatá
  // sada — preto sa predvoľba dá prepnúť envom a obe konfigurácie zmerať
  // tou istou sadou. Predvolene zapnuté: meníme až podľa čísel, nie dojmu.
  const preprocessingDefault = process.env.PREPROCESSING_DEFAULT !== "false"
  const { query, useLLMClassifier = false, usePreprocessing = preprocessingDefault } = body

  if (!query?.trim() || query.length > 1000) {
    return new Response("Neplatný dotaz (1–1000 znakov)", { status: 400 })
  }

  // 2. Autentifikácia – zistenie roly používateľa
  const token     = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const userRole: "public" | "internal" = token ? "internal" : "public"
  const accessLevel: SearchOptions["accessLevel"] = userRole

  // Meranie fáz. D9 sleduje čas po prvý token (p95 < 2 s) a bez rozpadu
  // na fázy sa nedá povedať, čo ho vlastne zožralo — pri prvom behu to bolo
  // 9,6 s a podozrivých miest bolo päť.
  const timings: Record<string, number> = {}
  let mark = Date.now()
  const measure = (key: string) => {
    const now = Date.now()
    timings[key] = now - mark
    mark = now
  }

  // 3. Profil tenanta — určuje všetky tri adaptéry aj pomocný model.
  //    Zatiaľ predvolený; per-tenant sa načíta až s identitou.
  const profile = defaultProfile()
  const providers = getProviders(profile)

  // 4. Klasifikácia dotazu (predvolene heuristika, bez volania modelu)
  const searchMode = await classifyQuery(query, useLLMClassifier, providers.utility)
  measure("klasifikacia")

  // 5. [Voliteľne] preprocessing na lacnejšom utility modeli
  const shouldPreprocess = usePreprocessing && searchMode !== "fulltext"
  const processed = shouldPreprocess
    ? await preprocessQuery(query, providers.utility)
    : { rewritten: query, subQueries: [], keywords: [] }

  measure("preprocessing")

  const searchQuery = processed.rewritten

  // 6. Vyhľadávanie podľa módu.
  //    Profil rozhoduje, či rerank rieši databáza (Atlas $rerank stage)
  //    alebo aplikačná vrstva cez adaptér (on-prem).
  const collection = await getCollection("document_chunks")
  // Anotacia je nutna: bez nej TypeScript rozsiri accessLevel na `string`
  // (widening literal type v menitelnej vlastnosti objektu) a typ prestane sedet.
  const searchOpts: SearchOptions = {
    query: searchQuery, accessLevel, limit: 20, rerankLimit: 5,
    useStageRerank: providers.rerank.isPipelineStage,
  rerankModel: profile.providers.rerank.model,
    vectorPath: profile.providers.embedding.vectorPath,
  }

  let chunks = await (
    searchMode === "fulltext" ? fulltextSearch(collection, searchOpts) :
    searchMode === "vector"   ? vectorSearch  (collection, searchOpts) :
                                hybridSearch  (collection, searchOpts)
  )

  // Pozor na pomenovanie: pri `atlas-stage` je $rerank stupňom agregačnej
  // pipeline, takže sa počíta TU, nie v kroku 6c. Kľúč to musí povedať,
  // inak z čísel vyjde, že rerank je zadarmo.
  measure(providers.rerank.isPipelineStage ? "vyhladavanie a rerank" : "vyhladavanie")

  // 6b. Ak máme sub-queries, pridáme ďalšie výsledky (max 3 sub-queries)
  if (processed.subQueries.length > 0) {
    const subResults = await Promise.all(
      processed.subQueries.slice(0, 3).map(sq =>
        hybridSearch(collection, { ...searchOpts, query: sq, rerankLimit: 3 })
      )
    )
    // Zlúčenie – deduplikácia podľa _id
    const seen = new Set(chunks.map(c => String(c._id)))
    for (const results of subResults) {
      for (const chunk of results) {
        if (!seen.has(String(chunk._id))) {
          seen.add(String(chunk._id))
          chunks.push(chunk)
        }
      }
    }
    // Zachováme max 8 chunkov pre kontext
    chunks = chunks.slice(0, 8)
  }

  // 6c. Rerank v aplikačnej vrstve (on-prem). V cloude je to no-op —
  //     $rerank už zoradil výsledky v pipeline.
  if (!providers.rerank.isPipelineStage && chunks.length > 0) {
    const topK = profile.providers.rerank.topK ?? 8
    try {
      chunks = await providers.rerank.rerank(searchQuery, chunks, topK)
    } catch (err) {
      // Výpadok rerankera nesmie zhodiť odpoveď — vraciame poradie
      // z $rankFusion, len horšie zoradené. Zapíšeme do hlavičky.
      console.error("Rerank zlyhal, pokračujem s poradím z $rankFusion:", err)
      chunks = chunks.slice(0, topK)
    }
  }

  // Aplikačný rerank (on-prem). V cloude je tu nula — a to je správne,
  // lebo prácu už odviedla pipeline vyššie.
  if (!providers.rerank.isPipelineStage) measure("rerank")

  // 6d. Strážca vektorového priestoru (ADR-001, sekcia 4).
  //     Vektory z rôznych modelov sa nedajú miešať — pri nezhode by retrieval
  //     tíško vracal nezmysly. Radšej tvrdé zlyhanie než zlá odpoveď.
  try {
    assertEmbeddingSpace(chunks, profile.providers.embedding.model)
  } catch (err) {
    if (err instanceof EmbeddingSpaceMismatchError) {
      return new Response(err.message, { status: 500 })
    }
    throw err
  }

  if (chunks.length === 0) {
    // Žiadne výsledky – informujeme používateľa
    const emptyStream = new ReadableStream({
      start(c) {
        const enc = new TextEncoder()
        c.enqueue(enc.encode(
          `data: ${JSON.stringify({ type: "token", token: "Nenašiel som relevantné informácie k vašej otázke v dostupných dokumentoch." })}\n\n`
        ))
        c.enqueue(enc.encode(
          `data: ${JSON.stringify({ type: "done", sources: [], model: "none" })}\n\n`
        ))
        c.close()
      }
    })
    return sseResponse(emptyStream)
  }

  // 7. Generovanie odpovede (streaming SSE)
  const stream = generateAnswer({ query, chunks, userRole, profile, timings })

  return sseResponse(stream, {
    // Debug hlavičky (v produkcii odstrán)
    "X-Search-Mode":  searchMode,
    "X-Preprocessed": shouldPreprocess ? "true" : "false",
    "X-Chunks-Count": String(chunks.length),
  })
}

// ── SSE Response helper ──────────────────────────────────────────────────────

function sseResponse(
  stream: ReadableStream,
  extraHeaders: Record<string, string> = {}
) {
  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      ...extraHeaders,
    },
  })
}
