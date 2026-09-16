/**
 * route.ts  →  /api/chat
 *
 * Hlavný RAG endpoint s hybrid search.
 * Flow:
 *   1. Validácia vstupu + autentifikácia
 *   2. Klasifikácia dotazu (heuristika / LLM)
 *   3. [Voliteľne] LLM preprocessing (rewriting, decomposition)
 *   4. Vyhľadávanie: fulltext | vector | hybrid (podľa klasifikátora)
 *   5. LLM generovanie odpovede (predvolene Anthropic, streaming SSE)
 *
 * **Kroky 2–4 bežia vnútri streamu (O20, 2026-09-16).** Predtým sa `Response`
 * vracal až po nich, takže prehliadač nedostal ani hlavičky — človek pozeral
 * na prázdnu kartu tri až päť sekúnd a nemal ako vedieť, či sa niečo deje.
 * Teraz sa stream otvorí hneď a každá fáza sa ohlási udalosťou `phase`.
 *
 * Fázy sa **posielajú, až keď naozaj začínajú**, a `ranking` sa neposiela
 * vôbec, keď rerank rieši agregačná pipeline (cloud). Hláška o práci, ktorá
 * sa nerobí, je to isté klamstvo ako pruh, ktorý dobehne do 100 % a stojí.
 *
 * **Čo sa tým stratilo:** hlavičky `X-Search-Mode`, `X-Preprocessed`
 * a `X-Chunks-Count` sa dajú nastaviť len pri vzniku odpovede, teda pred
 * vyhľadávaním. Rovnaké údaje preto chodia udalosťou `meta`. Nepoužíval ich
 * nikto v repozitári, ale pri ladení cez `curl` sú stále vidieť.
 *
 * **A čo sa tým zmenilo:** nezhoda vektorového priestoru už nie je HTTP 500,
 * ale udalosť `error` v streame (hlavičky sú v tej chvíli dávno odoslané).
 * Klient ju zobrazí rovnako — `askQuestion` `error` pozná odjakživa.
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
import { dictionary } from "@/lib/i18n"

// ── Typy ────────────────────────────────────────────────────────────────────

interface ChatRequest {
  query:              string
  /** Jazyk prostredia. Veta „nič som nenašiel" je súčasť odpovede, nie chyba. */
  language?:          string
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
    return new Response("invalid-json", { status: 400 })
  }

  // Preprocessing stojí ~2,5 s PRED vyhľadávaním a platí sa zaň priamo
  // v čase po prvý token (prah p95 < 2 s). Či za to stojí, ukážu namerané
  // časy — preto sa predvoľba dá prepnúť envom a obe konfigurácie zmerať.
  // Predvolene zapnuté: meníme až podľa čísel, nie dojmu.
  const preprocessingDefault = process.env.PREPROCESSING_DEFAULT !== "false"
  const { query, language, useLLMClassifier = false, usePreprocessing = preprocessingDefault } = body

  if (!query?.trim() || query.length > 1000) {
    return new Response("invalid-query", { status: 400 })
  }

  // 2. Autentifikácia – zistenie roly používateľa
  const token     = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const userRole: "public" | "internal" = token ? "internal" : "public"
  const accessLevel: SearchOptions["accessLevel"] = userRole

  /*
   * Od tejto chvíle sa už nič nevracia ako HTTP stav — stream sa otvára
   * hneď, aby prehliadač vedel, že sa pracuje. Chyby preto idú udalosťou
   * `error`; jediné, čo zostalo pred streamom, je validácia a autentifikácia,
   * teda to, čo sa dá rozhodnúť bez jediného dotazu.
   */
  const enc = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      /** Nastaví sa, keď človek prestane čakať (`AbortController` v klientovi). */
      let closed = false

      const send = (event: unknown) => {
        if (closed) return
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Prerušené spojenie nie je chyba, len koniec záujmu.
          closed = true
        }
      }

      /**
       * Fáza sa hlási **pred** prácou, nie po nej — inak by sa človek dozvedel,
       * čo sa práve dorobilo, a nie na čo čaká.
       */
      const phase = (name: "reading" | "searching" | "ranking" | "writing") =>
        send({ type: "phase", phase: name })

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

      try {
        // 3. Profil tenanta — určuje všetky tri adaptéry aj pomocný model.
        //    Zatiaľ predvolený; per-tenant sa načíta až s identitou.
        const profile = defaultProfile()
        const providers = getProviders(profile)

        // 4. Klasifikácia dotazu (predvolene heuristika, bez volania modelu)
        phase("reading")
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
        phase("searching")
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
        //     $rerank už zoradil výsledky v pipeline. Preto sa fáza `ranking`
        //     hlási len tu: v cloude by to bola hláška o práci, ktorá nebeží.
        if (!providers.rerank.isPipelineStage && chunks.length > 0) {
          phase("ranking")
          const topK = profile.providers.rerank.topK ?? 8
          try {
            chunks = await providers.rerank.rerank(searchQuery, chunks, topK)
          } catch (err) {
            // Výpadok rerankera nesmie zhodiť odpoveď — vraciame poradie
            // z $rankFusion, len horšie zoradené.
            console.error("Rerank zlyhal, pokračujem s poradím z $rankFusion:", err)
            chunks = chunks.slice(0, topK)
          }
        }

        // Aplikačný rerank (on-prem). V cloude je tu nula — a to je správne,
        // lebo prácu už odviedla pipeline vyššie.
        if (!providers.rerank.isPipelineStage) measure("rerank")

        // Ladiace údaje, ktoré boli do O20 hlavičkami odpovede.
        send({
          type: "meta",
          searchMode: searchMode,
          preprocessed: shouldPreprocess,
          chunks: chunks.length,
        })

        // 6d. Strážca vektorového priestoru (ADR-001, sekcia 4).
        //     Vektory z rôznych modelov sa nedajú miešať — pri nezhode by retrieval
        //     tíško vracal nezmysly. Radšej tvrdé zlyhanie než zlá odpoveď.
        try {
          assertEmbeddingSpace(chunks, profile.providers.embedding.model)
        } catch (err) {
          if (err instanceof EmbeddingSpaceMismatchError) {
            send({ type: "error", message: err.message })
            controller.close()
            return
          }
          throw err
        }

        if (chunks.length === 0) {
          // Žiadne výsledky – informujeme používateľa
          send({ type: "token", token: dictionary(language).answer.noResults })
          send({ type: "done", sources: [], model: "none" })
          controller.close()
          return
        }

        // 7. Generovanie odpovede (streaming SSE)
        phase("writing")
        const inner = generateAnswer({ query, chunks, userRole, profile, timings })
        const reader = inner.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (closed) {
            await reader.cancel().catch(() => {})
            break
          }
          try {
            controller.enqueue(value)
          } catch {
            closed = true
            await reader.cancel().catch(() => {})
            break
          }
        }
        controller.close()
      } catch (err) {
        /*
         * Pred O20 by toto bolo HTTP 500. Hlavičky sú ale v tejto chvíli
         * odoslané, takže jediná cesta k človeku vedie cez stream. Podrobnosti
         * cudzej výnimky na obrazovku nepatria — tie zostávajú v logu.
         */
        console.error("[chat] odpoveď sa nepodarilo pripraviť:", err)
        send({ type: "error", message: dictionary(language).answer.failed })
        try {
          controller.close()
        } catch {
          // Stream už zavrel niekto iný.
        }
      }
    },

    cancel() {
      // Človek prestal čakať. Nič sa nedorába násilím — `send()` si toho
      // všimne pri najbližšom pokuse a stíchne.
    },
  })

  return sseResponse(stream)
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
