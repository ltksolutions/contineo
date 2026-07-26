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
import { GeneratedCitation, TenantProfile } from "./providers/types"

export interface GenerateOptions {
  query: string
  chunks: ChunkResult[]
  userRole: "public" | "internal"
  /** Voliteľné — keď chýba, použije sa predvolený profil. */
  companyCode?: string
  /** Voliteľné — keď je odovzdaný, nenačítava sa znova z DB. */
  profile?: TenantProfile
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

        for await (const ev of generation.stream({
          system,
          query,
          chunks,
          maxTokens: profile.providers.generation.maxTokens,
        })) {
          if (ev.type === "text") {
            encode({ type: "token", token: ev.text })
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
        })
      } catch (err) {
        encode({ type: "error", message: err instanceof Error ? err.message : String(err) })
      } finally {
        controller.close()
      }
    },
  })
}
