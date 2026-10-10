/**
 * complianceCheck.ts — kontrola súladu proti dokumentom knižnice (ADR-032).
 *
 * Spoločný mechanizmus pre kontrolu FAQ (D191–D195) aj neskoršiu kontrolu
 * dokumentu proti dokumentom (D196–D198). Fáza 1: **návrhy FAQ vo fronte
 * kurátora** (`faq_proposals`) proti dokumentom, ktoré vyberie kurátor.
 *
 * Modelu ide **balík celých textov** vybraných dokumentov (spresnenie D194):
 * platné znenie, a kde ho dokument ešte nemá, koncept s označením „koncept".
 * Balík je pri všetkých dávkach rovnaký, preto ide do cache modelu — prvá
 * dávka ho zapíše, ďalšie ho čítajú za zlomok ceny. Dokumenty sú v balíku
 * zoradené podľa záväznosti druhu (D198: zákon, norma, smernica, metodický
 * pokyn, manuál, ostatné) a model pri rozpore uprednostní vyšší.
 *
 * Výsledok sa nikdy nezapíše do odpovede návrhu sám (D192): ide do poľa
 * `review` pri návrhu a kurátor ho prevezme alebo ponechá pôvodné.
 *
 * Beh po dávkach cez cron ako ťažba (ADR-030): identita behu, zámok kúska,
 * pokus započítaný pred prácou.
 */

import { randomBytes } from "node:crypto"
import Anthropic from "@anthropic-ai/sdk"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { requireCompanyCode } from "./tenantScope"
import { aiForCompany } from "./aiSettings"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import { DOCUMENTS_COLLECTION } from "./documents"
import { PROPOSALS_COLLECTION, type FaqProposal, type ProposalSource } from "./faqProposals"
import type { TokenCounts } from "./pricing"

export class ComplianceError extends AppError {}

export const COMPLIANCE_RUNS_COLLECTION = "compliance_runs"
/** Návrhov v jednom volaní modelu. */
export const REVIEW_BATCH = 4
/** Strop balíka dokumentov (znaky) — nad ním treba vybrať menej dokumentov. */
export const PACK_MAX_CHARS = 400_000
export const MAX_FAILURES = 5

export type ReviewVerdict = "agree" | "differs" | "not_covered" | "conflict"
export const REVIEW_VERDICTS: ReviewVerdict[] = ["differs", "conflict", "not_covered", "agree"]

/** Poradie záväznosti podľa druhu dokumentu (D198, kým nie je nastavenie organizácie). */
const CATEGORY_RANK: Record<string, number> = { zakon: 0, norma: 1, smernica: 2, metodicky_pokyn: 3, manual: 4 }
export function categoryRank(category: string | null | undefined): number {
  return CATEGORY_RANK[category ?? ""] ?? 5
}

export interface PackDocument {
  documentId: string
  title: string
  category: string | null
  /** „platné" — zverejnené znenie; „koncept" — dokument platné znenie ešte nemá. */
  state: "valid" | "draft"
  label: string | null
  chars: number
}

export interface ReferencePack {
  documents: PackDocument[]
  text: string
}

interface RawDocument {
  documentId: string
  title?: string
  category?: string | null
  accessLevel?: string
  draftMarkdown?: string | null
  versions?: { versionId: string; label?: string | null; isActive?: boolean; markdown?: string | null }[]
}

/** Dokumenty → balík textov v poradí záväznosti. Čisté, bez databázy. */
export function buildPack(docs: RawDocument[]): ReferencePack {
  const parts = docs.map(d => {
    const active = (d.versions ?? []).find(v => v.isActive && v.markdown)
    const text = (active?.markdown ?? d.draftMarkdown ?? "").trim()
    return {
      meta: {
        documentId: d.documentId, title: String(d.title ?? d.documentId), category: d.category ?? null,
        state: active ? "valid" as const : "draft" as const, label: active?.label ?? null, chars: text.length,
      },
      text,
    }
  }).filter(p => p.text)
    .sort((a, b) => categoryRank(a.meta.category) - categoryRank(b.meta.category) || a.meta.title.localeCompare(b.meta.title))
  const text = parts.map((p, i) => [
    `=== Dokument ${i + 1}: ${p.meta.title}`,
    `Druh: ${p.meta.category ?? "neuvedený"} · ${p.meta.state === "valid" ? `platné znenie${p.meta.label ? ` ${p.meta.label}` : ""}` : "KONCEPT (zatiaľ nezverejnený)"}`,
    "",
    p.text,
  ].join("\n")).join("\n\n")
  return { documents: parts.map(p => p.meta), text }
}

// ── Pokyn a schéma ──────────────────────────────────────────────────────────

export const REVIEW_SYSTEM = [
  "Si kurátor FAQ športového zväzu. Dostaneš referenčné dokumenty zväzu (normy, poriadky, manuály) a niekoľko návrhov záznamov FAQ (otázka, iné znenia, odpoveď).",
  "Každý návrh skontroluj **len proti dodaným dokumentom** a vráť verdikt:",
  "– „agree“ — odpoveď je s dokumentmi v súlade (drobné štylistické rozdiely nevadia),",
  "– „differs“ — odpoveď niečo tvrdí inak než dokumenty, niečo podstatné chýba alebo je zastarané; vtedy napíš opravenú otázku a odpoveď,",
  "– „not_covered“ — dokumenty tému nepokrývajú (odpoveď nemáš ako overiť); nič nedomýšľaj,",
  "– „conflict“ — dokumenty si v tejto veci protirečia tak, že poradie záväznosti nerozhodne.",
  "Pravidlá:",
  "– Dokumenty sú zoradené podľa záväznosti, prvý je najvyšší. Pri rozpore platí vyšší; manuál nesmie prebiť normu. Dokument označený KONCEPT ber ako pracovný.",
  "– Pri každej zmene uveď citáciu: číslo dokumentu, článok alebo časť a krátky doslovný úryvok (najviac 200 znakov).",
  "– Opravená odpoveď je priama, vecná, pre člena zväzu (vykanie), bez „podľa helpdesku“ a bez mien a údajov konkrétnych osôb. Ponechaj z pôvodnej odpovede všetko, čo je správne; nič, čo v dokumentoch nie je, nepridávaj.",
  "– „note“ je pre kurátora: v čom je rozdiel, čo treba rozhodnúť. Pri „agree“ môže byť prázdna.",
  "– V textoch používaj úvodzovky „…“, nikdy znak \".",
  "Vráť JSON podľa schémy, jeden výsledok ku každému návrhu.",
].join("\n")

export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: "integer", description: "Číslo návrhu." },
          verdict: { type: "string", enum: ["agree", "differs", "not_covered", "conflict"] },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                doc: { type: "integer", description: "Číslo dokumentu z balíka." },
                ref: { type: "string", description: "Článok, odsek alebo časť." },
                quote: { type: "string", description: "Krátky doslovný úryvok." },
              },
              required: ["doc", "ref", "quote"],
            },
          },
          question: { type: "string", description: "Pri „differs“ opravená otázka, inak prázdne." },
          answer: { type: "string", description: "Pri „differs“ opravená odpoveď, inak prázdne." },
          note: { type: "string" },
        },
        required: ["item", "verdict", "citations", "question", "answer", "note"],
      },
    },
  },
  required: ["results"],
} as const

export interface ReviewItem { id: string; question: string; variants: string[]; answer: string }

export function reviewPrompt(items: ReviewItem[]): string {
  return items.map((it, i) => [
    `### Návrh ${i + 1}`,
    `Otázka: ${it.question}`,
    ...(it.variants.length ? [`Iné znenia: ${it.variants.join(" | ")}`] : []),
    "Odpoveď:",
    it.answer,
  ].join("\n")).join("\n\n")
}

export interface ReviewCitation { documentId: string; title: string; articleRef: string | null; quote: string }

export interface ProposalReview {
  runId: string
  at: Date
  verdict: ReviewVerdict
  citations: ReviewCitation[]
  /** Navrhnuté znenie pri „differs“; zdroje sú dokumenty z citácií. */
  proposed: { question: string; answer: string; sources: ProposalSource[] } | null
  note: string
  model: string
  documents: Pick<PackDocument, "documentId" | "title" | "state" | "label">[]
  /** Čo s výsledkom urobil kurátor; `null` kým nerozhodol. */
  decision: "applied" | "dismissed" | null
  decidedBy?: string | null
  decidedAt?: Date | null
}

/** Odpoveď modelu → výsledok ku každému návrhu dávky. Chýbajúci výsledok = žiadny (návrh sa skúsi v ďalšom behu znova). */
export function parseReview(raw: unknown, items: ReviewItem[], pack: ReferencePack): Map<string, Omit<ProposalReview, "runId" | "at" | "model" | "documents" | "decision">> {
  const out = new Map<string, Omit<ProposalReview, "runId" | "at" | "model" | "documents" | "decision">>()
  const list = (raw as { results?: unknown })?.results
  for (const r of Array.isArray(list) ? list : []) {
    const x = r as Record<string, unknown>
    const i = Number(x.item) - 1
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue
    const verdict = (["agree", "differs", "not_covered", "conflict"] as string[]).includes(String(x.verdict)) ? (x.verdict as ReviewVerdict) : null
    if (!verdict) continue
    const citations: ReviewCitation[] = (Array.isArray(x.citations) ? x.citations : []).flatMap(c => {
      const cc = c as Record<string, unknown>
      const d = pack.documents[Number(cc.doc) - 1]
      if (!d) return []
      return [{ documentId: d.documentId, title: d.title, articleRef: String(cc.ref ?? "").trim().slice(0, 120) || null, quote: String(cc.quote ?? "").trim().slice(0, 300) }]
    }).slice(0, 8)
    const question = String(x.question ?? "").replace(/\s+/g, " ").trim()
    const answer = String(x.answer ?? "").trim()
    const proposed = verdict === "differs" && answer
      ? {
          question: (question || items[i].question).slice(0, 300),
          answer: answer.slice(0, 4000),
          sources: [...new Map(citations.map(c => [`${c.documentId}|${c.articleRef ?? ""}`, { documentId: c.documentId, title: c.title, articleRef: c.articleRef }])).values()],
        }
      : null
    out.set(items[i].id, { verdict, citations, proposed, note: String(x.note ?? "").trim().slice(0, 2000) })
  }
  return out
}

// ── Beh ─────────────────────────────────────────────────────────────────────

export interface ComplianceRun {
  companyCode: string
  /** Čo sa kontroluje; fáza 1 len návrhy kanála. */
  scopeKey: string
  scope: { kind: "proposals"; channelKey: string; topicKey: string | null }
  runId: string
  documentIds: string[]
  documents: PackDocument[]
  pending: string[]
  total: number
  counts: Record<ReviewVerdict, number>
  startedAt: Date
  startedBy: string
  updatedAt: Date
  finishedAt: Date | null
  error: string | null
  failures: number
  leaseUntil: Date | null
}

export function proposalsScopeKey(channelKey: string): string {
  return `proposals:${channelKey}`
}

async function runs() { return getCollection<ComplianceRun>(COMPLIANCE_RUNS_COLLECTION) }

async function loadDocuments(code: string, documentIds: string[]): Promise<RawDocument[]> {
  return (await getCollection(DOCUMENTS_COLLECTION))
    .find({ companyCode: code, documentId: { $in: documentIds } }, { projection: { _id: 0, documentId: 1, title: 1, category: 1, accessLevel: 1, draftMarkdown: 1, versions: 1 } })
    .toArray() as unknown as RawDocument[]
}

export async function reviewRunFor(companyCode: string, scopeKey: string): Promise<ComplianceRun | null> {
  const code = requireCompanyCode(companyCode, "reviewRunFor")
  return (await runs()).findOne({ companyCode: code, scopeKey }, { projection: { _id: 0 } })
}

/**
 * Nový beh kontroly otvorených návrhov kanála (voliteľne jednej témy) proti
 * vybraným dokumentom. Návrhy idú do verejného okna pomoci, preto smú byť
 * referenčné dokumenty len **verejné** (D194).
 */
export async function startProposalReview(
  companyCode: string, channelKey: string, documentIds: string[], topicKey: string | null, actorEmail: string, now = new Date(),
): Promise<ComplianceRun> {
  const code = requireCompanyCode(companyCode, "startProposalReview")
  const ids = [...new Set(documentIds.filter(Boolean))]
  if (!ids.length) throw new ComplianceError("compliance.noDocuments", "Vyberte aspoň jeden dokument.")
  const docs = await loadDocuments(code, ids)
  if (docs.length !== ids.length) throw new ComplianceError("compliance.unknownDocument", "Niektorý z vybraných dokumentov tu nie je.")
  const internal = docs.find(d => d.accessLevel && d.accessLevel !== "public")
  if (internal) throw new ComplianceError("compliance.notPublic", "Na kontrolu verejných návrhov možno použiť len verejné dokumenty.", { title: String(internal.title ?? internal.documentId) })
  const pack = buildPack(docs)
  if (!pack.documents.length) throw new ComplianceError("compliance.emptyDocuments", "Vybrané dokumenty nemajú text.")
  if (pack.text.length > PACK_MAX_CHARS) throw new ComplianceError("compliance.packTooLarge", "Vybrané dokumenty sú spolu príliš veľké — vyberte menej.")
  const ai = await aiForCompany(code)
  if (!ai.apiKey) throw new ComplianceError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const open = await (await getCollection<FaqProposal>(PROPOSALS_COLLECTION))
    .find({ companyCode: code, channelKey, status: "open", ...(topicKey ? { topicKey } : {}) }, { projection: { _id: 0, id: 1 } })
    .sort({ threads: -1, lastMonth: -1, question: 1 }).toArray()
  if (!open.length) throw new ComplianceError("compliance.nothingToCheck", "Nie sú tu otvorené návrhy na kontrolu.")
  const run: ComplianceRun = {
    companyCode: code, scopeKey: proposalsScopeKey(channelKey), scope: { kind: "proposals", channelKey, topicKey },
    runId: randomBytes(8).toString("hex"), documentIds: ids, documents: pack.documents,
    pending: open.map(p => p.id), total: open.length, counts: { agree: 0, differs: 0, not_covered: 0, conflict: 0 },
    startedAt: now, startedBy: actorEmail, updatedAt: now, finishedAt: null, error: null, failures: 0, leaseUntil: null,
  }
  await (await runs()).replaceOne({ companyCode: code, scopeKey: run.scopeKey }, run, { upsert: true })
  return run
}

async function reviewBatch(
  client: Anthropic, model: string, pack: ReferencePack, items: ReviewItem[], actor: UsageActor,
  keySource: Awaited<ReturnType<typeof aiForCompany>>["keySource"],
) {
  const usage = (tokens: Partial<TokenCounts>, failed?: boolean) => void recordAiUsage(usageRecord({
    actor, purpose: "faq-review", subject: `kontrola FAQ: ${items.length} návrhov`, provider: "anthropic", model, keySource, tokens, failed,
  }))
  let answer: Anthropic.Message
  try {
    answer = await client.messages.create({
      model, max_tokens: 16000,
      // Balík dokumentov je pri všetkých dávkach rovnaký → cache na hodinu (cron ide každých 5 minút).
      system: [
        { type: "text", text: REVIEW_SYSTEM },
        { type: "text", text: `REFERENČNÉ DOKUMENTY (zoradené podľa záväznosti, prvý je najvyšší):\n\n${pack.text}`, cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      messages: [{ role: "user", content: reviewPrompt(items) }],
      output_config: { format: { type: "json_schema", schema: REVIEW_SCHEMA as unknown as Record<string, unknown> }, effort: "medium" },
    })
  } catch (e) {
    usage({}, true)
    console.error("[compliance] volanie modelu zlyhalo:", e)
    throw new ComplianceError("compliance.aiFailed", "Kontrola sa nepodarila — skúste to o chvíľu.")
  }
  usage({
    input: answer.usage.input_tokens, output: answer.usage.output_tokens,
    cacheWrite: answer.usage.cache_creation_input_tokens ?? 0, cacheRead: answer.usage.cache_read_input_tokens ?? 0,
  })
  const block = answer.content.find(b => b.type === "text")
  let raw: unknown = null
  try { raw = JSON.parse(block && block.type === "text" ? block.text : "") } catch { raw = null }
  return parseReview(raw, items, pack)
}

export interface ReviewBudget { budgetMs: number; hardMs: number }

/**
 * Ďalšie dávky behu v rámci rozpočtu. Zámok kúska a podmienka `runId`
 * ako pri ťažbe (ADR-030, 9. 10. 2026) — reštart počas behu nič neprepíše.
 */
export async function continueReview(companyCode: string, scopeKey: string, budget: ReviewBudget, actor?: UsageActor): Promise<number> {
  const code = requireCompanyCode(companyCode, "continueReview")
  const col = await runs()
  const now = new Date()
  const run = await col.findOneAndUpdate(
    {
      companyCode: code, scopeKey, "pending.0": { $exists: true }, failures: { $lt: MAX_FAILURES },
      $or: [{ leaseUntil: null }, { leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
    },
    { $set: { leaseUntil: new Date(now.getTime() + budget.hardMs + 60_000) } },
    { returnDocument: "after" },
  )
  if (!run) return 0
  const mine = { companyCode: code, scopeKey, runId: run.runId }
  const ai = await aiForCompany(code)
  if (!ai.apiKey) { await col.updateOne(mine, { $set: { leaseUntil: null } }); return 0 }
  const began = Date.now()
  const model = ai.models.answer
  const client = new Anthropic({ apiKey: ai.apiKey, maxRetries: 1, timeout: 180_000 })
  const who: UsageActor = actor ?? { companyCode: code, personId: null, personName: "Kontrola FAQ (cron)", email: run.startedBy }
  const proposals = await getCollection<FaqProposal>(PROPOSALS_COLLECTION)
  let done = 0
  try {
    const pack = buildPack(await loadDocuments(code, run.documentIds))
    let pending = run.pending.slice()
    while (pending.length) {
      if (done > 0 && Date.now() > began + budget.budgetMs) break
      const r0 = await col.updateOne(mine, { $inc: { failures: 1 }, $set: { updatedAt: new Date() } })
      if (!r0.matchedCount) break
      const ids = pending.slice(0, REVIEW_BATCH)
      const rows = await proposals.find({ companyCode: code, id: { $in: ids }, status: "open" }, { projection: { _id: 0, id: 1, question: 1, variants: 1, answer: 1 } }).toArray()
      const items: ReviewItem[] = ids.flatMap(id => {
        const r = rows.find(x => x.id === id)
        return r ? [{ id: r.id, question: r.question, variants: r.variants, answer: r.answer }] : []
      })
      const results = items.length ? await reviewBatch(client, model, pack, items, who, ai.keySource) : new Map<string, ReturnType<typeof parseReview> extends Map<string, infer V> ? V : never>()
      const counts: Partial<Record<ReviewVerdict, number>> = {}
      for (const it of items) {
        const r = results.get(it.id)
        if (!r) continue
        const review: ProposalReview = {
          ...r, runId: run.runId, at: new Date(), model,
          documents: pack.documents.map(d => ({ documentId: d.documentId, title: d.title, state: d.state, label: d.label })),
          decision: r.verdict === "agree" ? "applied" : null,
        }
        await proposals.updateOne({ companyCode: code, id: it.id, status: "open" }, { $set: { review } })
        counts[r.verdict] = (counts[r.verdict] ?? 0) + 1
      }
      // Návrh bez výsledku (model ho vynechal) sa v tomto behu ďalej neskúša — inak by sa dávka točila.
      await col.updateOne(mine, {
        $pull: { pending: { $in: ids } },
        $inc: Object.fromEntries(Object.entries(counts).map(([k, v]) => [`counts.${k}`, v])) as Record<string, number>,
        $set: { failures: 0, error: null, updatedAt: new Date(), ...(pending.length <= REVIEW_BATCH ? { finishedAt: new Date() } : {}) },
      })
      pending = pending.slice(REVIEW_BATCH)
      done += 1
    }
  } catch (e) {
    console.error(`[compliance] ${code}/${scopeKey} zlyhala:`, e)
    await col.updateOne(mine, { $set: { error: e instanceof AppError ? e.code : "failed", updatedAt: new Date() } })
  } finally {
    await col.updateOne(mine, { $set: { leaseUntil: null } })
  }
  return done
}

export async function reviewsInProgress(): Promise<Pick<ComplianceRun, "companyCode" | "scopeKey">[]> {
  return (await runs())
    .find({ "pending.0": { $exists: true }, failures: { $lt: MAX_FAILURES } }, { projection: { _id: 0, companyCode: 1, scopeKey: 1 } })
    .toArray()
}
