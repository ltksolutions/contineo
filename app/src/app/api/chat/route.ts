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
 * **Postup od klasifikácie po generovanie je v `lib/chatStream.ts`** (od
 * 6. 10. 2026, ADR-028 krok 5 — volá ho aj widget). Tu zostala brána:
 * pôvod, organizácia, osoba, platnosť otázky.
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
 *
 * **Organizácia je daná doménou a prihlásenou osobou, nikdy telom požiadavky**
 * (D29, D90). Kým to tak nebolo, route bežal na predvolenom profile a hľadal
 * bez `companyCode` — prihlásený človek z ktorejkoľvek organizácie dostával
 * odpovede z interných úsekov všetkých.
 */

import { NextRequest } from "next/server"

import { chatStream } from "@/lib/chatStream"
import type { UsageActor } from "@/lib/aiUsage"
import { onboardingContext }  from "@/lib/session"
import { sameOrigin } from "@/lib/sameOrigin"
import { accessLevelFor } from "@/lib/accessLevel"
import { connectorCallbackUrl } from "@/lib/mcp/callbackUrl"

// ── Typy ────────────────────────────────────────────────────────────────────

interface ChatRequest {
  query:              string
  /** Jazyk prostredia. Veta „nič som nenašiel" je súčasť odpovede, nie chyba. */
  language?:          string
  useLLMClassifier?:  boolean   // default: false (heuristika)
  usePreprocessing?:  boolean   // default: true pre vector/hybrid
  /** Rozsah z piluliek (ADR-029): `"library"` a/alebo id konektorov. */
  only?:              string[]
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 0. Pôvod (CSRF). Každá otázka spúšťa vyhľadávanie a jazykový model — za
  //    to sa platí — a zapisuje sa pod prihláseným. Cudzia stránka ju nemá
  //    vedieť poslať s jeho cookie. Viď `lib/sameOrigin.ts`.
  if (!sameOrigin(req.headers)) return new Response(null, { status: 403 })

  // 1. Organizácia a osoba (D29, D90). Rozhoduje doména a prihlásenie,
  //    nie nič, čo pošle klient. Ide to prvé, ešte pred čítaním tela: cudzia
  //    doména nemá z odpovede 400 zistiť, že tu endpoint je.
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") return new Response(null, { status: 404 })
  if (ctx.state === "not-signed-in") return new Response("not-signed-in", { status: 401 })
  if (ctx.state !== "ready") return new Response("not-in-tenant", { status: 403 })

  const companyCode = ctx.tenant.companyCode
  // Verejný režim (widget pre neprihlásených) zatiaľ neexistuje — proxy
  // `/api/chat` bez prihlásenia ani nepustí. Keď vznikne, bude mať vlastnú
  // cestu s tou istou organizáciou, nie vetvu podľa toho, či prišiel token.
  // Úroveň skladá `accessLevelFor()` — tá istá, ktorú `/api/rating` zapíše
  // do záznamu, aby metrika úniku merala to, podľa čoho sa filtrovalo.
  const userRole = accessLevelFor(ctx)
  // Kto sa pýta — do výkazu spotreby AI (D158). Kópia mena, nie odkaz.
  const usageActor: UsageActor = {
    companyCode, personId: ctx.person.id, personName: ctx.person.fullName, email: ctx.person.email,
  }

  // 2. Parsovanie a validácia
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

  /*
   * Od tejto chvíle sa už nič nevracia ako HTTP stav — stream sa otvára
   * hneď, aby prehliadač vedel, že sa pracuje. Chyby preto idú udalosťou
   * `error`; pred streamom zostalo len to, čo rozhoduje o prístupe
   * (organizácia, osoba) a o platnosti otázky.
   */
  const only = Array.isArray(body.only) ? body.only.filter((x): x is string => typeof x === "string").slice(0, 20) : undefined
  const stream = chatStream({
    companyCode, query, language, accessLevel: userRole, usageActor, useLLMClassifier, usePreprocessing,
    only, callbackUrl: await connectorCallbackUrl(),
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
