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
import { articleHash } from "./articleAnchors"
import { textFingerprint } from "./chunkIdentity"
import { notify, notifyPeople } from "./notifications"
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

/**
 * Posledný krok kontroly návrhov FAQ (11. 10. 2026): poznámka za celý návrh
 * pre kurátora. Dovtedy sa spájali poznámky všetkých krokov a v poznámke
 * ostali vety typu „Doterajšie zistenie not_covered vychádzalo z vyšších
 * noriem; tento krok…" — o krokoch, nie o návrhu.
 */
export const FINAL_REVIEW_NOTE = "Toto je posledný krok kontroly. „note“ pri každom návrhu napíš za celý návrh — zhrň aj doterajšie zistenia vyššie, jednou-tromi vetami pre kurátora. Nepíš o krokoch, o tom, ktoré normy v tomto kroku neboli, ani interné označenia verdiktov (agree, differs, not_covered, conflict)."

export function reviewPrompt(items: ReviewItem[], prior?: Map<string, PriorFindings>, last = false): string {
  const body = items.map((it, i) => [
    `### Návrh ${i + 1}`,
    `Otázka: ${it.question}`,
    ...(it.variants.length ? [`Iné znenia: ${it.variants.join(" | ")}`] : []),
    "Odpoveď:",
    it.answer,
    ...(priorText(prior?.get(it.id)) ? ["", priorText(prior?.get(it.id))] : []),
  ].join("\n")).join("\n\n")
  return last ? `${body}\n\n${FINAL_REVIEW_NOTE}` : body
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
  // Poznámku za celý návrh píše posledný krok (FINAL_REVIEW_NOTE); spájajú sa len pri jedinom kroku bez nej.
  const note = ([...steps].reverse().find(s => s.note)?.note ?? "").slice(0, 4000)
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
  /**
   * Kam sa prijaté znenie zapísalo: `draft` — do konceptu; `pending` —
   * prijal ho niekto bez roly správcu obsahu a čaká na zápis; `manual` —
   * úryvok sa v texte nenašiel jednoznačne a treba ho vložiť ručne.
   * `pending` je od 11. 10. 2026 (KNIZ-kontrola-suladu-detail); staršie
   * rozhodnutia bez práv nesú `manual`.
   */
  applied?: FindingApplied
  /** Ponechanie prevzaté z predchádzajúcej kontroly (pamäť rozhodnutí, 11. 10. 2026). */
  carriedFrom?: { runId: string; findingId: string } | null
  /** Kto znenie zapísal do konceptu, keď ho prijal niekto bez roly správcu obsahu. */
  appliedBy?: string | null
  appliedAt?: Date | null
  decidedBy?: string | null
  decidedAt?: Date | null
}

export type FindingApplied = "draft" | "pending" | "manual" | null

export interface DocumentResult {
  documentId: string
  /**
   * Odtlačok textu dokumentu po tejto kontrole (D200, 11. 10. 2026): pri
   * vzniku výsledku skontrolovaný text, potom sa posúva s každým zápisom
   * prijatého znenia z tejto kontroly. Keď sa zverejnený text zhoduje a všetko
   * je rozhodnuté, nové znenie dokumentu požiadavku na kontrolu nevytvorí.
   * Ručná úprava konceptu mimo kontroly reťaz pretrhne — a požiadavka vznikne.
   */
  textHash?: string
  title: string
  state: "valid" | "draft"
  label: string | null
  at: Date
  summary: string
  findings: DocumentFinding[]
}

/**
 * Posledný krok píše zhrnutie za celý dokument (KNIZ-kontrola-suladu-detail,
 * Q3, 11. 10. 2026) — spojené zhrnutia krokov mali vety typu „RaPP v tomto
 * kroku nebol…", ktoré čitateľovi nič nehovoria.
 */
export const FINAL_STEP_NOTE = "Toto je posledný krok kontroly. „summary“ napíš za celý dokument — zhrň aj doterajšie nálezy vyššie; nepíš o krokoch ani o tom, ktoré normy v tomto kroku neboli."

export function docReviewPrompt(subject: { title: string; text: string }, prior: DocumentFinding[], last = false, kept: KeptDecision[] = []): string {
  return [
    `### Kontrolovaný dokument: ${subject.title}`,
    "",
    subject.text,
    ...(prior.length ? ["", "Doterajšie nálezy z vyšších dokumentov (neopakovať, nemeniť):", ...prior.map(f => `– ${f.kind} · ${f.location}: ${f.citation.title}${f.citation.articleRef ? `, ${f.citation.articleRef}` : ""}`)] : []),
    // Pamäť rozhodnutí (Ján 11. 10. 2026): autor tieto miesta vedome ponechal — nehlásiť znova.
    ...(kept.length ? ["", "Miesta, ktoré autor v predchádzajúcej kontrole vedome ponechal (s dôvodom). Nehlásiť ich znova, ani inou formuláciou:", ...kept.map(k => `– ${k.location}: ${k.citationTitle}${k.articleRef ? `, ${k.articleRef}` : ""} — dôvod: ${k.reason}`)] : []),
    ...(last ? ["", FINAL_STEP_NOTE] : []),
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
  /** Názov kontroly zadaný pri spustení (Q4); prázdny = „Kontrola <dátum>". */
  name?: string | null
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
  /** Rozpracované dokumenty — hotové kroky, kým neprejdú všetkými balíkmi. */
  partials?: DocumentPartial[]
  /** Kedy sa ktorý balík naposledy poslal modelu — či je ešte v cache (1 h). */
  warmPacks?: WarmPack[]
  /** Kontrola návrhov FAQ: rozpracovaná dávka medzi kúskami behu. */
  proposalBatch?: ProposalBatch | null
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

/** Beh ešte pracuje (nie je hotový ani zastavený po opakovaných chybách). */
export function isRunning(run: Pick<ComplianceRun, "pending" | "failures"> | null | undefined): boolean {
  return Boolean(run && run.pending.length > 0 && run.failures < MAX_FAILURES)
}

/**
 * Nový beh kontroly otvorených návrhov kanála (voliteľne jednej témy).
 * Návrhy idú do verejného okna pomoci, preto len verejné referencie (D194).
 */
export async function startProposalReview(
  companyCode: string, channelKey: string, documentIds: string[], topicKey: string | null, actorEmail: string, now = new Date(),
): Promise<ComplianceRun> {
  const code = requireCompanyCode(companyCode, "startProposalReview")
  // Druhé spustenie by beh prepísalo a rozbehnutá práca by sa zahodila (Ján 11. 10. 2026).
  if (isRunning(await reviewRunFor(code, proposalsScopeKey(channelKey)))) throw new ComplianceError("compliance.alreadyRunning", "Kontrola už beží — počkajte, kým dobehne.")
  const { ids, packs } = await prepareReferences(code, documentIds, ["public"])
  const ai = await aiForCompany(code)
  if (!ai.apiKey) throw new ComplianceError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const open = await (await getCollection<FaqProposal>(PROPOSALS_COLLECTION))
    .find({ companyCode: code, channelKey, status: "open", ...(topicKey ? { topicKey } : {}) }, { projection: { _id: 0, id: 1 } })
    .sort({ threads: -1, lastMonth: -1, question: 1 }).toArray()
  if (!open.length) throw new ComplianceError("compliance.nothingToCheck", "Nie sú tu otvorené návrhy na kontrolu.")
  const run = newRun(code, proposalsScopeKey(channelKey), { kind: "proposals", channelKey, topicKey }, ids, packs, open.map(p => p.id), { email: actorEmail }, ai.models.compliance, now)
  await (await runs()).replaceOne({ companyCode: code, scopeKey: run.scopeKey }, run, { upsert: true })
  return run
}

/** Názov kontroly: jeden riadok, najviac 120 znakov; prázdny = podľa dátumu. */
export function runTitle(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 120)
}

/**
 * Premenovanie kontroly (Ján 11. 10. 2026: „neviem zmeniť/uložiť názov
 * kontroly") — pole „Názov" bolo len pri spustení. Prázdny názov ho zruší
 * a kontrola sa znova volá podľa dátumu.
 */
export async function renameRun(companyCode: string, runId: string, name: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "renameRun")
  const title = runTitle(name)
  const r = await (await runs()).updateOne(
    { companyCode: code, runId, "scope.kind": "documents" },
    title ? { $set: { name: title } } : { $unset: { name: "" } },
  )
  if (!r.matchedCount) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")
}

/**
 * Nový beh kontroly dokumentov proti dokumentom (D196). Kontrolovaný
 * dokument nesmie byť zároveň referenčný; verejný sa kontroluje len
 * verejnými, interný akýmikoľvek.
 */
export async function startDocumentReview(companyCode: string, subjectIds: string[], documentIds: string[], starter: RunStarter, now = new Date(), name = ""): Promise<ComplianceRun> {
  const code = requireCompanyCode(companyCode, "startDocumentReview")
  const subjects = [...new Set(subjectIds.filter(Boolean))]
  if (!subjects.length) throw new ComplianceError("compliance.noSubjects", "Vyberte aspoň jeden dokument na kontrolu.")
  // Tie isté dokumenty už kontroluje rozbehnutý beh — druhý by len zdvojil prácu a cenu.
  const same = [...subjects].sort().join("|")
  const active = await (await runs()).find({ companyCode: code, "scope.kind": "documents", "pending.0": { $exists: true }, failures: { $lt: MAX_FAILURES } }, { projection: { _id: 0, scope: 1 } }).toArray()
  if (active.some(r => r.scope.kind === "documents" && [...r.scope.subjectIds].sort().join("|") === same)) throw new ComplianceError("compliance.alreadyRunning", "Kontrola už beží — počkajte, kým dobehne.")
  const refs = documentIds.filter(id => !subjects.includes(id))
  const subjectDocs = await loadDocuments(code, subjects)
  if (subjectDocs.length !== subjects.length) throw new ComplianceError("compliance.unknownDocument", "Niektorý z vybraných dokumentov tu nie je.")
  if (subjectDocs.some(d => !documentText(d).text)) throw new ComplianceError("compliance.emptyDocuments", "Vybrané dokumenty nemajú text.")
  const { ids, packs } = await prepareReferences(code, refs, subjectDocs.map(d => d.accessLevel ?? "public"))
  const ai = await aiForCompany(code)
  if (!ai.apiKey) throw new ComplianceError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const run = newRun(code, "", { kind: "documents", subjectIds: subjects }, ids, packs, subjects, starter, ai.models.compliance, now)
  run.scopeKey = `documents:${run.runId}`
  const title = runTitle(name)
  if (title) run.name = title
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
/**
 * Rozpracovaná dávka návrhov FAQ (11. 10. 2026): kúsok behu je **jeden krok**
 * (jeden balík noriem), nie celá dávka — pri Opus 5.5 by štyri návrhy cez tri
 * balíky za sebou prekročili 300 s funkcie a dávka by sa začínala odznova,
 * až kým by sa beh po piatich pokusoch nezastavil. Rovnako ako pri
 * dokumentoch (`DocumentPartial`).
 */
export interface ProposalBatch {
  ids: string[]
  /** Koľko balíkov je už hotových. */
  step: number
  /** Znenie, ktoré kontroluje ďalší krok — opravené, ak ho predošlý krok navrhol. */
  current: ReviewItem[]
  steps: { id: string; results: StepResult[] }[]
}

/** Jeden krok dávky návrhov: jeden balík noriem. */
async function reviewProposalStep(ctx: CallCtx, packs: ReferencePack[], batch: ProposalBatch): Promise<ProposalBatch> {
  const pack = packs[batch.step]
  const prior = new Map<string, PriorFindings>()
  for (const s of batch.steps) {
    const merged = mergeSteps(s.results)
    if (merged) prior.set(s.id, { verdict: merged.verdict, citations: merged.citations, note: merged.note })
  }
  const raw = await callStep(ctx, REVIEW_SYSTEM, pack, reviewPrompt(batch.current, prior, batch.step === packs.length - 1 && packs.length > 1), REVIEW_SCHEMA, `kontrola FAQ: ${batch.current.length} návrhov`)
  const r = parseReview(raw, batch.current, pack)
  const steps = batch.steps.map(s => ({ ...s, results: [...s.results] }))
  for (const [id, res] of r) {
    const row = steps.find(s => s.id === id)
    if (row) row.results.push(res)
    else steps.push({ id, results: [res] })
  }
  // Ďalší krok kontroluje už opravené znenie, ak ho tento krok navrhol.
  const current = batch.current.map(it => {
    const p = r.get(it.id)?.proposed
    return p ? { ...it, question: p.question, answer: p.answer } : it
  })
  return { ids: batch.ids, step: batch.step + 1, current, steps }
}

export interface WarmPack { step: number; at: Date }

/** Cache modelu drží balík hodinu; s rezervou 55 minút od posledného použitia. */
export const WARM_MS = 55 * 60_000

export function packWarm(warm: WarmPack[], step: number, now = Date.now()): boolean {
  return warm.some(w => w.step === step && now - new Date(w.at).getTime() < WARM_MS)
}

export function markWarm(warm: WarmPack[], step: number, at = new Date()): WarmPack[] {
  return [...warm.filter(w => w.step !== step), { step, at }]
}

/** Rozpracovaný kontrolovaný dokument — hotové kroky a ich nálezy. */
export interface DocumentPartial {
  documentId: string
  /** Koľko balíkov je už hotových. */
  step: number
  findings: DocumentFinding[]
  summaries: string[]
}

/**
 * Jeden krok kontroly dokumentu: jeden balík noriem. Kúsok behu je krok,
 * nie celý dokument (11. 10. 2026) — pri Opus 5.5 by tri balíky za sebou
 * prekročili 300 s funkcie a dokument by sa začínal stále odznova.
 */
async function reviewDocumentStep(ctx: CallCtx, packs: ReferencePack[], subject: RawDocument, partial: DocumentPartial, kept: KeptDecision[] = []): Promise<DocumentPartial> {
  const { text } = documentText(subject)
  const title = String(subject.title ?? subject.documentId)
  const pack = packs[partial.step]
  let seq = partial.findings.length
  const newId = () => `f${(++seq).toString().padStart(3, "0")}`
  const last = partial.step === packs.length - 1
  const raw = await callStep(ctx, DOC_REVIEW_SYSTEM, pack, docReviewPrompt({ title, text }, partial.findings, last && packs.length > 1, kept), DOC_REVIEW_SCHEMA, `kontrola dokumentu: ${title}`)
  const r = parseDocReview(raw, pack, newId)
  return { documentId: partial.documentId, step: partial.step + 1, findings: [...partial.findings, ...r.findings], summaries: r.summary ? [...partial.summaries, r.summary] : partial.summaries }
}

function documentResult(subject: RawDocument, partial: DocumentPartial, kept: KeptDecision[] = []): DocumentResult {
  const { state, label } = documentText(subject)
  // Zhrnutie za dokument napísal posledný krok (Q3); medzikroky sa nespájajú.
  return { documentId: subject.documentId, textHash: textFingerprint(documentText(subject).text), title: String(subject.title ?? subject.documentId), state, label, at: new Date(), summary: partial.summaries.at(-1) ?? "", findings: carryKept(partial.findings, kept) }
}

/** Vedome ponechané miesto z predchádzajúcej kontroly — pamäť rozhodnutí (Ján 11. 10. 2026). */
export interface KeptDecision {
  runId: string
  findingId: string
  location: string
  quote: string
  citationDocumentId: string
  citationTitle: string
  articleRef: string | null
  reason: string
  decidedBy: string | null
  decidedAt: Date | null
}

/** Ten istý nález ako ponechaný? Tá istá norma a článok, a ten istý úryvok alebo miesto. */
export function sameKept(f: DocumentFinding, k: KeptDecision): boolean {
  if (f.citation.documentId !== k.citationDocumentId) return false
  const art = (r: string | null | undefined) => articleHash(r).replace(/-ods-.*$/, "")
  if (art(f.citation.articleRef) !== art(k.articleRef)) return false
  return quotesOverlap(f.quote, k.quote) || f.location.trim().slice(0, 30) === k.location.trim().slice(0, 30)
}

/**
 * Nález, ktorý model napriek pokynu nahlásil znova, prevezme ponechanie
 * z predchádzajúcej kontroly: stav, dôvod, kto a kedy, plus `carriedFrom`.
 * Človek ho vidí zbalený medzi rozhodnutými a môže ho zmeniť.
 */
export function carryKept(findings: DocumentFinding[], kept: KeptDecision[]): DocumentFinding[] {
  return findings.map(f => {
    if (f.status) return f
    const k = kept.find(x => sameKept(f, x))
    return k ? { ...f, status: "kept" as const, reason: k.reason, decidedBy: k.decidedBy, decidedAt: k.decidedAt, carriedFrom: { runId: k.runId, findingId: k.findingId } } : f
  })
}

/**
 * Ponechané rozhodnutia ku kontrolovanému dokumentu zo starších behov,
 * najnovšie rozhodnutie pre to isté miesto vyhráva. Prevzaté ponechanie sa
 * znova nepreberá zo seba samého — nesie odkaz na pôvodné.
 */
export async function keptDecisions(companyCode: string, documentId: string, exceptRunId: string): Promise<KeptDecision[]> {
  const code = requireCompanyCode(companyCode, "keptDecisions")
  const list = await (await runs()).find(
    { companyCode: code, "scope.kind": "documents", runId: { $ne: exceptRunId }, "results.documentId": documentId },
    { projection: { _id: 0, runId: 1, startedAt: 1, results: 1 } },
  ).sort({ startedAt: -1 }).toArray()
  // Od najnovšieho behu: prvé rozhodnutie o mieste platí (aj prijatie), staršie sa preskočia.
  const decided: KeptDecision[] = []
  const out: KeptDecision[] = []
  for (const run of list) {
    const res = (run.results ?? []).find(r => r.documentId === documentId)
    for (const f of res?.findings ?? []) {
      if (!f.status) continue
      const place: KeptDecision = {
        runId: f.carriedFrom?.runId ?? run.runId, findingId: f.carriedFrom?.findingId ?? f.id,
        location: f.location, quote: f.quote, citationDocumentId: f.citation.documentId, citationTitle: f.citation.title,
        articleRef: f.citation.articleRef, reason: f.reason ?? "", decidedBy: f.decidedBy ?? null, decidedAt: f.decidedAt ?? null,
      }
      if (decided.some(d => sameKept({ ...f, status: null }, d))) continue
      decided.push(place)
      if (f.status === "kept" && place.reason) out.push(place)
    }
  }
  return out
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
    // Bez opakovania v SDK: dve volania po 200 s by prekročili hranicu funkcie;
    // zlyhaný kúsok zopakuje ďalší (MAX_FAILURES).
    client: new Anthropic({ apiKey: ai.apiKey, maxRetries: 0, timeout: 200_000 }),
    model: ai.models.compliance, keySource: ai.keySource,
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
    let partials: DocumentPartial[] = run.partials ?? []
    let warm: WarmPack[] = run.warmPacks ?? []
    let batch: ProposalBatch | null = run.proposalBatch ?? null
    let longest = 0
    while (pending.length) {
      // Ďalší kúsok len vtedy, keď sa zmestí aj do tvrdej hranice — inak by ho funkcia zabila v polovici.
      if (done > 0 && (Date.now() > began + budget.budgetMs || Date.now() - began + longest > budget.hardMs - 10_000)) break
      const chunkStart = Date.now()
      const r0 = await col.updateOne(mine, { $inc: { failures: 1 }, $set: { updatedAt: new Date() } })
      if (!r0.matchedCount) break
      if (run.scope.kind === "proposals") {
        if (!batch) {
          const ids = pending.slice(0, REVIEW_BATCH)
          const rows = await proposals.find({ companyCode: code, id: { $in: ids }, status: "open" }, { projection: { _id: 0, id: 1, question: 1, variants: 1, answer: 1 } }).toArray()
          const items: ReviewItem[] = ids.flatMap(id => {
            const r = rows.find(x => x.id === id)
            return r ? [{ id: r.id, question: r.question, variants: r.variants, answer: r.answer }] : []
          })
          batch = { ids, step: 0, current: items, steps: [] }
        }
        if (batch.current.length) batch = await reviewProposalStep(ctx, packs, batch)
        if (!batch.current.length || batch.step >= packs.length) {
          const ids = batch.ids
          const counts: Partial<Record<ReviewVerdict, number>> = {}
          for (const s of batch.steps) {
            const r = mergeSteps(s.results)
            if (!r) continue
            const review: ProposalReview = { ...r, runId: run.runId, at: new Date(), model: ctx.model, documents: docMeta, decision: r.verdict === "agree" ? "applied" : null }
            await proposals.updateOne({ companyCode: code, id: s.id, status: "open" }, { $set: { review } })
            counts[r.verdict] = (counts[r.verdict] ?? 0) + 1
          }
          const finished = pending.every(id => ids.includes(id))
          await col.updateOne(mine, {
            $pull: { pending: { $in: ids } },
            $inc: Object.fromEntries(Object.entries(counts).map(([k, v]) => [`counts.${k}`, v])) as Record<string, number>,
            $set: { proposalBatch: null, failures: 0, error: null, updatedAt: new Date(), ...(finished ? { finishedAt: new Date() } : {}) },
          })
          pending = pending.filter(id => !ids.includes(id))
          batch = null
        } else {
          await col.updateOne(mine, { $set: { proposalBatch: batch, failures: 0, error: null, updatedAt: new Date() } })
        }
      } else {
        // Dva dokumenty naraz, po jednom kroku: referenčný balík je v cache.
        const ids = pending.slice(0, DOC_PARALLEL)
        const subjects = await loadDocuments(code, ids)
        const keptBy = new Map(await Promise.all(subjects.map(async d => [d.documentId, await keptDecisions(code, d.documentId, run.runId)] as const)))
        const items = subjects.map(d => ({ d, p: partials.find(p => p.documentId === d.documentId) ?? { documentId: d.documentId, step: 0, findings: [], summaries: [] } }))
        const stepped: DocumentPartial[] = []
        // Studený balík (v cache ešte nie je) ide najprv s jedným dokumentom;
        // súbežné volania by ho zapísali každé zvlášť (11. 10. 2026: prvé dva
        // manuály 6 zápisov po ~0,7 USD namiesto 3). Teplé idú súbežne.
        let queue = items
        while (queue.length) {
          const cold = queue.find(it => !packWarm(warm, it.p.step))
          const group = cold ? [cold] : queue
          const out = await Promise.all(group.map(it => reviewDocumentStep(ctx, packs, it.d, it.p, keptBy.get(it.d.documentId) ?? [])))
          stepped.push(...out)
          for (const it of group) warm = markWarm(warm, it.p.step)
          queue = queue.filter(it => !group.includes(it))
        }
        const doneIds = ids.filter(id => !subjects.some(d => d.documentId === id) || (stepped.find(p => p.documentId === id)?.step ?? 0) >= packs.length)
        const results = subjects.filter(d => doneIds.includes(d.documentId)).map(d => documentResult(d, stepped.find(p => p.documentId === d.documentId)!, keptBy.get(d.documentId) ?? []))
        partials = [...partials.filter(p => !ids.includes(p.documentId)), ...stepped.filter(p => !doneIds.includes(p.documentId))]
        const withFindings = results.filter(r => r.findings.length).length
        const finished = pending.length <= doneIds.length && doneIds.length === pending.length
        await col.updateOne(mine, {
          ...(doneIds.length ? { $pull: { pending: { $in: doneIds } } } : {}),
          ...(results.length ? { $push: { results: { $each: results } } } : {}),
          $inc: { "counts.differs": withFindings, "counts.agree": doneIds.length - withFindings },
          $set: { partials, warmPacks: warm, failures: 0, error: null, updatedAt: new Date(), ...(finished ? { finishedAt: new Date() } : {}) },
        })
        pending = pending.filter(id => !doneIds.includes(id))
      }
      done += 1
      longest = Math.max(longest, Date.now() - chunkStart)
    }
  } catch (e) {
    console.error(`[compliance] ${code}/${scopeKey} zlyhala:`, e)
    await col.updateOne(mine, { $set: { error: e instanceof AppError ? e.code : "failed", updatedAt: new Date() } })
  } finally {
    await col.updateOne(mine, { $set: { leaseUntil: null } })
  }
  await announceFinished(code, run.runId)
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
    // Pri návrhoch FAQ sú „nálezy" návrhy, ktoré sa od dokumentov odlišujú alebo s nimi kolidujú.
    const proposalsRun = run.scope.kind === "proposals"
    const findings = proposalsRun
      ? (run.counts?.differs ?? 0) + (run.counts?.conflict ?? 0)
      : (run.results ?? []).reduce((n, r) => n + r.findings.length, 0)
    const persons = await getCollection<Person>(PERSONS_COLLECTION)
    const person = run.startedById
      ? await persons.findOne({ companyCode: code, id: run.startedById })
      : await persons.findOne({ companyCode: code, email: run.startedBy })
    if (!person) return
    const channelKey = run.scope.kind === "proposals" ? run.scope.channelKey : null
    await notify(channelKey
      ? { companyCode: code, personId: person.id, kind: "faqReviewDone", params: { channelKey, count: findings, total: run.total } }
      : { companyCode: code, personId: person.id, kind: "complianceDone", params: { runId, count: findings, total: run.total } })
    const tenant = await tenantByCompanyCode(code)
    const host = tenant?.hostnames[0]
    if (!tenant || !host || !person.email) return
    await send({
      to: person.email,
      ...complianceDoneEmail(
        channelKey ? `https://${host}/channels/${encodeURIComponent(channelKey)}/proposals` : `https://${host}/library/compliance/${runId}`,
        host, { documents: run.total, findings, usd: run.usage?.usd ?? null, proposals: Boolean(channelKey) }, normalizeLanguage(person.language), brandingView(tenant),
      ),
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
 * Zapíše prijaté znenie do konceptu dokumentu namiesto úryvku. Platné znenie
 * sa nemení: pri voľnom koncepte sa koncept založí z platného textu, pri
 * rozpracovanom sa upraví ten. `manual` = úryvok sa jednoznačne nenašiel,
 * `null` = text sa nemení (znenie je rovnaké).
 */
/**
 * Text, do ktorého sa prijaté znenie zapisuje: rozpracovaný koncept, alebo
 * pri voľnom koncepte platné znenie (z neho koncept vznikne). `null` = taký dokument tu nie je.
 */
export async function draftBase(code: string, documentId: string): Promise<string | null> {
  const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne({ companyCode: code, documentId }) as Record<string, unknown> | null
  if (!doc) return null
  const versions = (doc.versions ?? []) as { versionId: string; label: string; markdown?: string; isActive?: boolean; pdf?: { id?: string } }[]
  const draft = String(doc.draftMarkdown ?? "")
  const draftPdf = (doc.draftPdf as { id?: string } | null | undefined)?.id ?? null
  const active = versions.find(v => v.isActive)
  const free = draftIsFree(draft, versions, draftPdf, versions.map(v => v.pdf?.id ?? "").filter(Boolean))
  return free && active ? String(active.markdown ?? doc.markdown ?? "") : draft
}

const loose = (s: string) => s.replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim()

/** Týkajú sa dva úryvky toho istého miesta? Rovnaké, alebo jeden obsahuje druhý (bez Markdownu a medzier). */
export function quotesOverlap(a: string, b: string): boolean {
  const x = loose(a), y = loose(b)
  if (x.length < 20 || y.length < 20) return x === y && x.length > 0
  return x === y || x.includes(y) || y.includes(x)
}

/**
 * Aktuálne znenie miesta, ktoré už zmenil prijatý nález tohto behu (Ján
 * 11. 10. 2026: dva nálezy na jednu vetu — druhý sa nezapísal, lebo pôvodná
 * veta v koncepte už nebola, alebo pri doplnení prepísal len jej začiatok
 * a doplnenie prvého nevidel). Vracia sa **celý riadok** (odsek, odrážka),
 * v ktorom zapísané znenie leží — po dvoch doplneniach je zapísané znenie
 * prvého nálezu už len časťou riadku a nahradiť treba celý. `includeSelf`
 * pri zápise: zmena vlastného rozhodnutia nahrádza vlastné zapísané znenie.
 * `null` = miesto nezmenil žiaden prijatý nález, alebo jeho znenie v texte už nie je.
 */
export function currentWording(base: string, f: DocumentFinding, siblings: DocumentFinding[], includeSelf = false): { text: string; via: DocumentFinding } | null {
  let best: { text: string; via: DocumentFinding } | null = null
  for (const g of siblings) {
    if ((g.id === f.id && !includeSelf) || (g.status !== "accepted" && g.status !== "fixed") || !g.acceptedText) continue
    if (g.id !== f.id && !quotesOverlap(g.quote, f.quote)) continue
    const written = g.acceptedText.trim()
    const at = base.indexOf(written)
    if (at < 0 || base.indexOf(written, at + 1) >= 0) continue
    const from = base.lastIndexOf("\n", at) + 1
    const to = base.indexOf("\n", at + written.length)
    const text = base.slice(from, to < 0 ? base.length : to).trim()
    if (!best || text.length > best.text.length) best = { text, via: g }
  }
  return best
}

/**
 * Návrh nového znenia nad aktuálnym textom miesta: keď model len doplnil
 * vetu k pôvodnému úryvku, doplnenie sa pridá za aktuálne znenie; inak
 * ostane aktuálne znenie a doplnenie z odporúčania dopíše človek.
 */
export function suggestOnCurrent(f: DocumentFinding, current: string): string {
  const q = f.quote.trim(), p = (f.proposed ?? "").trim()
  return p.startsWith(q) && p.length > q.length ? `${current}${p.slice(q.length)}` : current
}

async function writeToDraft(code: string, documentId: string, f: DocumentFinding, text: string, actor: string, siblings: DocumentFinding[], runId: string): Promise<"draft" | "manual" | null> {
  const base = await draftBase(code, documentId)
  if (base === null) throw new ComplianceError("library.documentNotFound", "Taký dokument tu nie je.")
  // Keď miesto už prepísal iný prijatý nález, nahrádza sa jeho aktuálne znenie, inak pôvodný úryvok.
  const cur = currentWording(base, f, siblings, true)
  const next = (cur ? replaceQuote(base, cur.text, text) : null) ?? replaceQuote(base, f.quote, text)
  if (next === null) return "manual"
  if (next.trim() === base.trim()) return null
  await saveDraft(code, documentId, next, `${actor} (kontrola súladu)`)
  // Reťaz odtlačkov (D200): posunie sa len z textu, ktorý táto kontrola naposledy poznala.
  await (await runs()).updateOne(
    { companyCode: code, runId, "scope.kind": "documents" },
    { $set: { "results.$[d].textHash": textFingerprint(next) } },
    { arrayFilters: [{ "d.documentId": documentId, "d.textHash": textFingerprint(base) }] },
  )
  return "draft"
}

/**
 * Správca obsahu zapíše do konceptu znenie, ktoré prijal niekto bez jeho
 * roly (Ján 11. 10. 2026: upozornenie správcom obsahu, potom jedno kliknutie).
 */
export async function applyAcceptedFinding(companyCode: string, runId: string, documentId: string, findingId: string, actor: string): Promise<FindingApplied> {
  const code = requireCompanyCode(companyCode, "applyAcceptedFinding")
  const run = await documentRun(code, runId)
  const res = run?.results?.find(r => r.documentId === documentId)
  const finding = res?.findings.find(f => f.id === findingId)
  if (!run || !res || !finding) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")
  // `manual` sa pripúšťa kvôli rozhodnutiam spred 11. 10. 2026, keď „bez práv" a „nenašlo sa" mali jednu hodnotu.
  if (!finding.acceptedText || (finding.applied !== "pending" && finding.applied !== "manual")) throw new ComplianceError("compliance.nothingToApply", "Pri tomto náleze nie je čo zapísať.")
  const applied = await writeToDraft(code, documentId, finding, finding.acceptedText, actor, res.findings, runId)
  if (applied === "manual" && finding.applied === "pending") {
    // Úryvok sa nenašiel — z „čaká na správcu" sa stáva „treba vložiť ručne".
    await (await runs()).updateOne(
      { companyCode: code, runId, "scope.kind": "documents" },
      { $set: { "results.$[d].findings.$[f].applied": "manual" } },
      { arrayFilters: [{ "d.documentId": documentId }, { "f.id": findingId }] },
    )
  }
  if (applied === "draft" || applied === null) {
    await (await runs()).updateOne(
      { companyCode: code, runId, "scope.kind": "documents" },
      { $set: { "results.$[d].findings.$[f].applied": "draft", "results.$[d].findings.$[f].appliedBy": actor, "results.$[d].findings.$[f].appliedAt": new Date() } },
      { arrayFilters: [{ "d.documentId": documentId }, { "f.id": findingId }] },
    )
    await writeAudit({ companyCode: code, subject: "document", action: "kontrola-suladu-zapisane", actor, targetId: documentId, targetLabel: res.title, note: finding.location })
  }
  return applied
}

/**
 * Všetkým správcom obsahu: prijaté znenie čaká na zápis do konceptu. Len
 * zvonček, nie e-mail — pri desiatkach nálezov by e-maily zahltili.
 */
export async function notifyContentManagers(companyCode: string, runId: string, documentId: string, documentTitle: string): Promise<void> {
  const code = requireCompanyCode(companyCode, "notifyContentManagers")
  const people = await (await getCollection<Person>(PERSONS_COLLECTION))
    .find({ companyCode: code, roles: "content-admin", status: { $ne: "inactive" } } as never, { projection: { _id: 0, id: 1 } }).toArray()
  await notifyPeople({ companyCode: code, personIds: people.map(p => p.id), kind: "complianceToApply", params: { runId, documentId, documentTitle } })
}

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
 *   s `applied: "manual"` a znenie treba vložiť v editore. Bez roly
 *   správcu obsahu sa uloží `pending` — zapíše ho správca obsahu.
 *
 * Dôvod je povinný pri oboch — o rok má byť čitateľné, prečo sa tak stalo.
 */
export async function decideFinding(
  companyCode: string, runId: string, documentId: string, findingId: string,
  decision: FindingDecision, reason: string, text: string, actor: string, canEditDrafts = true,
): Promise<{ applied: FindingApplied }> {
  const code = requireCompanyCode(companyCode, "decideFinding")
  const why = reason.trim()
  const accepted = text.replace(/\r\n?/g, "\n").trim()
  if (!why) throw new ComplianceError("compliance.reasonRequired", "Uveďte dôvod rozhodnutia.")
  if (decision === "accepted" && !accepted) throw new ComplianceError("compliance.textRequired", "Prijaté znenie nemôže byť prázdne.")
  const run = await documentRun(code, runId)
  const siblings = run?.results?.find(r => r.documentId === documentId)?.findings ?? []
  const finding = siblings.find(f => f.id === findingId)
  if (!run || !finding) throw new ComplianceError("compliance.unknownRun", "Taká kontrola tu nie je.")

  let applied: FindingApplied = null
  if (decision === "accepted") applied = canEditDrafts ? await writeToDraft(code, documentId, finding, accepted, actor, siblings, runId) : "pending"

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
