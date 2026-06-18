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
import { generateAnswer }     from "@/lib/llmGenerator"

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

  const { query, useLLMClassifier = false, usePreprocessing = true } = body

  if (!query?.trim() || query.length > 1000) {
    return new Response("Neplatný dotaz (1–1000 znakov)", { status: 400 })
  }

  // 2. Autentifikácia – zistenie roly používateľa
  const token     = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const userRole  = token ? "internal" : "public"
  const accessLevel = userRole === "internal" ? "internal" : "public"

  // 3. Klasifikácia dotazu
  const searchMode = await classifyQuery(query, useLLMClassifier)

  // 4. [Voliteľne] LLM preprocessing
  const shouldPreprocess = usePreprocessing && searchMode !== "fulltext"
  const processed = shouldPreprocess
    ? await preprocessQuery(query)
    : { rewritten: query, subQueries: [], keywords: [] }

  const searchQuery = processed.rewritten

  // 5. Vyhľadávanie podľa módu
  const collection = await getCollection("rag_chunks")
  const searchOpts = { query: searchQuery, accessLevel, limit: 20, rerankLimit: 5 }

  let chunks = await (
    searchMode === "fulltext" ? fulltextSearch(collection, searchOpts) :
    searchMode === "vector"   ? vectorSearch  (collection, searchOpts) :
                                hybridSearch  (collection, searchOpts)
  )

  // 5b. Ak máme sub-queries, pridáme ďalšie výsledky (max 3 sub-queries)
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

  // 6. Generovanie odpovede (streaming SSE)
  const stream = generateAnswer({ query, chunks, userRole })

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
