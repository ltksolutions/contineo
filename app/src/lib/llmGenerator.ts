/**
 * llmGenerator.ts
 * Generovanie finálnej odpovede z chunkov kontextu.
 *
 * Voľba modelu je vecou PROFILU TENANTA, nie tohto súboru (ADR-001).
 * Tu zostáva len to, čo je spoločné pre všetky adaptéry:
 *   - zostavenie systémového promptu
 *   - SSE obálka pre Next.js Route Handler
 *   - buildSources() pre citácie v odpovedi
 *
 * Konkrétne volanie modelu rieši GenerationProvider:
 *   providers/generation/anthropic.ts  → natívne SDK, Citations + cache_control
 *   providers/generation/openai.ts     → vLLM / SGLang / Ollama
 */

import { ChunkResult } from "./mongoSearch"
import { getTenantProfile, defaultProfile } from "./tenantProfile"
import { getProviders } from "./providers/factory"
import { cost, EMPTY_TOKENS } from "./pricing"
import type { TokenCounts } from "./pricing"
import { GeneratedCitation, TenantProfile } from "./providers/types"

export interface GenerateOptions {
  query: string
  chunks: ChunkResult[]
  userRole: "public" | "internal"
  /** Voliteľné — keď chýba, použije sa predvolený profil. */
  companyCode?: string
  /** Voliteľné — keď je odovzdaný, nenačítava sa znova z DB. */
  profile?: TenantProfile
  /**
   * Trvanie fáz pred generovaním (ms). Posiela sa klientovi v `done`,
   * aby sa dalo povedať, ktorá časť reťaze zožrala čas — D9 meria
   * p95 po prvý token a bez rozpadu je to len jedno číslo bez príčiny.
   */
  casy?: Record<string, number>
}

// ── Zostavenie systémového promptu ──────────────────────────────────────────

function buildSystemPrompt(role: string, supportsCitations: boolean): string {
  return `Si inteligentný asistent portálu Contineo pre slovenský futbal.
Odpovedáš VÝLUČNE na základe poskytnutého kontextu.
Ak odpoveď nie je v kontexte, povedz to úprimne.
Jazyk: slovenčina. Tón: profesionálny, stručný.
${role === "internal" ? "Máš prístup aj k interným normám a dokumentom." : ""}
${supportsCitations
  ? "Zdroje sú pripojené ako dokumenty — cituj z nich priamo."
  : "Pri tvrdeniach uveď čísla zdrojov [1], [2]... podľa poradia v kontexte."}`
}

// ── Zostavenie citácií ───────────────────────────────────────────────────────

export function buildSources(chunks: ChunkResult[]) {
  return chunks.map((c, i) => ({
    index:       i + 1,
    title:       c.document?.title ?? "Neznámy zdroj",
    slug:        c.document?.slug,
    url:         c.document?.sourceUrl,
    articleRef:  c.articleRef ?? undefined,
    heading:     c.heading,
    // Prenesené na klienta, aby sa dal overiť únik interného obsahu (eval D9).
    accessLevel: c.accessLevel,
  }))
}

// ── Hlavný export – ReadableStream pre SSE ───────────────────────────────────

export function generateAnswer(opts: GenerateOptions): ReadableStream {
  const { query, chunks, userRole } = opts

  return new ReadableStream({
    async start(controller) {
      const encode = (data: object) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const profile =
          opts.profile ??
          (opts.companyCode
            ? await getTenantProfile(opts.companyCode)
            : defaultProfile())

        const { generation } = getProviders(profile)
        const system = buildSystemPrompt(userRole, generation.supportsCitations)

        // Overiteľné citácie zbierame zvlášť — pri OpenAI adaptéri
        // zostane pole prázdne a klient sa oprie o `sources`.
        const citations: GeneratedCitation[] = []
        let dovodUkoncenia = ""
        const tokeny: TokenCounts = { ...EMPTY_TOKENS }

        for await (const ev of generation.stream({
          system,
          query,
          chunks,
          maxTokens: profile.providers.generation.maxTokens,
        })) {
          if (ev.type === "text") {
            encode({ type: "token", token: ev.text })
          } else if (ev.type === "koniec") {
            dovodUkoncenia = ev.dovod
          } else if (ev.type === "tokeny") {
            // Zlučujeme, nie prepisujeme: vstup príde v prvej udalosti,
            // výstup až v poslednej. Prepis by jedno z toho zahodil.
            Object.assign(tokeny, ev.tokeny)
          } else {
            citations.push(ev.citation)
            encode({ type: "citation", citation: ev.citation })
          }
        }

        encode({
          type: "done",
          sources: buildSources(chunks),
          citations,
          model: generation.model,
          provider: generation.kind,
          verifiedCitations: generation.supportsCitations,
          casy: opts.casy,
          // "max_tokens" znamená useknutú odpoveď — klient to musí povedať
          // nahlas, inak si čitateľ odnesie neúplný záver ako úplný.
          dovodUkoncenia,
          tokeny,
          // Cena sa počíta TU a ukladá spolu s tokenmi. Je to historický
          // údaj: čo to stálo v deň, keď sa otázka položila. Spätne sa
          // nedopočíta, lebo cenníky sa menia — preto ide do záznamu aj
          // označenie použitého cenníka.
          naklad: cost(generation.model, tokeny),
        })
      } catch (err) {
        encode({ type: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })
}
