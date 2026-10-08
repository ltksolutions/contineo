/**
 * faqMining.ts — ťažba histórie schránky do návrhov FAQ (ADR-028, D165).
 *
 * História helpdesku je tisíce vlákien „otázka → odpoveď". Do indexu nejdú:
 * sú plné mien hráčov, rodičov a maloletých, zastaraných aj chybných
 * odpovedí. Namiesto toho model dostane **vlákna očistené od osobných
 * údajov** a navrhne zovšeobecnené záznamy FAQ; tie pristanú ako **koncept**
 * vo FAQ dokumente kanála a správca obsahu ich schváli postupom znenia.
 *
 * Čo sa ukladá: odvodený záznam a `messageId` vlákien, z ktorých vznikol
 * (`origin`). Telá mailov nie — prečítajú sa, spracujú a zabudnú.
 *
 * Spotreba modelu ide pod účel `faq-mining` bez znenia (D158).
 */

import Anthropic from "@anthropic-ai/sdk"
import { aiForCompany } from "./aiSettings"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import { AppError } from "./appError"
import { channelByKey, mailboxFor } from "./channels"
import { stripQuotedHistory, type MailMessage } from "./mailbox/types"
import { checkEntry, faqDraft, saveFaqEntry, type FaqEntryInput } from "./faq"
import type { UiLanguage } from "./i18n"

export class FaqMiningError extends AppError {}

/** Koľko vlákien ide modelu v jednej dávke. */
export const THREADS_PER_BATCH = 12
export const MAX_THREAD_CHARS = 6000
export const DEFAULT_HISTORY_LIMIT = 300

export interface MailThread {
  threadRef: string
  subject: string
  /** Prvá prichádzajúca správa — otázka. */
  question: string
  /** Odpovede zo schránky kanála v poradí. */
  answers: string[]
  messageIds: string[]
  from: Date
}

/**
 * Správy → vlákna s otázkou aj odpoveďou. Vlákno bez odpovede helpdesku
 * nemá čo učiť; vlákno bez otázky zvonku je interná pošta.
 */
export function threadsFrom(messages: MailMessage[]): MailThread[] {
  const groups = new Map<string, MailMessage[]>()
  for (const m of messages) groups.set(m.threadRef, [...(groups.get(m.threadRef) ?? []), m])
  const out: MailThread[] = []
  for (const [threadRef, list] of groups) {
    const ordered = list.slice().sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    const first = ordered.find(m => !m.outgoing)
    const answers = ordered.filter(m => m.outgoing).map(m => stripQuotedHistory(m.text)).filter(Boolean)
    if (!first || !answers.length) continue
    const question = stripQuotedHistory(first.text)
    if (!question) continue
    out.push({
      threadRef, subject: first.subject, question, answers,
      messageIds: ordered.map(m => m.internetMessageId ?? m.id),
      from: first.receivedAt,
    })
  }
  return out.sort((a, b) => b.from.getTime() - a.from.getTime())
}

/**
 * Osobné údaje, ktoré sa dajú chytiť pravidlom: adresy, telefóny, čísla od
 * 6 číslic (registračné čísla, faktúry), rodné čísla, IBAN. Mená pravidlo nechytí — o tie sa
 * stará pokyn modelu a potom správca obsahu pri schvaľovaní.
 */
export function scrubPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    // Rodné číslo (6/3–4) a telefón (aspoň 9 číslic s medzerami či pomlčkami);
    // „čl. 12“ ani „sezóna 2026/2027“ sa nechytia.
    .replace(/\b\d{6}\/\d{3,4}\b/g, "[číslo]")
    .replace(/(\+?\d[\d\s-]{7,}\d)/g, m => (m.replace(/\D/g, "").length >= 9 ? "[číslo]" : m))
    // Samostatné číslo od 6 číslic — registračné číslo ISSF, číslo faktúry,
    // variabilný symbol (podklad pre DPO, kap. 2; schválené 9. 10. 2026).
    .replace(/\b\d{6,}\b/g, "[číslo]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}\b/g, "[účet]")
    .replace(/https?:\/\/\S+/g, "[odkaz]")
}

export function threadTranscript(t: MailThread, index: number): string {
  const cut = (s: string) => (s.length > MAX_THREAD_CHARS ? `${s.slice(0, MAX_THREAD_CHARS)} …` : s)
  const lines = [`### Vlákno ${index + 1}`, `Predmet: ${scrubPersonalData(t.subject)}`, "", "Otázka:", cut(scrubPersonalData(t.question))]
  t.answers.forEach((a, i) => lines.push("", `Odpoveď helpdesku${t.answers.length > 1 ? ` ${i + 1}` : ""}:`, cut(scrubPersonalData(a))))
  return lines.join("\n")
}

export const MINING_SYSTEM = [
  "Si redaktor FAQ športového zväzu. Dostaneš vlákna z e-mailovej schránky helpdesku: otázku člena a odpoveď helpdesku.",
  "Z vlákien urob zovšeobecnené záznamy FAQ, ktoré pomôžu ďalším ľuďom s tou istou otázkou.",
  "Pravidlá:",
  "– Nikdy neuvádzaj mená, adresy, čísla, kluby ani iné údaje konkrétnej osoby. Píš všeobecne („hráč“, „klub“, „rodič“).",
  "– Jedna otázka = jeden záznam. Rovnaké otázky z viacerých vlákien zlúč do jedného záznamu a uveď všetky čísla vlákien.",
  "– Odpoveď píš úplne a presne tak, ako ju helpdesk dal; nič nedomýšľaj. Keď si odpovede vo vlákne protirečia, záznam nevytváraj.",
  "– Vlákno, ktoré nie je otázka s odpoveďou (spam, interná pošta, poďakovanie), preskoč.",
  "– Píš v jazyku vlákien. V textoch používaj úvodzovky „…“, nikdy znak \".",
  "Vráť JSON podľa schémy.",
].join("\n")

export const MINING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string", description: "Kanonická otázka, jedna veta." },
          variants: { type: "array", items: { type: "string" }, description: "Iné znenia tej istej otázky, ako ich ľudia písali." },
          answer: { type: "string", description: "Úplná odpoveď bez osobných údajov." },
          audience: { type: "array", items: { type: "string" }, description: "Komu je určená: klubový manažér, rozhodca, tréner, hráč, rodič…" },
          threads: { type: "array", items: { type: "integer" }, description: "Čísla vlákien, z ktorých záznam vznikol." },
        },
        required: ["question", "variants", "answer", "audience", "threads"],
      },
    },
  },
  required: ["entries"],
} as const

export interface MinedEntry extends FaqEntryInput {
  threadIndexes: number[]
}

/** Odpoveď modelu → overené záznamy. Nečitateľné alebo prázdne položky sa vynechajú. */
export function parseMined(raw: unknown, threadCount: number): MinedEntry[] {
  const list = (raw as { entries?: unknown })?.entries
  if (!Array.isArray(list)) return []
  const out: MinedEntry[] = []
  for (const item of list) {
    const e = item as Record<string, unknown>
    try {
      const checked = checkEntry({ question: e.question, variants: e.variants, answer: e.answer, audience: e.audience, sources: [] })
      const threadIndexes = (Array.isArray(e.threads) ? e.threads : [])
        .map(n => Number(n) - 1)
        .filter(n => Number.isInteger(n) && n >= 0 && n < threadCount)
      out.push({ ...checked, threadIndexes })
    } catch {
      // Záznam bez otázky alebo odpovede — model ho nemal vrátiť; preskočí sa.
    }
  }
  return out
}

export interface MiningReport {
  threads: number
  batches: number
  proposed: number
  saved: number
  duplicates: number
}

/**
 * Prečíta históriu schránky kanála, vyťaží návrhy a uloží ich ako záznamy
 * do konceptu FAQ dokumentu. Záznam s otázkou, ktorú FAQ už má (doslovne,
 * bez ohľadu na veľkosť písmen), sa preskočí.
 */
export async function mineFaqDrafts(
  actor: UsageActor,
  input: { channelKey: string; documentId: string; limit?: number; language?: UiLanguage },
): Promise<MiningReport> {
  const { companyCode } = actor
  const channel = await channelByKey(companyCode, input.channelKey)
  if (!channel) throw new FaqMiningError("helpdesk.notFound", "Taký kanál tu nie je.")
  const draft = await faqDraft(companyCode, input.documentId)
  if (!draft) throw new FaqMiningError("library.documentNotFound", "Taký dokument tu nie je.")
  const ai = await aiForCompany(companyCode)
  if (!ai.apiKey) throw new FaqMiningError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const model = ai.models.answer

  const adapter = mailboxFor(channel)
  const messages = await adapter.listRecent(Math.min(Math.max(input.limit ?? DEFAULT_HISTORY_LIMIT, 10), 2000))
  const threads = threadsFrom(messages)
  const report: MiningReport = { threads: threads.length, batches: 0, proposed: 0, saved: 0, duplicates: 0 }
  if (!threads.length) return report

  const known = new Set(draft.entries.map(e => e.question.toLowerCase()))
  const client = new Anthropic({ apiKey: ai.apiKey, maxRetries: 1, timeout: 180_000 })
  const usage = (tokens: Partial<import("./pricing").TokenCounts>, failed?: boolean) => void recordAiUsage(usageRecord({
    actor, purpose: "faq-mining", subject: `${channel.name} → ${draft.title}`,
    provider: "anthropic", model, keySource: ai.keySource, tokens, failed,
  }))

  for (let start = 0; start < threads.length; start += THREADS_PER_BATCH) {
    const batch = threads.slice(start, start + THREADS_PER_BATCH)
    report.batches += 1
    const prompt = [
      known.size ? `FAQ už obsahuje tieto otázky (nevracaj ich znova):\n${[...known].slice(0, 200).map(q => `– ${q}`).join("\n")}\n` : "",
      batch.map((t, i) => threadTranscript(t, i)).join("\n\n"),
    ].join("\n")
    let answer: Anthropic.Message
    try {
      answer = await client.messages.create({
        model, max_tokens: 8000, system: MINING_SYSTEM,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: { type: "json_schema", schema: MINING_SCHEMA as unknown as Record<string, unknown> } },
      })
    } catch (e) {
      usage({}, true)
      console.error("[faq-mining] volanie zlyhalo:", e)
      throw new FaqMiningError("helpdesk.miningFailed", "Ťažba FAQ sa nepodarila — skúste to o chvíľu.", { batch: report.batches })
    }
    usage({
      input: answer.usage.input_tokens, output: answer.usage.output_tokens,
      cacheWrite: answer.usage.cache_creation_input_tokens ?? 0, cacheRead: answer.usage.cache_read_input_tokens ?? 0,
    })
    const textBlock = answer.content.find(b => b.type === "text")
    let parsed: unknown = null
    try { parsed = JSON.parse(textBlock && textBlock.type === "text" ? textBlock.text : "") } catch { parsed = null }
    const mined = parseMined(parsed, batch.length)
    report.proposed += mined.length
    for (const m of mined) {
      if (known.has(m.question.toLowerCase())) { report.duplicates += 1; continue }
      const origin = {
        channelKey: channel.key,
        threadRefs: m.threadIndexes.map(i => batch[i].threadRef),
        messageIds: m.threadIndexes.flatMap(i => batch[i].messageIds),
        minedAt: new Date(),
        model,
      }
      await saveFaqEntry(companyCode, input.documentId, { ...m, id: null, origin }, actor.email)
      known.add(m.question.toLowerCase())
      report.saved += 1
    }
  }
  return report
}
