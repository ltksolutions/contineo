/**
 * chunkProposal.ts — návrh rezu od AI v kolách (KNIZ-rezac-blokov).
 *
 * **Modelu ide celý text znenia** (rozhodnutie Jána Q1 A, 15. 10. 2026) —
 * ako číslované bloky (`chunkBlocks.ts`), cez kľúč organizácie (ADR-026).
 * Rozhodnutie z 5. 10. 2026 (len štruktúra) tým pre návrh rezov padá: hranice
 * sa bez obsahu nedajú navrhnúť dobre — tabuľka patrí k vete nad ňou, odsek
 * k predošlému nadpisu.
 *
 * **Model navrhuje len hranice, text nikdy nemení.** Vracia **len zmeny**
 * oproti súčasnému rezu — hranice, ktoré pridáva (`add`), a ktoré ruší
 * (`remove`) — so zdôvodnením a jednou vetou „čo som zmenil". Nový rez
 * skladá tento modul. Celý zoznam hraníc model pri zákone o športe
 * (172 hraníc, 21. 10. 2026) potichu skrátil na 107 a tvrdil „bez zmeny";
 * vynechaná hranica tak zlepila 65 úsekov do jedného s 30 170 tokenmi.
 * Pri zmenách vynechanie znamená „nemením", nie „ruším".
 *
 * **Návrh s novým úsekom nad strop sa odmieta** (`CHUNK_LIMIT`, rovnaká
 * hranica a rovnaké meranie s riadkom kontextu, ako keď Členenie hlási
 * „veľký" — `chunkSize.ts`) a neuloží sa. Úsek nad strop,
 * ktorý už je v súčasnom reze s tými istými hranicami, prejde — niektorý
 * článok sa rozumne rozdeliť nedá (§ 3 zákona o športe, výpočet pojmov).
 * Kolo 2 a ďalšie dostanú predošlý návrh a poznámku kurátora („Čo nesedí").
 *
 * Kolá sa držia pri dokumente (`documents.chunkRounds`), viazané na odtlačok
 * textu. Prijatie kola zapíše rez do `documents.chunkCuts` (`chunkCut.ts`)
 * a preindexuje — to robí akcia, nie tento modul.
 */

import Anthropic from "@anthropic-ai/sdk"
import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { aiForCompany } from "./aiSettings"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import { AppError } from "./appError"
import { textFingerprint } from "./chunkIdentity"
import { splitBlocks, normalizeBoundaries, groupBlocks, type TextBlock } from "./chunkBlocks"
import { CHUNK_LIMIT, measureCut } from "./chunkSize"
import { CUTS_KEPT, type ChunkCut } from "./chunkCut"
import { writeAudit } from "./audit"

export class ChunkProposalError extends AppError {}

/** Koľko kôl sa drží pri dokumente. */
export const ROUNDS_KEPT = 20

/** Strop na text pre model — dlhší dokument sa pošle s orezanými blokmi. */
export const TEXT_MAX_CHARS = 180_000
/**
 * Strop výstupu modelu. Hranice pre 170 úsekov sú pod 1 000 tokenov,
 * 40 zdôvodnení do 3 000 — 16 000 je rezerva, nie cieľ. Zákon o športe
 * (21. 10. 2026, 2 000 blokov) narazil aj na tento strop bez jediného
 * znaku textu: Sonnet 5 pri takom vstupe sám od seba **premýšľal** a minul
 * celý rozpočet skôr, než začal písať JSON. Preto je premýšľanie pri
 * návrhu vypnuté (`thinking: disabled`) — pravidlá rezu sú v pokyne,
 * úloha je mechanická; bez premýšľania odpovedal za 23 s a 1 400 tokenov.
 */
export const MAX_OUTPUT_TOKENS = 16_000

/** Strop na jeden blok, keď celok presiahne `TEXT_MAX_CHARS`. */
const BLOCK_TRIM_CHARS = 1_200

export type RoundSource = "ai" | "auto"

/** Zdôvodnenie jednej hranice od modelu. */
export interface BoundaryReason {
  block: number
  why: string
}

export interface ChunkRound {
  no: number
  at: Date
  /** Kto kolo spustil; pri automatickom návrhu ten, kto nahral dokument. */
  by: string
  source: RoundSource
  model: string
  /** `textFingerprint()` textu, nad ktorým model navrhoval. */
  textHash: string
  /** Poznámka kurátora („Čo nesedí"), ktorou kolo začalo. */
  note: string | null
  boundaries: number[]
  reasons: BoundaryReason[]
  /** „Čo som zmenil" — jedna–dve vety. */
  summary: string
  issues: string[]
  confidence: "low" | "medium" | "high"
}

/**
 * Text, nad ktorým sa navrhuje a reže: **koncept, keď sa pripravuje nové
 * znenie** (text konceptu sa líši od platného), inak platné znenie. Návrh
 * pri nahratí (Q2 A) tak patrí k novému textu a prijatý rez sa uplatní pri
 * zverejnení; bez prípravy sa rezač týka toho, z čoho asistent odpovedá dnes.
 */
export function proposalText(doc: { versions?: { isActive?: boolean; markdown?: string }[]; draftMarkdown?: string }): string {
  const effective = String((doc.versions ?? []).find(v => v.isActive)?.markdown ?? "").trim()
  const draft = String(doc.draftMarkdown ?? "").trim()
  if (draft && (!effective || textFingerprint(draft) !== textFingerprint(effective))) return draft
  return effective
}

/**
 * Bloky ako číslované riadky pre model. Čistá funkcia. Keď je text priveľký,
 * dlhé bloky sa orežú (nadpisy nikdy) a vráti sa `trimmed: true`.
 */
export function numberedBlocks(blocks: TextBlock[]): { text: string; trimmed: boolean } {
  const full = blocks.map(b => `[${b.index}] ${b.text}`).join("\n\n")
  if (full.length <= TEXT_MAX_CHARS) return { text: full, trimmed: false }
  const text = blocks
    .map(b => `[${b.index}] ${b.kind === "heading" || b.text.length <= BLOCK_TRIM_CHARS ? b.text : `${b.text.slice(0, BLOCK_TRIM_CHARS)} […]`}`)
    .join("\n\n")
  return { text: text.slice(0, TEXT_MAX_CHARS), trimmed: true }
}

export const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["add", "remove", "reasons", "summary", "issues", "confidence"],
  properties: {
    add: { type: "array", items: { type: "integer" } },
    remove: { type: "array", items: { type: "integer" } },
    reasons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["block", "why"],
        properties: { block: { type: "integer" }, why: { type: "string" } },
      },
    },
    summary: { type: "string" },
    issues: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} as const

/*
 * Úvodzovky „…“, nie rovné — rovná úvodzovka v štruktúrovanom výstupe
 * ukončila reťazec (poučenie z 5. 10. 2026, `chunkingAdvice.ts`).
 */
export const PROPOSAL_SYSTEM = `Si kurátor dokumentov, ktoré sa delia na úseky pre vyhľadávanie (RAG). Asistent pri otázke dostane niekoľko úsekov a odpovedá len z nich — úsek preto musí byť súvislá téma, ktorá dáva zmysel aj bez susedov.

Dostaneš celý text dokumentu ako číslované bloky [n] (nadpis, odsek, položka zoznamu, celá tabuľka), druh dokumentu a súčasné hranice. Hranica je index bloku, ktorým začína nový úsek. Blok 0 začína vždy prvý úsek — neuvádzaj ho.

Pravidlá:
- Úsek má mať približne 300–900 tokenov (1 token ≈ 4 znaky); krátky celý oddiel je v poriadku, úlomok bez kontextu nie.
- Rež na nadpisoch tam, kde začína nová téma. Tabuľku nikdy neoddeľuj od vety alebo nadpisu, ktorý ju uvádza. Odsek, ktorý dopĺňa predošlý nadpis, nechaj pri ňom.
- Pri norme (články, paragrafy) je úsek článok; dlhý článok rozdeľ medzi odsekmi. Pri manuáli a zmluve rež podľa nadpisov časti a podčastí.
- Text nemeň a nevymýšľaj; vraciaš len indexy.

Vráť LEN ZMENY oproti súčasnému rezu — súčasné hranice, ktoré neuvedieš, ostávajú:
- add: indexy blokov, na ktorých má ZAČAŤ nový úsek a dnes nezačína (vzostupne); prázdne, keď nepridávaš;
- remove: súčasné hranice, ktoré RUŠÍŠ — úsek sa spojí s predošlým (vzostupne); prázdne, keď nerušíš. Spojením nesmie vzniknúť úsek nad ${CHUNK_LIMIT} tokenov;
- keď súčasný rez sedí, add aj remove sú prázdne;
- reasons: ku každej hranici z add a remove jednu krátku vetu prečo (block = index); najviac 40 — pri veľkom dokumente len najdôležitejšie zmeny, ostatné zhrň v summary;
- summary: 1–2 vety po slovensky, čo si zmenil oproti súčasnému rezu (pri ďalšom kole oproti predošlému návrhu a podľa poznámky kurátora);
- issues: krátky zoznam toho, čo v texte nesedí (prázdny, keď nič);
- confidence: ako veľmi si si istý.
Píš po slovensky, vecne. Úvodzovky výhradne „…“ — nikdy rovné ("), tie by ukončili reťazec v JSON.`

/**
 * Odpoveď modelu → kolo. Nový rez = súčasné hranice bez `remove` a s `add`.
 * Hranice sa očistia (mimo textu, blok 0, duplicity); `remove`, ktorá dnes
 * nie je hranicou, a `add`, ktorá už je, nič nemenia. Zdôvodnenia len
 * k platným blokom.
 */
export function parseProposal(
  raw: unknown,
  blockCount: number,
  meta: Omit<ChunkRound, "boundaries" | "reasons" | "summary" | "issues" | "confidence">,
  current: number[],
): ChunkRound {
  const o = (raw ?? {}) as Record<string, unknown>
  const remove = new Set(normalizeBoundaries(o.remove, blockCount))
  const add = normalizeBoundaries(o.add, blockCount)
  const boundaries = normalizeBoundaries([...normalizeBoundaries(current, blockCount).filter(b => !remove.has(b)), ...add], blockCount)
  const reasons: BoundaryReason[] = Array.isArray(o.reasons)
    ? (o.reasons as unknown[])
        .map(r => r as { block?: unknown; why?: unknown })
        .map(r => ({ block: Math.round(Number(r.block)), why: String(r.why ?? "").trim().slice(0, 400) }))
        .filter(r => Number.isFinite(r.block) && r.block > 0 && r.block < blockCount && r.why)
        .slice(0, 60)
    : []
  const confidence = o.confidence === "high" || o.confidence === "low" ? o.confidence : "medium"
  return {
    ...meta,
    boundaries,
    reasons,
    summary: String(o.summary ?? "").trim().slice(0, 800),
    issues: Array.isArray(o.issues) ? o.issues.map(x => String(x).trim()).filter(Boolean).slice(0, 8).map(x => x.slice(0, 300)) : [],
    confidence,
  }
}

/** Úsek nového rezu nad strop, ktorý v súčasnom reze nie je (s rovnakými hranicami). */
export interface OversizedChunk {
  /** Prvý blok úseku. */
  start: number
  /** Blok za koncom úseku. */
  end: number
  tokens: number
}

/**
 * Nové úseky nad strop, zmerané ako pri indexovaní (`measureCut()`, s riadkom
 * kontextu). Úsek s rovnakým začiatkom aj koncom, aký už je v súčasnom
 * reze, sa nepočíta — návrh ho nevytvoril, len ponechal. Čistá funkcia.
 */
export function oversizedNewChunks(
  markdown: string, title: string, current: number[], proposed: number[], limit: number = CHUNK_LIMIT,
): OversizedChunk[] {
  const blocks: TextBlock[] = splitBlocks(markdown)
  const span = (g: number[]) => `${g[0]}-${g[g.length - 1] + 1}`
  const existing = new Set(groupBlocks(blocks.length, current).map(span))
  const groups = groupBlocks(blocks.length, proposed)
  const tokens = measureCut(markdown, proposed, title).map(m => m.tokens)
  return groups
    .map((g, i) => ({ start: g[0], end: g[g.length - 1] + 1, tokens: tokens[i], key: span(g) }))
    .filter(c => c.tokens > limit && !existing.has(c.key))
    .map(({ start, end, tokens }) => ({ start, end, tokens }))
}

/** Kolá pre daný text — tie, ktoré k inému textu nepatria, sa neukazujú. */
export function roundsFor(rounds: ChunkRound[] | null | undefined, markdown: string): ChunkRound[] {
  const hash = textFingerprint(markdown)
  return (rounds ?? []).filter(r => r.textHash === hash).sort((a, b) => b.no - a.no)
}

interface ProposalDoc {
  title?: string
  versions?: { isActive?: boolean; markdown?: string }[]
  draftMarkdown?: string
  chunkRounds?: ChunkRound[]
}

/**
 * Nové kolo návrhu. `current` sú dnešné hranice (z uložených úsekov alebo
 * z prijatého rezu) — model k nim zdôvodňuje zmeny. Pri `note` dostane aj
 * predošlé kolo a poznámku kurátora.
 */
export async function proposeChunkCut(
  actor: UsageActor,
  documentId: string,
  input: { current: number[]; note?: string | null; source?: RoundSource; kindLabel?: string | null },
): Promise<ChunkRound> {
  const { companyCode } = actor
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { title: 1, versions: 1, draftMarkdown: 1, chunkRounds: 1 } },
  ) as ProposalDoc | null
  if (!doc) throw new ChunkProposalError("library.documentNotFound", "Taký dokument tu nie je.")
  const text = proposalText(doc)
  if (!text) throw new ChunkProposalError("chunking.aiNoText", "Dokument nemá text, nie je čo analyzovať.")

  const ai = await aiForCompany(companyCode)
  if (!ai.apiKey) throw new ChunkProposalError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const model = ai.models.answer

  const blocks = splitBlocks(text)
  const { text: numbered, trimmed } = numberedBlocks(blocks)
  const textHash = textFingerprint(text)
  const previous = roundsFor(doc.chunkRounds, text)[0] ?? null
  const note = input.note?.trim() ? input.note.trim().slice(0, 2000) : null
  // Ten istý meter ako Členenie a odmietnutie — úsek tak, ako ho dostane asistent.
  const tokens = measureCut(text, input.current, String(doc.title ?? documentId)).map(m => m.tokens)

  const facts = [
    `Dokument: ${doc.title ?? documentId}`,
    input.kindLabel ? `Druh dokumentu: ${input.kindLabel}` : "",
    `Blokov: ${blocks.length}${trimmed ? " (dlhé bloky sú skrátené, označené […])" : ""}`,
    `Súčasné hranice: ${input.current.length ? input.current.join(", ") : "žiadne (celý text je jeden úsek)"}`,
    `Súčasné úseky (tokeny): ${tokens.join(", ")}`,
    previous && note ? `Predošlý návrh (kolo ${previous.no}): ${previous.boundaries.join(", ")}` : "",
    note ? `Poznámka kurátora k predošlému návrhu: „${note}“` : "",
  ].filter(Boolean).join("\n")

  const usage = (tk: Partial<import("./pricing").TokenCounts>, failed?: boolean) => void recordAiUsage(usageRecord({
    actor, purpose: "chunking-analysis", subject: String(doc.title ?? documentId),
    provider: "anthropic", model, keySource: ai.keySource, tokens: tk, failed,
  }))

  let answer: Anthropic.Message
  try {
    answer = await new Anthropic({ apiKey: ai.apiKey, maxRetries: 1, timeout: 240_000 }).messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      // Bez premýšľania — viď `MAX_OUTPUT_TOKENS`.
      thinking: { type: "disabled" },
      system: PROPOSAL_SYSTEM,
      messages: [{ role: "user", content: `${facts}\n\nText dokumentu po blokoch:\n\n${numbered}` }],
      output_config: { format: { type: "json_schema", schema: PROPOSAL_SCHEMA as unknown as Record<string, unknown> } },
    })
  } catch (e) {
    usage({}, true)
    console.error("[návrh rezu] volanie zlyhalo:", e)
    throw new ChunkProposalError("chunking.aiFailed", "Analýza sa nepodarila — skúste to o chvíľu.")
  }
  // Odrezaná odpoveď je zlyhanie, nie „skúste o chvíľu": spotreba sa zapíše
  // ako neúspešná a človek sa dozvie, čo sa stalo.
  const truncated = answer.stop_reason === "max_tokens"
  usage({
    input: answer.usage.input_tokens,
    output: answer.usage.output_tokens,
    cacheWrite: answer.usage.cache_creation_input_tokens ?? 0,
    cacheRead: answer.usage.cache_read_input_tokens ?? 0,
  }, truncated)
  if (truncated) {
    console.error("[návrh rezu] odpoveď modelu narazila na strop výstupu:", answer.usage.output_tokens)
    throw new ChunkProposalError("chunking.aiTruncated", "Odpoveď modelu bola pridlhá a odrezala sa.")
  }

  const out = answer.content.find(b => b.type === "text")
  let parsed: unknown
  try {
    parsed = JSON.parse(out && out.type === "text" ? out.text : "")
  } catch {
    throw new ChunkProposalError("chunking.aiFailed", "Analýza sa nepodarila — skúste to o chvíľu.")
  }

  const no = Math.max(0, ...(doc.chunkRounds ?? []).map(r => r.no)) + 1
  const round = parseProposal(parsed, blocks.length, {
    no,
    at: new Date(),
    by: actor.personName || actor.email,
    source: input.source ?? "ai",
    model,
    textHash,
    note,
  }, input.current)
  // Odmietnutý návrh sa neukladá — prijať by sa nemal dať ani omylom.
  const oversized = oversizedNewChunks(text, String(doc.title ?? documentId), input.current, round.boundaries)
  if (oversized.length) {
    const worst = oversized.reduce((a, b) => (b.tokens > a.tokens ? b : a))
    console.warn(`[návrh rezu] odmietnutý: ${oversized.length} nových úsekov nad ${CHUNK_LIMIT} tokenov, najväčší ${worst.tokens} (bloky ${worst.start}–${worst.end - 1})`)
    throw new ChunkProposalError("chunking.aiOversized", "Návrh by vytvoril priveľký úsek, neuložil sa.", {
      tokens: worst.tokens, block: worst.start, count: oversized.length, limit: CHUNK_LIMIT,
    })
  }
  await col.updateOne(
    { companyCode, documentId },
    { $push: { chunkRounds: { $each: [round], $slice: -ROUNDS_KEPT } } } as never,
  )
  return round
}

/**
 * Prijatie kola: rez sa zapíše pri dokumente ako ručné hranice pre text,
 * z ktorého kolo vzniklo (Q3 A). Preindexovanie spraví akcia — vráti sa
 * `versionId` platného znenia, keď kolo patrí k nemu; pri koncepte sa rez
 * uplatní pri zverejnení (`cutForIndex()` podľa odtlačku textu).
 */
export async function acceptChunkRound(
  companyCode: string,
  documentId: string,
  roundNo: number,
  actor: string,
): Promise<{ reindexVersionId: string | null; round: ChunkRound }> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { title: 1, versions: 1, draftMarkdown: 1, chunkRounds: 1 } },
  ) as (Omit<ProposalDoc, "versions"> & { versions?: { versionId: string; isActive?: boolean; markdown?: string }[] }) | null
  if (!doc) throw new ChunkProposalError("library.documentNotFound", "Taký dokument tu nie je.")
  const text = proposalText(doc)
  const round = roundsFor(doc.chunkRounds, text).find(r => r.no === roundNo)
  if (!round) {
    throw new ChunkProposalError("chunking.roundStale", "Návrh patrí k inému textu — text sa medzitým zmenil. Dajte navrhnúť znova.")
  }
  const now = new Date()
  const cut: ChunkCut = { textHash: round.textHash, boundaries: round.boundaries, round: round.no, at: now, by: actor }
  await col.updateOne(
    { companyCode, documentId },
    {
      $push: { chunkCuts: { $each: [cut], $slice: -CUTS_KEPT } },
      $set: { chunkingReviewedAt: now, chunkingDeferredAt: null, updatedAt: now, updatedBy: actor },
    } as never,
  )
  await writeAudit({
    companyCode,
    subject: "document",
    action: "clenenie-prijate",
    actor,
    targetId: documentId,
    targetLabel: String(doc.title ?? documentId),
    note: `kolo ${round.no} · ${round.boundaries.length + 1} úsekov`,
  })
  const effective = (doc.versions ?? []).find(v => v.isActive)
  const reindexVersionId = effective && textFingerprint(String(effective.markdown ?? "")) === round.textHash ? effective.versionId : null
  return { reindexVersionId, round }
}

/** „Odložiť" v karte postupu — krok „Skontrolovať členenie" zmizne, kým nepríde nový text. */
export async function deferChunkReview(companyCode: string, documentId: string, actor: string): Promise<void> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne({ companyCode, documentId }, { projection: { versions: 1, draftMarkdown: 1 } }) as ProposalDoc | null
  if (!doc) throw new ChunkProposalError("library.documentNotFound", "Taký dokument tu nie je.")
  await col.updateOne(
    { companyCode, documentId },
    { $set: { chunkingDeferredAt: new Date(), chunkingDeferredHash: textFingerprint(proposalText(doc)), updatedBy: actor } },
  )
}
