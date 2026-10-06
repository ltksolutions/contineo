/**
 * chatStream.ts — vyhľadávanie a odpoveď asistenta ako SSE stream (ADR-028 krok 5).
 *
 * Do 6. 10. 2026 ležal celý postup v `/api/chat`. Widget pre cudzí systém
 * (D166) potrebuje to isté — klasifikáciu, úpravu otázky, rozsah znení,
 * hybridné hľadanie, rerank, generovanie — len s inou bránou (podpísaný
 * token namiesto prihlásenia) a zúženým rozsahom (priečinky kanála, D161).
 * Preto je postup tu a obe cesty ho volajú; brána zostáva v route.
 *
 * Stream otvára hneď (O20) a každú fázu hlási udalosťou `phase`; chyby po
 * otvorení idú udalosťou `error`. Komentáre pri krokoch sú pôvodné z route.
 */

import { classifyQuery }      from "./queryClassifier"
import { preprocessQuery }    from "./queryPreprocessor"
import { getCollection }      from "./mongodb"
import { fulltextSearch, vectorSearch, hybridSearch } from "./mongoSearch"
import { searchWithSubQueries } from "./subQuerySearch"
import type { SearchOptions } from "./mongoSearch"
import { searchScope, attachVersions } from "./searchVersions"
import { buildComparison } from "./comparison"
import type { ComparisonBrief } from "./versionContext"
import { detectQueryTime, resolveQueryTime, searchInstant, withoutTimePhrase } from "./queryTime"
import { generateAnswer }     from "./llmGenerator"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import type { TokenCounts } from "./pricing"
import { getTenantProfile }   from "./tenantProfile"
import { getProviders }       from "./providers/factory"
import { assertEmbeddingSpace, EmbeddingSpaceMismatchError } from "./embeddingGuard"
import { dictionary } from "./i18n"

export interface ChatStreamInput {
  companyCode: string
  query: string
  /** Jazyk prostredia. Veta „nič som nenašiel" je súčasť odpovede, nie chyba. */
  language?: string
  /** Úroveň prístupu pýtajúceho sa — filtruje úseky aj zapisuje sa k záznamu. */
  accessLevel: "public" | "internal"
  /** Kto sa pýta — do výkazu spotreby AI (D158). Kópia mena, nie odkaz. */
  usageActor: UsageActor
  useLLMClassifier?: boolean
  usePreprocessing?: boolean
  /** Zúženie rozsahu na priečinky knižnice — kanál helpdesku (D161). */
  narrow?: { folderIds?: string[] }
}

export function chatStream(input: ChatStreamInput): ReadableStream<Uint8Array> {
  const { companyCode, query, language, accessLevel, usageActor, narrow } = input
  const userRole = accessLevel
  const useLLMClassifier = input.useLLMClassifier ?? false
  const usePreprocessing = input.usePreprocessing ?? (process.env.PREPROCESSING_DEFAULT !== "false")

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
        //    Bez vlastného záznamu v `tenant_profiles` je to predvolený profil
        //    tej istej organizácie.
        const profile = await getTenantProfile(companyCode)
        const providers = getProviders(profile)
        // Spotreba pomocného modelu (úprava a klasifikácia otázky), D158.
        const utilityCfg = profile.providers.utility ?? profile.providers.generation
        const utilityUsage = (purpose: "query-rewrite" | "query-classify") =>
          (tokens: Partial<TokenCounts>, failed?: boolean) => {
            void recordAiUsage(usageRecord({
              actor: usageActor, purpose, provider: utilityCfg.kind, model: providers.utility.model,
              keySource: utilityCfg.keySource ?? null, tokens, failed,
            }))
          }

        // 4. Klasifikácia dotazu (predvolene heuristika, bez volania modelu)
        phase("reading")
        // Bez časového údaja: dátum nie je obsah otázky a klasifikátor by rok
        // vzal za kód normy a poslal otázku do fulltextu (krok 6).
        const contentQuery = withoutTimePhrase(query)
        const searchMode = await classifyQuery(contentQuery, useLLMClassifier, providers.utility, utilityUsage("query-classify"))
        measure("klasifikacia")

        // 5. [Voliteľne] preprocessing na lacnejšom utility modeli
        const shouldPreprocess = usePreprocessing && searchMode !== "fulltext"
        const now = new Date()
        const processed = shouldPreprocess
          ? await preprocessQuery(query, providers.utility, now, utilityUsage("query-rewrite"))
          : { rewritten: contentQuery, subQueries: [], keywords: [], time: null }
        // Ku ktorému dňu sa otázka pýta (krok 6). Pravidlá bežia vždy — aj pri
        // krátkej a fulltextovej otázke, kde prepis modelom nebeží; model
        // doplní len to, čo pravidlá nenašli.
        const time = resolveQueryTime(detectQueryTime(query, now), processed.time, now)

        measure("preprocessing")

        const searchQuery = processed.rewritten

        // 6. Vyhľadávanie podľa módu.
        //    Profil rozhoduje, či rerank rieši databáza (Atlas $rerank stage)
        //    alebo aplikačná vrstva cez adaptér (on-prem).
        phase("searching")
        // Znenia platné dnes — raz na otázku, zdieľa ich aj rozklad na
        // podotázky. Otázku k inému dňu rozpozná až krok 6 plánu „znenia
        // v indexe"; dovtedy je to vždy dnešok.
        const scope = await searchScope(companyCode, searchInstant(time, now), now, narrow)
        measure("znenia")
        const collection = await getCollection("document_chunks")
        // Anotacia je nutna: bez nej TypeScript rozsiri accessLevel na `string`
        // (widening literal type v menitelnej vlastnosti objektu) a typ prestane sedet.
        const searchOpts: SearchOptions = {
          query: searchQuery, accessLevel, companyCode, limit: 20, rerankLimit: 5,
          useStageRerank: providers.rerank.isPipelineStage,
          rerankModel: profile.providers.rerank.model,
          vectorPath: profile.providers.embedding.vectorPath,
          versionIds: scope.versionIds,
          // Overené odpovede nemajú znenie — do porovnania znení nepatria (krok 7).
          verifiedAnswers: scope.verifiedAnswers && time.kind !== "compare",
        }

        // 6b. Podotázky z prepisu (najviac 3) bežia súbežne s hlavným
        //     hľadaním, nie po ňom (čas po prvý token, fáza 2).
        let chunks = await searchWithSubQueries(
          () =>
            searchMode === "fulltext" ? fulltextSearch(collection, searchOpts) :
            searchMode === "vector"   ? vectorSearch  (collection, searchOpts) :
                                        hybridSearch  (collection, searchOpts),
          processed.subQueries,
          sq => hybridSearch(collection, { ...searchOpts, query: sq, rerankLimit: 3 }),
        )

        // Pozor na pomenovanie: pri `atlas-stage` je $rerank stupňom agregačnej
        // pipeline, takže sa počíta TU, nie v kroku 6c. Kľúč to musí povedať,
        // inak z čísel vyjde, že rerank je zadarmo. Podotázky sú v tom istom
        // čase — bežia súbežne, samostatný kľúč by už nič nepovedal.
        measure(providers.rerank.isPipelineStage ? "vyhladavanie a rerank" : "vyhladavanie")

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

        // 6e. Porovnanie znení (krok 7): dokument s najlepším výsledkom, jeho
        //     dve znenia narezané nanovo a porovnané po článkoch. Keď sa
        //     porovnať nedá, odpovedá sa podľa dneška a štítok povie prečo.
        let comparison: ComparisonBrief | undefined
        let comparisonMeta: Record<string, unknown> | undefined
        let answerChunks = attachVersions(chunks, scope.versions)
        if (time.kind === "compare") {
          const top = chunks.find(c => c.sourceType !== "qa")
          const cmp = top
            ? await buildComparison(
                companyCode, top.documentId, now,
                time.since ? new Date(`${time.since}T12:00:00Z`) : undefined,
                chunks.filter(c => c.documentId === top.documentId && c.articleRef).map(c => c.articleRef as string),
              )
            : { ok: false as const, reason: "no-document" as const }
          measure("porovnanie")
          if (cmp.ok) {
            answerChunks = cmp.chunks
            comparison = {
              title: cmp.title, from: cmp.from, to: cmp.to,
              changes: cmp.changes.map(c => ({ ref: c.ref, heading: c.heading, kind: c.kind })),
              detailRefs: [...new Set(cmp.chunks.map(c => c.articleRef as string))],
            }
            comparisonMeta = {
              ok: true, title: cmp.title,
              from: { label: cmp.from.label, effectiveFrom: cmp.from.effectiveFrom },
              to: { label: cmp.to.label, effectiveFrom: cmp.to.effectiveFrom },
              changes: cmp.changes.length,
            }
          } else {
            comparisonMeta = { ok: false, reason: cmp.reason }
          }
        }

        // Ladiace údaje, ktoré boli do O20 hlavičkami odpovede.
        send({
          type: "meta",
          searchMode: searchMode,
          // Pred generovaním, aby štítok nad odpoveďou bol hneď (krok 6).
          time,
          comparison: comparisonMeta,
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
          /*
            Bez zdrojov sa odpoveď nezobrazuje vôbec a model sa nevolá
            (ASK, úloha 1). Dovtedy odtiaľto odchádzala veta „nenašiel som…"
            ako token — teda ako odpoveď s hlavičkou „z vašich dokumentov",
            hoci ju nič nekrylo. Contineo odpovedá z obsahu organizácie
            a s citáciou; odpoveď bez citácie je iný produkt. Klient si stav
            odvodí z prázdneho zoznamu zdrojov a prázdneho textu.
          */
          // `noVersions`: k tomuto dňu organizácia nemá žiadne platné znenie —
          // iná veta než „nič sa nenašlo" (napr. otázka na rok 1990).
          send({ type: "done", sources: [], model: "none", time, noVersions: scope.versionIds.length === 0 })
          controller.close()
          return
        }

        // 7. Generovanie odpovede (streaming SSE)
        phase("writing")
        // Znenie a účinnosť k úsekom — z toho istého načítania ako filter
        // hľadania, bez ďalšieho dotazu (krok 5).
        const inner = generateAnswer({
          query, chunks: answerChunks, userRole, profile, timings, language, asOf: scope.asOf, time, comparison,
          usage: usageActor,
        })
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

  return stream
}
