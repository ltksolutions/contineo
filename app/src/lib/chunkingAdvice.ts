/**
 * chunkingAdvice.ts — návrh členenia od AI (editor členenia, krok C; ADR-027,
 * rozhodnutie Jána 5. 10. 2026: posiela sa **štruktúra**, nie celý text;
 * model z nastavenia „Odpovede asistenta"; posledný návrh sa ukladá pri dokumente).
 *
 * AI **len navrhuje**. Nič neuloží ani nezmení — návrh sa dá skúsiť skúšobným
 * rezom (krok B) a uloží sa až výberom profilu, rovnakou cestou ako ručne.
 *
 * Čo odchádza: nadpisy, riadky, ktoré vyzerajú ako časť / článok / § / bod /
 * príloha, a začiatky odsekov (60 znakov). Nie celé odseky — obsah predpisu
 * na návrh členenia netreba a zbytočne by ho posielal von.
 */

import Anthropic from "@anthropic-ai/sdk"
import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { aiForCompany } from "./aiSettings"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import { clampChunking } from "./tenantAdmin"
import { stripHeadingEmphasis } from "./chunker.mjs"
import { inspectChunking } from "./chunkingInspect"
import { AppError } from "./appError"
import type { ChunkingProfile } from "./chunkingProfile"

export class ChunkingAdviceError extends AppError {}

/** Koľko riadkov štruktúry najviac — pri Pracovnom poriadku ~250. */
export const OUTLINE_MAX_LINES = 400
const HEADING_CHARS = 120
const PARAGRAPH_CHARS = 60

export type AdviceStrategy = "articles" | "headings"
export type AdviceConfidence = "low" | "medium" | "high"

/** Posledný návrh — uložený pri dokumente (`documents.chunkingAdvice`). */
export interface ChunkingAdvice {
  at: Date
  by: string
  model: string
  strategy: AdviceStrategy
  values: ChunkingProfile
  confidence: AdviceConfidence
  reasoning: string
  issues: string[]
}

const STRUCTURAL = /^(#{1,6}\s|(?:Článok|čl\.|§|Bod|PRÍLOHA|Príloha|ČASŤ|Časť|PRVÁ|DRUHÁ|TRETIA|ŠTVRTÁ|PIATA|HLAVA|DIEL)\b)/
const NUMBERED_PARAGRAPH = /^(\(\d+\)|\d+\.|[a-z]\))\s/

/**
 * Štruktúra textu ako riadky pre model. Čistá funkcia.
 *
 * Nadpisy a štruktúrne riadky celé (do 120 znakov), z ostatného len začiatok
 * prvého riadku odseku — aby model videl, či sú odseky číslované, a nie obsah.
 * Prázdne riadky a tabuľky (`|`) sa vynechávajú; tabuľka sa ohlási raz.
 */
export function structureOutline(markdown: string): { lines: string[]; total: number; truncated: boolean } {
  const all = String(markdown ?? "").split(/\r?\n/).map(l => stripHeadingEmphasis(l.trim()))
  const out: string[] = []
  let inTable = false
  let afterBlank = true
  for (const l of all) {
    if (!l) { afterBlank = true; inTable = false; continue }
    if (l.startsWith("|")) {
      if (!inTable) out.push("[tabuľka]")
      inTable = true
      continue
    }
    inTable = false
    if (STRUCTURAL.test(l)) out.push(l.slice(0, HEADING_CHARS))
    else if (afterBlank || NUMBERED_PARAGRAPH.test(l)) out.push(`  ${l.slice(0, PARAGRAPH_CHARS)}${l.length > PARAGRAPH_CHARS ? "…" : ""}`)
    afterBlank = false
  }
  return {
    lines: out.slice(0, OUTLINE_MAX_LINES),
    total: all.filter(Boolean).length,
    truncated: out.length > OUTLINE_MAX_LINES,
  }
}

/** JSON schéma odpovede — model musí vrátiť presne toto. */
export const ADVICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["strategy", "articleWord", "annexWord", "minTokens", "maxTokens", "confidence", "reasoning", "issues"],
  properties: {
    strategy: { type: "string", enum: ["articles", "headings"] },
    articleWord: { type: "string" },
    annexWord: { type: "string" },
    minTokens: { type: "integer" },
    maxTokens: { type: "integer" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    reasoning: { type: "string" },
    issues: { type: "array", items: { type: "string" } },
  },
} as const

/*
 * Úvodzovky v zadaní sú „…“, nie „…" (5. 10. 2026): model napodobnil rovnú
 * uzatváraciu úvodzovku a tá v štruktúrovanom výstupe ukončila reťazec —
 * odôvodnenie sa uťalo na „…slovom „Článok" a nálezy prišli prázdne.
 */
export const ADVICE_SYSTEM = `Si odborník na členenie právnych a interných predpisov na úseky pre vyhľadávanie (RAG).
Dostaneš štruktúru dokumentu: nadpisy, riadky s časťami, článkami, paragrafmi, bodmi a prílohami a začiatky odsekov. Celý text nedostaneš.

Chunker funguje takto: každý článok je úsek; dlhý článok sa delí po odsekoch do cieľovej veľkosti; tabuľka sa nikdy nedelí. Článok rozpozná podľa slova na začiatku riadku nadpisu (napríklad „Článok 5 – Názov“, „§ 5“, „Bod 5“), aj s mriežkami Markdownu. Prílohu podľa slova prílohy.

Navrhni:
- strategy: "articles", ak má dokument články, paragrafy alebo body; "headings", ak ich nemá a dá sa deliť len podľa nadpisov (manuál, zápisnica, zmluva bez článkov);
- articleWord: slovo, ktorým začínajú nadpisy článkov presne tak, ako je v texte (Článok, §, Bod…);
- annexWord: slovo prílohy presne tak, ako je v texte;
- minTokens a maxTokens: cieľová veľkosť úseku (bežne 300–800; menšie pre krátke husté články, väčšie pre dlhé súvislé);
- confidence: ako veľmi si si istý;
- reasoning: 2–4 vety po slovensky, prečo;
- issues: krátky zoznam toho, čo v štruktúre nesedí (napríklad nejednotné nadpisy, veľké tabuľky, text pred prvým článkom). Prázdny, keď nič.
Hodnoty, ktoré netreba meniť, ponechaj presne také, aké má súčasný profil (sú v údajoch) — aj slovo prílohy.
Píš po slovensky, vecne, bez úvodu.
Úvodzovky v texte píš výhradne ako „…“ — nikdy rovné úvodzovky ("), tie by ukončili reťazec v JSON.`

/** Odpoveď modelu → návrh. Hodnoty sa orežú ako pri uložení profilu. */
export function parseAdvice(
  raw: unknown,
  meta: { at: Date; by: string; model: string },
): ChunkingAdvice {
  const o = (raw ?? {}) as Record<string, unknown>
  const strategy: AdviceStrategy = o.strategy === "headings" ? "headings" : "articles"
  const confidence: AdviceConfidence = o.confidence === "high" || o.confidence === "low" ? o.confidence : "medium"
  const values = clampChunking({
    articleWord: typeof o.articleWord === "string" ? o.articleWord : undefined,
    annexWord: typeof o.annexWord === "string" ? o.annexWord : undefined,
    minTokens: typeof o.minTokens === "number" ? o.minTokens : undefined,
    maxTokens: typeof o.maxTokens === "number" ? o.maxTokens : undefined,
  })
  return {
    ...meta,
    strategy,
    values,
    confidence,
    reasoning: String(o.reasoning ?? "").trim().slice(0, 1200),
    issues: Array.isArray(o.issues) ? o.issues.map(x => String(x).trim()).filter(Boolean).slice(0, 8).map(x => x.slice(0, 300)) : [],
  }
}

/**
 * Pošle štruktúru dokumentu modelu, uloží návrh pri dokumente a zapíše spotrebu.
 */
export async function requestChunkingAdvice(
  actor: UsageActor,
  documentId: string,
): Promise<ChunkingAdvice> {
  const { companyCode } = actor
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { title: 1, versions: 1, draftMarkdown: 1 } },
  ) as { title?: string; versions?: { isActive?: boolean; markdown?: string }[]; draftMarkdown?: string } | null
  if (!doc) throw new ChunkingAdviceError("library.documentNotFound", "Taký dokument tu nie je.")
  const text = String((doc.versions ?? []).find(v => v.isActive)?.markdown ?? doc.draftMarkdown ?? "").trim()
  if (!text) throw new ChunkingAdviceError("chunking.aiNoText", "Dokument nemá text, nie je čo analyzovať.")

  const ai = await aiForCompany(companyCode)
  if (!ai.apiKey) throw new ChunkingAdviceError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const model = ai.models.answer

  const inspection = await inspectChunking(companyCode, documentId)
  const outline = structureOutline(text)
  const a = inspection?.analysis?.signals
  const facts = [
    `Dokument: ${doc.title ?? documentId}`,
    `Neprázdnych riadkov: ${outline.total}${outline.truncated ? ` (štruktúra skrátená na ${OUTLINE_MAX_LINES} riadkov)` : ""}`,
    a ? `Výskyty na začiatku riadku: Článok ${a.articleWord}×, § ${a.paragraphSign}×, Bod ${a.pointWord}×, nadpisov Markdownu ${a.markdownHeadings}, očíslovaných odsekov ${a.numberedParagraphs}` : "",
    inspection ? `Súčasný profil: slovo článku „${inspection.profile.values.articleWord}“, slovo prílohy „${inspection.profile.values.annexWord}“, úsek ${inspection.profile.values.minTokens}–${inspection.profile.values.maxTokens} tokenov` : "",
    inspection?.version ? `Súčasný rez: ${inspection.stats.count} úsekov, ${inspection.stats.withArticlePercent} % s článkom, veľkosť ${inspection.stats.tokensMin}–${inspection.stats.tokensMax} tokenov` : "",
  ].filter(Boolean).join("\n")

  const usage = (tokens: Partial<import("./pricing").TokenCounts>, failed?: boolean) => void recordAiUsage(usageRecord({
    actor, purpose: "chunking-analysis", subject: String(doc.title ?? documentId),
    provider: "anthropic", model, keySource: ai.keySource, tokens, failed,
  }))

  let answer: Anthropic.Message
  try {
    answer = await new Anthropic({ apiKey: ai.apiKey, maxRetries: 1, timeout: 120_000 }).messages.create({
      model,
      max_tokens: 8000,
      system: ADVICE_SYSTEM,
      messages: [{ role: "user", content: `${facts}\n\nŠtruktúra:\n${outline.lines.join("\n")}` }],
      output_config: { format: { type: "json_schema", schema: ADVICE_SCHEMA as unknown as Record<string, unknown> } },
    })
  } catch (e) {
    usage({}, true)
    console.error("[analýza členenia] volanie zlyhalo:", e)
    throw new ChunkingAdviceError("chunking.aiFailed", "Analýza sa nepodarila — skúste to o chvíľu.")
  }
  usage({
    input: answer.usage.input_tokens,
    output: answer.usage.output_tokens,
    cacheWrite: answer.usage.cache_creation_input_tokens ?? 0,
    cacheRead: answer.usage.cache_read_input_tokens ?? 0,
  })

  const textBlock = answer.content.find(b => b.type === "text")
  let parsed: unknown
  try {
    parsed = JSON.parse(textBlock && textBlock.type === "text" ? textBlock.text : "")
  } catch {
    throw new ChunkingAdviceError("chunking.aiFailed", "Analýza sa nepodarila — skúste to o chvíľu.")
  }
  const advice = parseAdvice(parsed, { at: new Date(), by: actor.personName || actor.email, model })
  // Posledný návrh pri dokumente (rozhodnutie Jána) — ďalšia analýza ho prepíše.
  await col.updateOne({ companyCode, documentId }, { $set: { chunkingAdvice: advice } })
  return advice
}
