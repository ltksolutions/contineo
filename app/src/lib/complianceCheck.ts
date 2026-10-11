/**
 * complianceCheck.ts — kontrola súladu proti dokumentom knižnice (ADR-032).
 *
 * Spoločný mechanizmus pre dva druhy kontroly:
 *
 *   - **návrhy FAQ** vo fronte kurátora (D191–D193) — verdikt, citácia,
 *     navrhnuté znenie v `faq_proposals.review`, kurátor ho prevezme;
 *   - **dokument proti dokumentom** (D196) — napríklad manuály ISSF proti
 *     stanovám a poriadkom; výsledok je zoznam nálezov pri dokumente
 *     a pri každom náleze rozhodnutie *opravené / vedome ponechané*.
 *
 * Modelu idú **celé texty referenčných dokumentov** (spresnenie D194):
 * platné znenie, a kde ho dokument nemá, koncept s označením. Texty sú
 * zoradené podľa záväznosti druhu (D198) a rozdelené do **balíkov** do
 * `PACK_MAX_CHARS`; dokument väčší než balík sa rozdelí na časti po
 * odsekoch (Ján 10. 10. 2026: „rozdeliť kontrolu do viacerých interných
 * krokov a zlúčiť výsledky"). Každá položka prejde balíkmi postupne od
 * najzáväznejšieho; ďalší krok dostane zistenia predošlých a nesmie ich
 * prebiť nižším dokumentom. Balík je pri všetkých položkách rovnaký, preto
 * ide do cache modelu na hodinu.
 *
 * Prístup (Ján 10. 10. 2026: „kontrolovať interné dokumenty verejnými"):
 * referenčný dokument nesmie byť prísnejší než to, čo sa kontroluje —
 * verejný návrh alebo dokument len proti verejným, interný proti
 * akýmkoľvek. Výsledok vidí ten, kto vidí kontrolovaný obsah.
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
import { recordAiUsage, usageRecord, AI_USAGE_COLLECTION, type UsageActor, type AiUsagePurpose, type AiUsageRecord } from "./aiUsage"
import { DOCUMENTS_COLLECTION } from "./documents"
import { saveDraft } from "./libraryWrite"
import { draftIsFree } from "./textFix"
import { writeAudit } from "./audit"
import { PROPOSALS_COLLECTION, type FaqProposal, type ProposalSource } from "./faqProposals"
import type { TokenCounts } from "./pricing"
import { notify } from "./notifications"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { tenantByCompanyCode, brandingView } from "./tenants"
import { send, complianceDoneEmail } from "./ecomail"
import { normalizeLanguage } from "./i18n"

export class ComplianceError extends AppError {}

export const COMPLIANCE_RUNS_COLLECTION = "compliance_runs"
/** Návrhov v jednom volaní modelu. */
export const REVIEW_BATCH = 4
/** Strop jedného balíka (znaky, ~120 tisíc tokenov); väčší výber sa rozdelí na viac krokov. */
export const PACK_MAX_CHARS = 400_000
/** Strop celého výberu — nad ním by beh trval priveľa krokov. */
export const SELECTION_MAX_CHARS = 2_000_000
export const MAX_FAILURES = 5
/** Kontrolovaných dokumentov naraz v jednom kúsku behu. */
export const DOC_PARALLEL = 2

export type ReviewVerdict = "agree" | "differs" | "not_covered" | "conflict"
export const REVIEW_VERDICTS: ReviewVerdict[] = ["differs", "conflict", "not_covered", "agree"]

/** Poradie záväznosti podľa druhu dokumentu (D198, kým nie je nastavenie organizácie). */
const CATEGORY_RANK: Record<string, number> = { zakon: 0, norma: 1, smernica: 2, metodicky_pokyn: 3, manual: 4 }
export function categoryRank(category: string | null | undefined): number {
  return CATEGORY_RANK[category ?? ""] ?? 5
}

const ACCESS_RANK: Record<string, number> = { public: 0, internal: 1 }
/** Smie sa obsah s úrovňou `subject` kontrolovať dokumentom s úrovňou `reference`? */
export function referenceAllowed(subject: string | null | undefined, reference: string | null | undefined): boolean {
  return (ACCESS_RANK[reference ?? "public"] ?? 1) <= (ACCESS_RANK[subject ?? "public"] ?? 0)
}

export interface PackDocument {
  documentId: string
  title: string
  category: string | null
  /** „valid" — zverejnené znenie; „draft" — dokument platné znenie ešte nemá. */
  state: "valid" | "draft"
  label: string | null
  chars: number
}

/** Jeden krok kontroly: časť referenčných dokumentov, ktorá sa zmestí do jedného volania. */
export interface ReferencePack {
  /** Dokumenty v tomto balíku; číslovanie v texte je 1…n v rámci balíka. */
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

function documentText(d: RawDocument): { text: string; state: "valid" | "draft"; label: string | null } {
  const active = (d.versions ?? []).find(v => v.isActive && v.markdown)
  return active
    ? { text: (active.markdown ?? "").trim(), state: "valid", label: active.label ?? null }
    : { text: (d.draftMarkdown ?? "").trim(), state: "draft", label: null }
}

/** Text dlhší než `max` → časti po odsekoch (prázdny riadok), každá najviac `max`. */
export function splitText(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  const out: string[] = []
  let cur = ""
  for (const para of text.split(/\n\s*\n/)) {
    const piece = para.length > max ? para.match(new RegExp(`[\\s\\S]{1,${max}}`, "g")) ?? [] : [para]
    for (const p of piece) {
      if (cur && cur.length + p.length + 2 > max) { out.push(cur); cur = "" }
      cur = cur ? `${cur}\n\n${p}` : p
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * Dokumenty → balíky v poradí záväznosti. Dokument sa nedelí medzi balíky,
 * kým sa zmestí celý; väčší sa rozdelí na časti s označením „časť k z m".
 * Čisté, bez databázy.
 */
export function buildPacks(docs: RawDocument[], max = PACK_MAX_CHARS): ReferencePack[] {
  const entries = docs.map(d => ({ d, ...documentText(d) }))
    .filter(e => e.text)
    .sort((a, b) => categoryRank(a.d.category) - categoryRank(b.d.category) || String(a.d.title ?? "").localeCompare(String(b.d.title ?? "")))
  const blocks: { meta: PackDocument; header: string; body: string }[] = []
  for (const e of entries) {
    const meta: PackDocument = {
      documentId: e.d.documentId, title: String(e.d.title ?? e.d.documentId), category: e.d.category ?? null,
      state: e.state, label: e.label, chars: e.text.length,
    }
    const parts = splitText(e.text, max - 400)
    parts.forEach((body, i) => blocks.push({
      meta,
      header: `${meta.title}${parts.length > 1 ? ` (časť ${i + 1} z ${parts.length})` : ""}\nDruh: ${meta.category ?? "neuvedený"} · ${meta.state === "valid" ? `platné znenie${meta.label ? ` ${meta.label}` : ""}` : "KONCEPT (zatiaľ nezverejnený)"}`,
      body,
    }))
  }
  const packs: ReferencePack[] = []
  let cur: typeof blocks = []
  let size = 0
  const flush = () => {
    if (!cur.length) return
    const documents: PackDocument[] = []
    const text = cur.map(b => {
      let n = documents.findIndex(x => x.documentId === b.meta.documentId) + 1
      if (!n) { documents.push(b.meta); n = documents.length }
      return `=== Dokument ${n}: ${b.header}\n\n${b.body}`
    }).join("\n\n")
    packs.push({ documents, text })
    cur = []; size = 0
  }
  for (const b of blocks) {
    const len = b.header.length + b.body.length + 20
    if (size && size + len > max) flush()
    cur.push(b); size += len
  }
  flush()
  return packs
}

/** Spätná kompatibilita pre jeden balík (testy, malé výbery). */
export function buildPack(docs: RawDocument[]): ReferencePack {
  const packs = buildPacks(docs)
  return packs.length === 1 ? packs[0] : { documents: packs.flatMap(p => p.documents), text: packs.map(p => p.text).join("\n\n") }
}

// ── Návrhy FAQ: pokyn a schéma ──────────────────────────────────────────────

const COMMON_RULES = [
  "– Kontroluj **len proti dodaným dokumentom**. Čo v nich nie je, nedomýšľaj.",
  "– Dokumenty sú zoradené podľa záväznosti, prvý je najvyšší. Pri rozpore platí vyšší; manuál nesmie prebiť normu. Dokument označený KONCEPT ber ako pracovný.",
  "– Kontrola môže mať viac krokov; v tomto kroku vidíš len časť dokumentov. Ak sú uvedené „doterajšie zistenia“ z vyšších dokumentov, nesmieš ich zmeniť ani prebiť nižším dokumentom — len ich doplniť.",
  "– Pri každom zistení uveď citáciu: číslo dokumentu z tohto kroku, článok alebo časť a krátky doslovný úryvok (najviac 200 znakov).",
  "– V textoch používaj úvodzovky „…“, nikdy znak \".",
]

export const REVIEW_SYSTEM = [
  "Si kurátor FAQ športového zväzu. Dostaneš referenčné dokumenty zväzu (normy, poriadky, manuály) a niekoľko návrhov záznamov FAQ (otázka, iné znenia, odpoveď).",
  "Každý návrh skontroluj a vráť verdikt:",
  "– „agree“ — odpoveď je s dokumentmi v súlade (drobné štylistické rozdiely nevadia),",
  "– „differs“ — odpoveď niečo tvrdí inak než dokumenty, niečo podstatné chýba alebo je zastarané; vtedy napíš opravenú otázku a odpoveď,",
  "– „not_covered“ — dokumenty tému nepokrývajú (odpoveď nemáš ako overiť),",
  "– „conflict“ — dokumenty si v tejto veci protirečia tak, že poradie záväznosti nerozhodne.",
  "Pravidlá:",
  ...COMMON_RULES,
  "– Opravená odpoveď je priama, vecná, pre člena zväzu (vykanie), bez „podľa helpdesku“ a bez mien a údajov konkrétnych osôb. Ponechaj z pôvodnej odpovede všetko, čo je správne; nič, čo v dokumentoch nie je, nepridávaj.",
  "– „note“ je pre kurátora: v čom je rozdiel, čo treba rozhodnúť. Pri „agree“ môže byť prázdna.",
  "Vráť JSON podľa schémy, jeden výsledok ku každému návrhu.",
].join("\n")

const CITATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    doc: { type: "integer", description: "Číslo dokumentu z tohto kroku." },
    ref: { type: "string", description: "Článok, odsek alebo časť." },
    quote: { type: "string", description: "Krátky doslovný úryvok." },
  },
  required: ["doc", "ref", "quote"],
} as const

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
          citations: { type: "array", items: CITATION_SCHEMA },
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

export interface ReviewCitation { documentId: string; title: string; articleRef: string | null; quote: string }

/** Zistenia predošlých krokov k jednej položke — idú do ďalšieho kroku. */
export interface PriorFindings { verdict: ReviewVerdict; citations: ReviewCitation[]; note: string }

function priorText(prior: PriorFindings | undefined): string {
  if (!prior || (prior.verdict === "not_covered" && !prior.citations.length)) return ""
  return [
    "Doterajšie zistenia z vyšších dokumentov (nemeniť, len doplniť):",
    `verdikt: ${prior.verdict}`,
    ...prior.citations.map(c => `– ${c.title}${c.articleRef ? `, ${c.articleRef}` : ""}: „${c.quote}“`),
    ...(prior.note ? [`poznámka: ${prior.note}`] : []),
  ].join("\n")
}

export function reviewPrompt(items: ReviewItem[], prior?: Map<string, PriorFindings>): string {
  return items.map((it, i) => [
    `### Návrh ${i + 1}`,
    `Otázka: ${it.question}`,
    ...(it.variants.length ? [`Iné znenia: ${it.variants.join(" | ")}`] : []),
    "Odpoveď:",
    it.answer,
    ...(priorText(prior?.get(it.id)) ? ["", priorText(prior?.get(it.id))] : []),
  ].join("\n")).join("\n\n")
}

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

type StepResult = Omit<ProposalReview, "runId" | "at" | "model" | "documents" | "decision">

function parseCitations(list: unknown, pack: ReferencePack): ReviewCitation[] {
  return (Array.isArray(list) ? list : []).flatMap(c => {
    const cc = c as Record<string, unknown>
    const d = pack.documents[Number(cc.doc) - 1]
    if (!d) return []
    return [{ documentId: d.documentId, title: d.title, articleRef: String(cc.ref ?? "").trim().slice(0, 120) || null, quote: String(cc.quote ?? "").trim().slice(0, 300) }]
  }).slice(0, 8)
}

/** Odpoveď modelu jedného kroku → výsledok ku každému návrhu dávky. Chýbajúci výsledok = žiadny. */
export function parseReview(raw: unknown, items: ReviewItem[], pack: ReferencePack): Map<string, StepResult> {
  const out = new Map<string, StepResult>()
  const list = (raw as { results?: unknown })?.results
  for (const r of Array.isArray(list) ? list : []) {
    const x = r as Record<string, unknown>
    const i = Number(x.item) - 1
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue
    const verdict = (["agree", "differs", "not_covered", "conflict"] as string[]).includes(String(x.verdict)) ? (x.verdict as ReviewVerdict) : null
    if (!verdict) continue
    const citations = parseCitations(x.citations, pack)
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

/**
 * Zlúčenie výsledkov krokov jednej položky (kroky od najzáväznejšieho).
 * Rozpor alebo zmena z ktoréhokoľvek kroku prebije „súhlasí“; „nepokrýva“
 * platí, len keď nepokrýva žiadny krok. Navrhnuté znenie je z posledného
 * kroku, ktorý ho zmenil — ten už dostal zistenia predošlých.
 */
export function mergeSteps(steps: StepResult[]): StepResult | null {
  if (!steps.length) return null
  const rank: Record<ReviewVerdict, number> = { conflict: 3, differs: 2, agree: 1, not_covered: 0 }
  const verdict = steps.reduce<ReviewVerdict>((v, s) => (rank[s.verdict] > rank[v] ? s.verdict : v), "not_covered")
  const proposed = [...steps].reverse().find(s => s.proposed)?.proposed ?? null
  const citations = [...new Map(steps.flatMap(s => s.citations).map(c => [`${c.documentId}|${c.articleRef ?? ""}|${c.quote}`, c])).values()].slice(0, 12)
  const note = steps.map(s => s.note).filter(Boolean).join("\n\n").slice(0, 4000)
  return { verdict, citations, proposed: verdict === "differs" || verdict === "conflict" ? proposed : null, note }
}

// ── Dokument proti dokumentom: pokyn a schéma (D196) ────────────────────────

export const DOC_REVIEW_SYSTEM = [
  "Si právnik a metodik športového zväzu. Dostaneš referenčné dokumenty zväzu (stanovy, poriadky, normy) a jeden kontrolovaný dokument (napríklad manuál alebo rozpis súťaží).",
  "Nájdi miesta, kde kontrolovaný dokument nie je v súlade s referenčnými dokumentmi. Druhy nálezov:",
  "– „conflict“ — tvrdí niečo v rozpore s normou (lehota, postup, oprávnenie, suma, podmienka),",
  "– „outdated“ — opisuje stav, ktorý norma už nepozná alebo zmenila,",
  "– „missing“ — vynecháva podmienku alebo povinnosť z normy, bez ktorej je postup zavádzajúci,",
  "– „unclear“ — formulácia sa dá vyložiť v rozpore s normou.",
  "Pravidlá:",
  ...COMMON_RULES,
  "– Nehodnoť štýl ani technické kroky v informačnom systéme, ktoré norma neupravuje. Hlásiť len vecné rozpory s normami.",
  "– Ku každému nálezu uveď miesto v kontrolovanom dokumente (časť, nadpis), doslovný úryvok z neho a odporúčanie, ako text opraviť.",
  "– „quote“ skopíruj z kontrolovaného dokumentu presne, znak po znaku, vrátane Markdownu (**, odrážky) — nahrádza sa ním v texte. Jeden súvislý úsek, najviac jeden odsek.",
  "– „proposed“ je nové znenie presne toho úryvku: celý úryvok prepísaný tak, aby bol v súlade s normou (pri „missing“ pôvodný text s doplnením). Rovnaký štýl a Markdown ako dokument, bez odkazov na tento pokyn.",
  "– „summary“ je jedna-dve vety pre autora. Ak nálezy nie sú, vráť prázdny zoznam.",
  "Vráť JSON podľa schémy.",
].join("\n")

export const DOC_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["conflict", "outdated", "missing", "unclear"] },
          location: { type: "string", description: "Časť alebo nadpis v kontrolovanom dokumente." },
          quote: { type: "string", description: "Doslovný úryvok z kontrolovaného dokumentu." },
          citation: CITATION_SCHEMA,
          recommendation: { type: "string" },
          proposed: { type: "string", description: "Nové znenie úryvku „quote“." },
        },
        required: ["kind", "location", "quote", "citation", "recommendation", "proposed"],
      },
    },
    summary: { type: "string" },
  },
  required: ["findings", "summary"],
} as const

export type FindingKind = "conflict" | "outdated" | "missing" | "unclear"
export const FINDING_KINDS: FindingKind[] = ["conflict", "outdated", "missing", "unclear"]

export interface DocumentFinding {
  id: string
  kind: FindingKind
  location: string
  quote: string
  citation: ReviewCitation
  recommendation: string
  /** Navrhnuté nové znenie úryvku `quote`; behy pred 11. 10. 2026 ho nemajú. */
  proposed?: string | null
  /**
   * Rozhodnutie (D196, Ján 11. 10. 2026): `accepted` — prijaté odporúčanie
   * s upraveným znením, `kept` — vedome ponechané. `fixed` je staré
   * „opravené" z behov pred zmenou; číta sa ako prijaté.
   */
  status: "accepted" | "fixed" | "kept" | null
  reason?: string | null
  /** Znenie, ktoré človek prijal (po svojej úprave). */
  acceptedText?: string | null
  /** Kam sa prijaté znenie zapísalo: do konceptu, alebo ho treba vložiť ručne. */
  applied?: "draft" | "manual" | null
  decidedBy?: string | null
  decidedAt?: Date | null
}

export interface DocumentResult {
  documentId: string
  title: string
  state: "valid" | "draft"
  label: string | null
  at: Date
  summary: string
  findings: DocumentFinding[]
}

export function docReviewPrompt(subject: { title: string; text: string }, prior: DocumentFinding[]): string {
  return [
    `### Kontrolovaný dokument: ${subject.title}`,
    "",
    subject.text,
    ...(prior.length ? ["", "Doterajšie nálezy z vyšších dokumentov (neopakovať, nemeniť):", ...prior.map(f => `– ${f.location}: ${f.citation.title}${f.citation.articleRef ? `, ${f.citation.articleRef}` : ""}`)] : []),
  ].join("\n")
}

export function parseDocReview(raw: unknown, pack: ReferencePack, newId: () => string): { findings: DocumentFinding[]; summary: string } {
  const r = raw as { findings?: unknown; summary?: unknown } | null
  const findings: DocumentFinding[] = []
  for (const f of Array.isArray(r?.findings) ? r!.findings as unknown[] : []) {
    const x = f as Record<string, unknown>
    const kind = (FINDING_KINDS as string[]).includes(String(x.kind)) ? (x.kind as FindingKind) : null
    const [citation] = parseCitations([x.citation], pack)
    if (!kind || !citation) continue
    findings.push({
      id: newId(), kind, citation, status: null,
      location: String(x.location ?? "").trim().slice(0, 200),
      quote: String(x.quote ?? "").trim().slice(0, 2000),
      recommendation: String(x.recommendation ?? "").trim().slice(0, 1500),
      proposed: String(x.proposed ?? "").trim().slice(0, 4000) || null,
    })
  }
  return { findings: findings.slice(0, 40), summary: String(r?.summary ?? "").trim().slice(0, 1000) }
}

// ── Beh ─────────────────────────────────────────────────────────────────────

export type RunScope =
  | { kind: "proposals"; channelKey: string; topicKey: string | null }
  | { kind: "documents"; subjectIds: string[] }

export interface ComplianceRun {
  companyCode: string
  scopeKey: string
  scope: RunScope
  runId: string
  /** Referenčné dokumenty. */
  documentIds: string[]
  documents: PackDocument[]
  /** Počet krokov (balíkov) na položku. */
  steps: number
  /** Položky na spracovanie: id návrhov alebo documentId kontrolovaných dokumentov. */
  pending: string[]
  total: number
  counts: Record<ReviewVerdict, number>
  /** Pri kontrole dokumentov: výsledok ku každému kontrolovanému dokumentu. */
  results?: DocumentResult[]
  startedAt: Date
  startedBy: string
  /** Osoba, ktorej príde upozornenie po skončení; behy pred 11. 10. 2026 ho nemajú. */
  startedById?: string | null
  /** Model, ktorý kontrolu robil (kópia v čase behu). */
  model?: string | null
  /** Spotreba behu — súčet volaní; v `ai_usage` je každé volanie zvlášť. */
  usage?: RunUsage
  /** Kedy odišlo upozornenie o skončení — aby neodišlo dvakrát. */
  notifiedAt?: Date | null
  updatedAt: Date
  finishedAt: Date | null
  error: string | null
  failures: number
  leaseUntil: Date | null
}

export interface RunUsage {
  calls: number
  failed: number
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  usd: number
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
 * Kontroly dokumentov (D196) organizácie, najnovšie hore. Vidia ich všetci
 * s rolou kontroly súladu, nie len ten, kto ich spustil (Ján 11. 10. 2026).
 */
export async function documentRuns(companyCode: string, limit = 30): Promise<ComplianceRun[]> {
  const code = requireCompanyCode(companyCode, "documentRuns")
  return (await runs()).find({ companyCode: code, "scope.kind": "documents" }, { projection: { _id: 0 } }).sort({ startedAt: -1 }).limit(limit).toArray()
}

/**
 * Spotreba behu. Behy pred 11. 10. 2026 ju na sebe nemajú — dopočíta sa
 * z `ai_usage` podľa času behu a toho, kto ho spustil (vtedy pod účelom
 * „faq-review"). Nové behy si ju sčítavajú samy pri každom volaní.
 */
export async function runUsage(run: ComplianceRun): Promise<RunUsage | null> {
  if (run.usage) return run.usage
  if (!run.finishedAt) return null
  const [row] = await (await getCollection(AI_USAGE_COLLECTION)).aggregate([
    { $match: { companyCode: run.companyCode, purpose: "faq-review", email: run.startedBy, at: { $gte: run.startedAt, $lte: new Date(run.finishedAt.getTime() + 5000) } } },
    { $group: {
      _id: "$model", calls: { $sum: 1 }, failed: { $sum: { $cond: ["$failed", 1, 0] } },
      input: { $sum: "$tokens.input" }, output: { $sum: "$tokens.output" }, cacheWrite: { $sum: "$tokens.cacheWrite" }, cacheRead: { $sum: "$tokens.cacheRead" }, usd: { $sum: "$usd" },
    } },
  ]).toArray()
  return row ? { calls: row.calls, failed: row.failed, input: row.input, output: row.output, cacheWrite: row.cacheWrite, cacheRead: row.cacheRead, usd: row.usd } : null
}

/** Model behu; pri starých behoch z prvého volania v `ai_usage`. */
export async function runModel(run: ComplianceRun): Promise<string | null> {
  if (run.model) return run.model
  const row = await (await getCollection(AI_USAGE_COLLECTION)).findOne(
    { companyCode: run.companyCode, purpose: "faq-review", email: run.startedBy, at: { $gte: run.startedAt } },
    { projection: { _id: 0, model: 1 }, sort: { at: 1 } },
  )
  return row ? String(row.model) : null
}

export async function documentRun(companyCode: string, runId: string): Promise<ComplianceRun | null> {
  const code = requireCompanyCode(companyCode, "documentRun")
  return (await runs()).findOne({ companyCode: code, runId, "scope.kind": "documents" }, { projection: { _id: 0 } })
}

/** Overí referenčné dokumenty a postaví balíky; spoločné pre oba druhy kontroly. */
async function prepareReferences(code: string, documentIds: string[], subjectAccess: string[]): Promise<{ ids: string[]; packs: ReferencePack[] }> {
  const ids = [...new Set(documentIds.filter(Boolean))]
  if (!ids.length) throw new ComplianceError("compliance.noDocuments", "Vyberte aspoň jeden dokument.")
  const docs = await loadDocuments(code, ids)
  if (docs.length !== ids.length) throw new ComplianceError("compliance.unknownDocument", "Niektorý z vybraných dokumentov tu nie je.")
  const strictest = subjectAccess.includes("public") ? "public" : "internal"
  const tooStrict = docs.find(d => !referenceAllowed(strictest, d.accessLevel))
  if (tooStrict) throw new ComplianceError("compliance.notPublic", "Verejný obsah možno kontrolovať len verejnými dokumentmi.", { title: String(tooStrict.title ?? tooStrict.documentId) })
  const total = docs.reduce((n, d) => n + documentText(d).text.length, 0)
  if (!total) throw new ComplianceError("compliance.emptyDocuments", "Vybrané dokumenty nemajú text.")
  if (total > SELECTION_MAX_CHARS) throw new ComplianceError("compliance.packTooLarge", "Vybrané dokumenty sú spolu príliš veľké — vyberte menej.")
  return { ids, packs: buildPacks(docs) }
}

export interface RunStarter { email: string; personId?: string | null }

function newRun(code: string, scopeKey: string, scope: RunScope, ids: string[], packs: ReferencePack[], pending: string[], starter: RunStarter, model: string, now: Date): ComplianceRun {
  return {
    companyCode: code, scopeKey, scope, runId: randomBytes(8).toString("hex"),
    documentIds: ids, documents: [...new Map(packs.flatMap(p => p.documents).map(d => [d.documentId, d])).values()], steps: packs.length,
    pending, total: pending.length, counts: { agree: 0, differs: 0, not_covered: 0, conflict: 0 },
    ...(scope.kind === "documents" ? { results: [] } : {}),
    startedAt: now, startedBy: starter.email, startedById: starter.personId ?? null, model,
    usage: { calls: 0, failed: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 }, notifiedAt: null,
    updatedAt: now, finishedAt: null, error: null, failures: 0, leaseUntil: null,
  }
}

/**
 * Nový beh kontroly otvorených návrhov kanála (voliteľne jednej témy).
 * Návrhy idú do verejného okna pomoci, preto len verejné referencie (D194).
 */
export async function startProposalReview(
  companyCode: string, channelKey: string, documentIds: string[], topicKey: string | null, actorEmail: string, now = new Date(),
): Promise<ComplianceRun> {
  const code = requireCompanyCode(companyCode, "startProposalReview")
  const { ids, packs } = await prepareReferences(code, documentIds, ["public"])
  const ai = await aiForCompany(code)
  if (!ai.apiKey) throw new ComplianceError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const open = await (await getCollection<FaqProposal>(PROPOSALS_COLLECTION))
    .find({ companyCode: code, channelKey, status: "open", ...(topicKey ? { topicKey } : {}) }, { projection: { _id: 0, id: 1 } })
    .sort({ threads: -1, lastMonth: -1, question: 1 }).toArray()
  if (!open.length) throw new ComplianceError("compliance.nothingToCheck", "Nie sú tu otvorené návrhy na kontrolu.")
  const run = newRun(code, proposalsScopeKey(channelKey), { kind: "proposals", channelKey, topicKey }, ids, packs, open.map(p => p.id), { email: actorEmail }, ai.models.answer, now)
  await (await runs()).replaceOne({ companyCode: code, scopeKey: run.scopeKey }, run, { upsert: true })
  return run
}

/**
 * Nový beh kontroly dokumentov proti dokumentom (D196). Kontrolovaný
 * dokument nesmie byť zároveň referenčný; verejný sa kontroluje len
 * verejnými, interný akýmikoľvek.
 */
export async function startDocumentReview(companyCode: string, subjectIds: string[], documentIds: string[], starter: RunStarter, now = new Date()): Promise<ComplianceRun> {
  const code = requireCompanyCode(companyCode, "startDocumentReview")
  const subjects = [...new Set(subjectIds.filter(Boolean))]
  if (!subjects.length) throw new ComplianceError("compliance.noSubjects", "Vyberte aspoň jeden dokument na kontrolu.")
  const refs = documentIds.filter(id => !subjects.includes(id))
  const subjectDocs = await loadDocuments(code, subjects)
  if (subjectDocs.length !== subjects.length) throw new ComplianceError("compliance.unknownDocument", "Niektorý z vybraných dokumentov tu nie je.")
  if (subjectDocs.some(d => !documentText(d).text)) throw new ComplianceError("compliance.emptyDocuments", "Vybrané dokumenty nemajú text.")
  const { ids, packs } = await prepareReferences(code, refs, subjectDocs.map(d => d.accessLevel ?? "public"))
  const ai = await aiForCompany(code)
  if (!ai.apiKey) throw new ComplianceError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const run = newRun(code, "", { kind: "documents", subjectIds: subjects }, ids, packs, subjects, starter, ai.models.answer, now)
  run.scopeKey = `documents:${run.runId}`
  await (await runs()).insertOne(run)
  return run
}

export interface ReviewBudget { budgetMs: number; hardMs: number }

interface CallCtx {
  client: Anthropic
  model: string
  actor: UsageActor
  keySource: Awaited<ReturnType<typeof aiForCompany>>["keySource"]
  purpose: AiUsagePurpose
  /** Pripočíta volanie k spotrebe behu. */
  onUsage: (rec: AiUsageRecord) => Promise<void>
}

async function callStep(ctx: CallCtx, system: string, pack: ReferencePack, user: string, schema: object, subject: string): Promise<unknown> {
  const usage = async (tokens: Partial<TokenCounts>, failed?: boolean) => {
    const rec = usageRecord({ actor: ctx.actor, purpose: ctx.purpose, subject: subject.slice(0, 200), provider: "anthropic", model: ctx.model, keySource: ctx.keySource, tokens, failed })
    void recordAiUsage(rec)
    await ctx.onUsage(rec)
  }
  let answer: Anthropic.Message
  try {
    answer = await ctx.client.messages.create({
      model: ctx.model, max_tokens: 16000,
      // Balík je pri všetkých položkách rovnaký → cache na hodinu (cron ide každých 5 minút).
      system: [
        { type: "text", text: system },
        { type: "text", text: `REFERENČNÉ DOKUMENTY (zoradené podľa záväznosti, prvý je najvyšší):\n\n${pack.text}`, cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: schema as Record<string, unknown> }, effort: "medium" },
    })
  } catch (e) {
    await usage({}, true)
    console.error("[compliance] volanie modelu zlyhalo:", e)
    throw new ComplianceError("compliance.aiFailed", "Kontrola sa nepodarila — skúste to o chvíľu.")
  }
  await usage({
    input: answer.usage.input_tokens, output: answer.usage.output_tokens,
    cacheWrite: answer.usage.cache_creation_input_tokens ?? 0, cacheRead: answer.usage.cache_read_input_tokens ?? 0,
  })
  const block = answer.content.find(b => b.type === "text")
  try { return JSON.parse(block && block.type === "text" ? block.text : "") } catch { return null }
}

/** Dávka návrhov cez všetky kroky; výsledok zlúčený (`mergeSteps`). */
async function reviewProposalBatch(ctx: CallCtx, packs: ReferencePack[], items: ReviewItem[]): Promise<Map<string, StepResult>> {
  const steps = new Map<string, StepResult[]>()
  const prior = new Map<string, PriorFindings>()
  let current = items
  for (const pack of packs) {
    const raw = await callStep(ctx, REVIEW_SYSTEM, pack, reviewPrompt(current, prior), REVIEW_SCHEMA, `kontrola FAQ: ${items.length} návrhov`)
    const r = parseReview(raw, current, pack)
    for (const [id, res] of r) {
      steps.set(id, [...(steps.get(id) ?? []), res])
      const merged = mergeSteps(steps.get(id)!)!
      prior.set(id, { verdict: merged.verdict, citations: merged.citations, note: merged.note })
    }
    // Ďalší krok kontroluje už opravené znenie, ak ho tento krok navrhol.
    current = current.map(it => {
      const p = r.get(it.id)?.proposed
      return p ? { ...it, question: p.question, answer: p.answer } : it
    })
  }
  const out = new Map<string, StepResult>()
  for (const [id, list] of steps) out.set(id, mergeSteps(list)!)
  return out
}

/** Jeden kontrolovaný dokument cez všetky kroky. */
async function reviewDocument(ctx: CallCtx, packs: ReferencePack[], subject: RawDocument): Promise<DocumentResult> {
  const { text, state, label } = documentText(subject)
  const title = String(subject.title ?? subject.documentId)
  const findings: DocumentFinding[] = []
  const summaries: string[] = []
  let seq = 0
  const newId = () => `f${(++seq).toString().padStart(3, "0")}`
  for (const pack of packs) {
    const raw = await callStep(ctx, DOC_REVIEW_SYSTEM, pack, docReviewPrompt({ title, text }, findings), DOC_REVIEW_SCHEMA, `kontrola dokumentu: ${title}`)
    const r = parseDocReview(raw, pack, newId)
    findings.push(...r.findings)
    if (r.summary) summaries.push(r.summary)
  }
  return { documentId: subject.documentId, title, state, label, at: new Date(), summary: summaries.join(" "), findings }
}

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
  const ctx: CallCtx = {
    client: new Anthropic({ apiKey: ai.apiKey, maxRetries: 1, timeout: 180_000 }),
    model: ai.models.answer, keySource: ai.keySource,
    actor: actor ?? { companyCode: code, personId: run.startedById ?? null, personName: "Kontrola súladu (na pozadí)", email: run.startedBy },
    purpose: run.scope.kind === "documents" ? "compliance-review" : "faq-review",
    onUsage: async rec => {
      await col.updateOne(mine, {
        $inc: {
          "usage.calls": 1, "usage.failed": rec.failed ? 1 : 0,
          "usage.input": rec.tokens.input, "usage.output": rec.tokens.output,
          "usage.cacheWrite": rec.tokens.cacheWrite, "usage.cacheRead": rec.tokens.cacheRead, "usage.usd": rec.usd,
        },
        $set: { model: rec.model },
      })
    },
  }
  const proposals = await getCollection<FaqProposal>(PROPOSALS_COLLECTION)
  let done = 0
  try {
    const packs = buildPacks(await loadDocuments(code, run.documentIds))
    const docMeta = packs.flatMap(p => p.documents).map(d => ({ documentId: d.documentId, title: d.title, state: d.state, label: d.label }))
    let pending = run.pending.slice()
    while (pending.length) {
      if (done > 0 && Date.now() > began + budget.budgetMs) break
      const r0 = await col.updateOne(mine, { $inc: { failures: 1 }, $set: { updatedAt: new Date() } })
      if (!r0.matchedCount) break
      if (run.scope.kind === "proposals") {
        const ids = pending.slice(0, REVIEW_BATCH)
        const rows = await proposals.find({ companyCode: code, id: { $in: ids }, status: "open" }, { projection: { _id: 0, id: 1, question: 1, variants: 1, answer: 1 } }).toArray()
        const items: ReviewItem[] = ids.flatMap(id => {
          const r = rows.find(x => x.id === id)
          return r ? [{ id: r.id, question: r.question, variants: r.variants, answer: r.answer }] : []
        })
        const results = items.length ? await reviewProposalBatch(ctx, packs, items) : new Map<string, StepResult>()
        const counts: Partial<Record<ReviewVerdict, number>> = {}
        for (const it of items) {
          const r = results.get(it.id)
          if (!r) continue
          const review: ProposalReview = { ...r, runId: run.runId, at: new Date(), model: ctx.model, documents: docMeta, decision: r.verdict === "agree" ? "applied" : null }
          await proposals.updateOne({ companyCode: code, id: it.id, status: "open" }, { $set: { review } })
          counts[r.verdict] = (counts[r.verdict] ?? 0) + 1
        }
        await col.updateOne(mine, {
          $pull: { pending: { $in: ids } },
          $inc: Object.fromEntries(Object.entries(counts).map(([k, v]) => [`counts.${k}`, v])) as Record<string, number>,
          $set: { failures: 0, error: null, updatedAt: new Date(), ...(pending.length <= REVIEW_BATCH ? { finishedAt: new Date() } : {}) },
        })
        pending = pending.slice(REVIEW_BATCH)
      } else {
        // Dva dokumenty naraz: referenčný balík je v cache, čas behu sa skráti na polovicu.
        const ids = pending.slice(0, DOC_PARALLEL)
        const subjects = await loadDocuments(code, ids)
        const results = await Promise.all(subjects.map(d => reviewDocument(ctx, packs, d)))
        const withFindings = results.filter(r => r.findings.length).length
        await col.updateOne(mine, {
          $pull: { pending: { $in: ids } },
          ...(results.length ? { $push: { results: { $each: results } } } : {}),
          $inc: { "counts.differs": withFindings, "counts.agree": ids.length - withFindings },
          $set: { failures: 0, error: null, updatedAt: new Date(), ...(pending.length <= ids.length ? { finishedAt: new Date() } : {}) },
        })
        pending = pending.slice(ids.length)
      }
      done += 1
    }
  } catch (e) {
    console.error(`[compliance] ${code}/${scopeKey} zlyhala:`, e)
    await col.updateOne(mine, { $set: { error: e instanceof AppError ? e.code : "failed", updatedAt: new Date() } })
  } finally {
    await col.updateOne(mine, { $set: { leaseUntil: null } })
  }
  if (run.scope.kind === "documents") await announceFinished(code, run.runId)
  return done
}

/**
 * Upozornenie tomu, kto kontrolu spustil: zvonček a e-mail (Ján 11. 10. 2026:
 * „po skončení behu pošle používateľovi"). `notifiedAt` sa nastaví atomicky
 * pred odoslaním, takže súbežný kúsok ani cron druhé neodošle. Zlyhaný
 * e-mail beh nezhodí — zvonček ostáva.
 */
async function announceFinished(code: string, runId: string): Promise<void> {
  const run = await (await runs()).findOneAndUpdate(
    { companyCode: code, runId, "pending.0": { $exists: false }, notifiedAt: null },
    { $set: { notifiedAt: new Date() } },
    { returnDocument: "after", projection: { _id: 0 } },
  )
  if (!run) return
  try {
    const findings = (run.results ?? []).reduce((n, r) => n + r.findings.length, 0)
    const persons = await getCollection<Person>(PERSONS_COLLECTION)
    const person = run.startedById
      ? await persons.findOne({ companyCode: code, id: run.startedById })
      : await persons.findOne({ companyCode: code, email: run.startedBy })
    if (!person) return
    await notify({ companyCode: code, personId: person.id, kind: "complianceDone", params: { runId, count: findings, total: run.total } })
    const tenant = await tenantByCompanyCode(code)
    const host = tenant?.hostnames[0]
    if (!tenant || !host || !person.email) return
    await send({
      to: person.email,
      ...complianceDoneEmail(`https://${host}/library/compliance/${runId}`, host, { documents: run.total, findings, usd: run.usage?.usd ?? null }, normalizeLanguage(person.language), brandingView(tenant)),
    })
  } catch (e) {
    console.error(`[compliance] upozornenie o skončení ${code}/${runId} zlyhalo:`, e)
  }
}

/**
 * Nahradí úryvok `quote` v texte novým znením. Najprv doslovne, potom
 * s voľnými medzerami a koncami riadkov (model občas zlúči riadky).
 * Úryvok, ktorý sa v texte nenájde, alebo sa nájde viackrát, sa nenahrádza —
 * radšej ručne, než na nesprávnom mieste. `null` = nenájdené.
 */
export function replaceQuote(text: string, quote: string, replacement: string): string | null {
  const q = quote.trim()
  if (!q) return null
  const first = text.indexOf(q)
  if (first >= 0) return text.indexOf(q, first + 1) >= 0 ? null : text.slice(0, first) + replacement + text.slice(first + q.length)
  const pattern = new RegExp(q.split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "g")
  const hits = [...text.matchAll(pattern)]
  if (hits.length !== 1) return null
  const at = hits[0].index!
  return text.slice(0, at) + replacement + text.slice(at + hits[0][0].length)
}

export type FindingDecision = "accepted" | "kept"

/**
 * Rozhodnutie o náleze kontroly dokumentu (D196, Ján 11. 10. 2026).
 *
 * - **Ponechať existujúce znenie** — dokument sa nemení, zapíše sa dôvod.
 * - **Prijať odporúčanie a upraviť** — prijaté (človekom upravené) znenie
 *   nahradí úryvok v **koncepte**. Platné znenie sa nikdy nemení: pri
 *   dokumente s platným znením a voľným konceptom vznikne koncept z platného
 *   textu, pri rozpracovanom koncepte sa upraví ten. Do platnosti ide až
 *   bežným zverejnením (schválenie, zodpovedná osoba, potvrdenia).
 *   Keď sa úryvok v texte jednoznačne nenájde, rozhodnutie sa uloží
 *   s `applied: "manual"` a znenie treba vložiť v editore.
 *
 * Dôvod je povinný pri oboch — o rok má byť čitateľné, prečo sa tak stalo.
 */
export async function decideFinding(
  companyCode: string, runId: string, documentId: string, findingId: string,
  decision: FindingDecision, reason: string, text: string, actor: string, canEditDrafts = true,
): Promise<{ applied: "draft" | "manual" | null }> {
  const code = requireCompanyCode(companyCode, "decideFinding")
  const why = reason.trim()
  const accepted = text.replace(/\r\n?/g, "\n").trim()
  if (!why) throw new ComplianceError("compliance.reasonRequired", "Uveďte dôvod rozhodnutia.")
  if (decision === "accepted" && !accepted) throw new ComplianceError("compliance.textRequired", "Prijaté znenie nemôže byť prázdne.")
  const run = await documentRun(code, runId)
  const finding = run?.results?.find(r => r.documentId === documentId)?.findings.find(f => f.id === findingId)
  if (!run || !finding) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")

  let applied: "draft" | "manual" | null = null
  if (decision === "accepted" && !canEditDrafts) applied = "manual"
  else if (decision === "accepted") {
    const docs = await getCollection(DOCUMENTS_COLLECTION)
    const doc = await docs.findOne({ companyCode: code, documentId }) as Record<string, unknown> | null
    if (!doc) throw new ComplianceError("library.documentNotFound", "Taký dokument tu nie je.")
    const versions = (doc.versions ?? []) as { versionId: string; label: string; markdown?: string; isActive?: boolean; pdf?: { id?: string } }[]
    const draft = String(doc.draftMarkdown ?? "")
    const draftPdf = (doc.draftPdf as { id?: string } | null | undefined)?.id ?? null
    const active = versions.find(v => v.isActive)
    const free = draftIsFree(draft, versions, draftPdf, versions.map(v => v.pdf?.id ?? "").filter(Boolean))
    const base = free && active ? String(active.markdown ?? doc.markdown ?? "") : draft
    const next = replaceQuote(base, finding.quote, accepted)
    if (next !== null && next.trim() !== base.trim()) {
      await saveDraft(code, documentId, next, `${actor} (kontrola súladu)`)
      applied = "draft"
    } else {
      applied = next === null ? "manual" : null
    }
  }

  const r = await (await runs()).updateOne(
    { companyCode: code, runId, "scope.kind": "documents" },
    { $set: {
      "results.$[d].findings.$[f].status": decision,
      "results.$[d].findings.$[f].reason": why,
      "results.$[d].findings.$[f].acceptedText": decision === "accepted" ? accepted : null,
      "results.$[d].findings.$[f].applied": applied,
      "results.$[d].findings.$[f].decidedBy": actor,
      "results.$[d].findings.$[f].decidedAt": new Date(),
    } },
    { arrayFilters: [{ "d.documentId": documentId }, { "f.id": findingId }] },
  )
  if (!r.matchedCount) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")
  await writeAudit({
    companyCode: code, subject: "document", action: decision === "accepted" ? "kontrola-suladu-prijate" : "kontrola-suladu-ponechane",
    actor, targetId: documentId, targetLabel: run.results!.find(x => x.documentId === documentId)!.title,
    note: `${finding.location} — ${finding.citation.title}${finding.citation.articleRef ? `, ${finding.citation.articleRef}` : ""}: ${why}`.slice(0, 1000),
  })
  return { applied }
}

export async function reviewsInProgress(): Promise<Pick<ComplianceRun, "companyCode" | "scopeKey">[]> {
  return (await runs())
    .find({ "pending.0": { $exists: true }, failures: { $lt: MAX_FAILURES } }, { projection: { _id: 0, companyCode: 1, scopeKey: 1 } })
    .toArray()
}
