/**
 * faqHarvest.ts — úplná ťažba FAQ z histórie schránky (ADR-030, D183–D186).
 *
 * Tri etapy nad **obdobím zvoleným pri spustení** (12, 24 alebo 36 celých
 * mesiacov ako analýza, D180; Ján 9. 10. 2026: „nie z celej histórie, ale
 * z nastaveného obdobia"), všetko po kúskoch v cron behoch, každý kúsok sa
 * hneď uloží:
 *
 *   1. `collect` — mesiac po mesiaci sa zo schránky prečítajú hlavičky
 *      a text len vlákien, ktoré začal človek zvonku a ktoré dostali
 *      odpoveď (`harvestCandidates`); otázka sa očistí (`scrubPersonalData`) a v dávkach ide modelu so zoznamom
 *      doterajších tém. Model priradí tému alebo navrhne novú. **Uloží sa
 *      len kľúč témy, mesiac, časy a `threadRef`** — text nie (D184).
 *   2. `merge`   — jedno volanie nad zoznamom tém zlúči duplicitné témy.
 *      E-maily v ňom nie sú, len názvy a opisy tém.
 *   3. `draft`   — pre tému s aspoň `MIN_THREADS` vláknami sa zo schránky
 *      znova prečíta najviac 6 najnovších a 2 najstaršie vlákna; model z nich
 *      napíše 1–3 návrhy FAQ s článkom normy z knižnice kanála. Návrhy idú
 *      do fronty kurátora (`faqProposals.ts`, D185).
 *
 * Po etape `draft` sa záznamy vlákien zmažú: pôvod nesie už len návrh
 * (a ten ho stratí pri rozhodnutí kurátora, odpoveď DPO 5). V behu ostanú
 * len počty pri témach.
 *
 * Vlákno od kolegu (doména schránky), návrat od poštového servera, vlákno
 * bez odpovede a vlákno od vylúčenej adresy (námietka, D186) sa nečíta.
 */

import { createHash, randomBytes } from "node:crypto"
import Anthropic from "@anthropic-ai/sdk"
import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { requireCompanyCode } from "./tenantScope"
import { aiForCompany } from "./aiSettings"
import { recordAiUsage, usageRecord, type UsageActor } from "./aiUsage"
import { channelByKey, mailboxFor, type HelpdeskChannel } from "./channels"
import { isBounce } from "./mailbox/bounce"
import { stripQuotedHistory, type MailMessage, type MailHeader } from "./mailbox/types"
import { scrubPersonalData } from "./faqMining"
import { monthsBack, monthRange, normalizeSubject, MARGIN_DAYS, ANALYSIS_PERIODS, DEFAULT_ANALYSIS_MONTHS, MAX_FAILURES } from "./historyAnalysis"
import { saveProposals, removeOpenProposals, type NewProposal } from "./faqProposals"
import { getTenantProfile } from "./tenantProfile"
import { getProviders } from "./providers/factory"
import { hybridSearch, type ChunkResult, type SearchOptions } from "./mongoSearch"
import { searchScope, attachVersions } from "./searchVersions"
import { buildSources } from "./llmGenerator"
import type { TokenCounts } from "./pricing"

export class FaqHarvestError extends AppError {}

export const HARVESTS_COLLECTION = "faq_harvests"
export const HARVEST_THREADS_COLLECTION = "faq_harvest_threads"
export const HARVEST_EXCLUSIONS_COLLECTION = "faq_harvest_exclusions"

/** Téma s menej vláknami návrh nedostane — je to jednotlivý prípad, nie FAQ. */
export const MIN_THREADS = 3
export const CLASSIFY_BATCH = 60
/**
 * Dávky triedenia idú za sebou (9. 10. 2026): pri 3 súbežných každá dávka
 * zakladala vlastné nové témy a september dal 75 tém na 112 otázok,
 * 59 z nich s jedinou otázkou. Ďalšia dávka musí vidieť témy predošlej.
 */
export const CLASSIFY_PARALLEL = 1
export const QUESTION_CHARS = 800
export const DRAFT_NEWEST = 6
export const DRAFT_OLDEST = 2
export const DRAFT_THREAD_CHARS = 3000
/** Kľúč „nie je to otázka" (spam, poďakovanie, interná vec). */
export const NO_TOPIC = "_none"

const DAY = 86_400_000

export type HarvestStage = "collect" | "merge" | "draft" | "done"

export interface HarvestTopic {
  key: string
  label: string
  description: string
  threads: number
  /** Prvá a posledná otázka témy (mesiac YYYY-MM). */
  firstMonth: string | null
  lastMonth: string | null
  /** Koľko návrhov z témy vzniklo; null, kým sa téma nespracovala. */
  proposals: number | null
}

export interface FaqHarvest {
  companyCode: string
  channelKey: string
  /**
   * Identita behu (9. 10. 2026). Nový beh dostane nový `runId` a každý
   * zápis behu ho má v podmienke — kúsok starého behu, ktorý práve dobieha
   * v crone, tak po reštarte nič neprepíše. Pred zavedením to urobil:
   * reštart počas behu dal témy s 1 148 otázkami po jedinom mesiaci.
   */
  runId: string
  /** Zámok kúska: kým neuplynie, ďalší cron ani akcia nad behom nepracuje. */
  leaseUntil: Date | null
  stage: HarvestStage
  months: string[]
  pending: string[]
  topics: HarvestTopic[]
  /** Témy, ktoré ešte čakajú na návrh (etapa `draft`), najväčšie prvé. */
  draftPending: string[]
  counts: { threads: number; colleague: number; excluded: number; unanswered: number; noTopic: number }
  startedAt: Date
  startedBy: string
  updatedAt: Date
  finishedAt: Date | null
  error: string | null
  failures: number
}

interface HarvestThread {
  companyCode: string
  channelKey: string
  runId: string
  threadRef: string
  month: string
  topicKey: string
  askedAt: Date
  lastAnswerAt: Date
}

// ── Vlákna z mesiaca ────────────────────────────────────────────────────────

export function addressHash(address: string): string {
  return createHash("sha256").update(address.trim().toLowerCase()).digest("hex")
}

export interface HarvestItem {
  threadRef: string
  askedAt: Date
  lastAnswerAt: Date
  subject: string
  question: string
}

export interface HarvestSkips { colleague: number; excluded: number; unanswered: number }

/**
 * Súbežné čítanie vlákien zo schránky pri zbere. Graph dovolí aplikácii
 * 4 súbežné požiadavky na schránku a synchronizácia ticketov beží popri
 * tom — 6 skončilo 9. 10. 2026 chybou 429 `MailboxConcurrency`.
 */
export const THREAD_FETCH_PARALLEL = 3

/**
 * Hlavičky okna → vlákna, ktorých text treba prečítať (9. 10. 2026). Okno
 * mesiaca má v schránke SFZ okolo 17 000 správ — väčšinou automatické
 * upozornenia ISSF odoslané z adresy helpdesku; čítať ich všetky s telom sa
 * nestihne ani za 260 s. Text sa preto číta len pre vlákna, ktoré začal
 * človek zvonku v danom mesiaci a ktoré dostali odpoveď.
 */
export function harvestCandidates(headers: MailHeader[], key: string, mailboxAddress: string, excluded: Set<string>): { refs: string[]; skips: HarvestSkips } {
  const { start, end } = monthRange(key)
  const ownDomain = mailboxAddress.toLowerCase().split("@")[1] ?? ""
  const byThread = new Map<string, MailHeader[]>()
  for (const h of headers) {
    if (h.folder !== "other") continue
    if (isBounce({ from: h.fromAddress ? { address: h.fromAddress, name: null } : null, subject: h.subject, outgoing: h.outgoing })) continue
    byThread.set(h.threadRef, [...(byThread.get(h.threadRef) ?? []), h])
  }
  const refs: string[] = []
  const skips: HarvestSkips = { colleague: 0, excluded: 0, unanswered: 0 }
  for (const [ref, list] of byThread) {
    const ordered = list.slice().sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    const first = ordered[0]
    if (first.outgoing || first.receivedAt < start || first.receivedAt >= end) continue
    const from = first.fromAddress ?? ""
    if (ownDomain && from.endsWith(`@${ownDomain}`)) { skips.colleague += 1; continue }
    if (from && excluded.has(addressHash(from))) { skips.excluded += 1; continue }
    if (!ordered.some(h => h.outgoing && h.receivedAt > first.receivedAt)) { skips.unanswered += 1; continue }
    refs.push(ref)
  }
  return { refs, skips }
}

/**
 * Správy okna (mesiac + presah) → vlákna mesiaca na triedenie. Vlákno patrí
 * mesiacu, v ktorom prišla jeho prvá správa; začať ho musí človek zvonku.
 */
export function harvestItems(messages: MailMessage[], key: string, mailboxAddress: string, excluded: Set<string>): { items: HarvestItem[]; skips: HarvestSkips } {
  const { start, end } = monthRange(key)
  const ownDomain = mailboxAddress.toLowerCase().split("@")[1] ?? ""
  const byThread = new Map<string, MailMessage[]>()
  for (const m of messages) {
    if (isBounce(m)) continue
    byThread.set(m.threadRef, [...(byThread.get(m.threadRef) ?? []), m])
  }
  const items: HarvestItem[] = []
  const skips: HarvestSkips = { colleague: 0, excluded: 0, unanswered: 0 }
  for (const [threadRef, list] of byThread) {
    const ordered = list.slice().sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    const first = ordered[0]
    if (first.outgoing || first.receivedAt < start || first.receivedAt >= end) continue
    const from = first.from?.address ?? ""
    if (ownDomain && from.endsWith(`@${ownDomain}`)) { skips.colleague += 1; continue }
    if (from && excluded.has(addressHash(from))) { skips.excluded += 1; continue }
    const answers = ordered.filter(m => m.outgoing && m.receivedAt > first.receivedAt)
    if (!answers.length) { skips.unanswered += 1; continue }
    const question = scrubPersonalData(stripQuotedHistory(first.text)).replace(/\s+/g, " ").trim().slice(0, QUESTION_CHARS)
    items.push({
      threadRef, askedAt: first.receivedAt, lastAnswerAt: answers[answers.length - 1].receivedAt,
      subject: normalizeSubject(first.subject), question,
    })
  }
  return { items, skips }
}

// ── Triedenie do tém ────────────────────────────────────────────────────────

export const CLASSIFY_SYSTEM = [
  "Triediš otázky, ktoré ľudia poslali do e-mailovej schránky helpdesku športového zväzu (najčastejšie k systému ISSF).",
  "Každej otázke priraď tému. Téma je **široký typ problému s jedným postupom odpovede**, na ktorý stačí jeden až tri záznamy FAQ — napríklad „Obnova hesla a prihlásenie do ISSF“, „Predĺženie platnosti registračného preukazu“, „Prestup hráča“, „Úhrada členského poplatku“. Nie konkrétny prípad, jeho okolnosti ani to, kto sa pýta.",
  "Pravidlá:",
  "– Najprv hľadaj medzi existujúcimi témami (sú zoradené od najčastejšej). Použi existujúcu tému aj vtedy, keď sedí len približne.",
  "– Novú tému navrhni, len keď by odpoveď na otázku bola naozaj iná ako pri všetkých existujúcich témach.",
  "– Názov a opis novej témy sú všeobecné: nikdy v nich neuvádzaj mená, kluby, čísla ani iné údaje konkrétnej osoby.",
  "– Správa, ktorá nie je otázka ani žiadosť (spam, poďakovanie, reklama, automatická správa), dostane kľúč „_none“.",
  "– Píš po slovensky. V textoch používaj úvodzovky „…“, nikdy znak \".",
  "Vráť JSON podľa schémy.",
].join("\n")

export const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: "integer", description: "Číslo otázky." },
          topic: { type: "string", description: "Kľúč existujúcej témy, „_none“, alebo „new“ pri novej téme." },
          newLabel: { type: "string", description: "Pri „new“: názov novej témy, inak prázdne." },
          newDescription: { type: "string", description: "Pri „new“: jedna veta, čo do témy patrí, inak prázdne." },
        },
        required: ["item", "topic", "newLabel", "newDescription"],
      },
    },
  },
  required: ["assignments"],
} as const

export function classifyPrompt(topics: (Pick<HarvestTopic, "key" | "label" | "description"> & { threads?: number })[], items: HarvestItem[]): string {
  const sorted = topics.slice().sort((a, b) => (b.threads ?? 0) - (a.threads ?? 0))
  const known = sorted.length
    ? `Existujúce témy (kľúč — názov: opis; v zátvorke počet doterajších otázok):\n${sorted.map(t => `${t.key} — ${t.label}: ${t.description}${t.threads ? ` (${t.threads})` : ""}`).join("\n")}`
    : "Existujúce témy: zatiaľ žiadne."
  const list = items.map((it, i) => `### Otázka ${i + 1}\nPredmet: ${it.subject || "—"}\n${it.question || "—"}`).join("\n\n")
  return `${known}\n\n${list}`
}

/**
 * Odpoveď modelu → téma ku každej otázke. Nové témy s rovnakým názvom
 * v jednej dávke sú jedna téma; neznámy kľúč aj chýbajúca odpoveď padajú
 * na „_none“, aby otázka nezostala bez témy.
 */
export function applyClassification(
  raw: unknown,
  items: HarvestItem[],
  topics: Pick<HarvestTopic, "key" | "label" | "description">[],
  newKey: () => string,
): { topicOf: Map<string, string>; created: { key: string; label: string; description: string }[] } {
  const known = new Set(topics.map(t => t.key))
  const byLabel = new Map(topics.map(t => [t.label.toLowerCase(), t.key]))
  const created: { key: string; label: string; description: string }[] = []
  const topicOf = new Map<string, string>()
  const list = (raw as { assignments?: unknown })?.assignments
  for (const a of Array.isArray(list) ? list : []) {
    const x = a as { item?: unknown; topic?: unknown; newLabel?: unknown; newDescription?: unknown }
    const i = Number(x.item) - 1
    if (!Number.isInteger(i) || i < 0 || i >= items.length) continue
    const topic = String(x.topic ?? "")
    let key = NO_TOPIC
    if (known.has(topic)) key = topic
    else if (topic === "new") {
      const label = String(x.newLabel ?? "").replace(/\s+/g, " ").trim().slice(0, 120)
      if (label) {
        const existing = byLabel.get(label.toLowerCase())
        if (existing) key = existing
        else {
          key = newKey()
          created.push({ key, label, description: String(x.newDescription ?? "").replace(/\s+/g, " ").trim().slice(0, 300) })
          byLabel.set(label.toLowerCase(), key)
          known.add(key)
        }
      }
    }
    topicOf.set(items[i].threadRef, key)
  }
  for (const it of items) if (!topicOf.has(it.threadRef)) topicOf.set(it.threadRef, NO_TOPIC)
  return { topicOf, created }
}

// ── Zlúčenie tém ────────────────────────────────────────────────────────────

export const MERGE_SYSTEM = [
  "Dostaneš zoznam tém otázok helpdesku športového zväzu s počtom otázok.",
  "Zlúč témy, ktoré znamenajú ten istý problém (rovnaký postup odpovede), do jednej. Témy, ktoré sú len podobné, ale riešia sa inak, nechaj oddelené.",
  "Vráť **len skupiny, ktoré zlučujú aspoň dve témy**: kľúče pôvodných tém, nový názov a jednu vetu opisu. Témy, ktoré nezlučuješ, neuvádzaj — ostanú, ako sú. Každý kľúč patrí najviac do jednej skupiny.",
  "Píš po slovensky, bez údajov konkrétnych osôb. V textoch používaj úvodzovky „…“, nikdy znak \".",
  "Vráť JSON podľa schémy.",
].join("\n")

export const MERGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          keys: { type: "array", items: { type: "string" } },
          label: { type: "string" },
          description: { type: "string" },
        },
        required: ["keys", "label", "description"],
      },
    },
  },
  required: ["topics"],
} as const

/**
 * Odpoveď modelu → mapa pôvodný kľúč → výsledný. Výsledná téma dostane kľúč
 * svojej najväčšej pôvodnej témy. Kľúč, ktorý model vynechal, ostane sám
 * za seba; kľúč uvedený dvakrát patrí prvej skupine.
 */
export function applyMerge(raw: unknown, topics: HarvestTopic[]): { mapping: Map<string, string>; merged: HarvestTopic[] } {
  const byKey = new Map(topics.map(t => [t.key, t]))
  const mapping = new Map<string, string>()
  const merged: HarvestTopic[] = []
  const groups = (raw as { topics?: unknown })?.topics
  for (const g of Array.isArray(groups) ? groups : []) {
    const x = g as { keys?: unknown; label?: unknown; description?: unknown }
    const keys = (Array.isArray(x.keys) ? x.keys : []).map(String).filter(k => byKey.has(k) && !mapping.has(k))
    if (!keys.length) continue
    const members = keys.map(k => byKey.get(k)!)
    const lead = members.slice().sort((a, b) => b.threads - a.threads)[0]
    for (const k of keys) mapping.set(k, lead.key)
    merged.push({
      ...lead,
      label: String(x.label ?? lead.label).replace(/\s+/g, " ").trim().slice(0, 120) || lead.label,
      description: String(x.description ?? lead.description).replace(/\s+/g, " ").trim().slice(0, 300),
      threads: members.reduce((n, t) => n + t.threads, 0),
    })
  }
  for (const t of topics) {
    if (mapping.has(t.key)) continue
    mapping.set(t.key, t.key)
    merged.push(t)
  }
  return { mapping, merged: merged.sort((a, b) => b.threads - a.threads) }
}

// ── Návrh za tému ───────────────────────────────────────────────────────────

/** Najnovšie a najstaršie vlákna témy — z rozdielu medzi nimi je vidieť, či sa odpoveď menila. */
export function pickThreads<T extends { askedAt: Date }>(threads: T[], newest = DRAFT_NEWEST, oldest = DRAFT_OLDEST): T[] {
  const sorted = threads.slice().sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime())
  const pick = sorted.slice(0, newest)
  for (const t of sorted.slice(newest).reverse().slice(0, oldest)) pick.push(t)
  return pick
}

export const DRAFT_SYSTEM = [
  "Si redaktor FAQ športového zväzu. Dostaneš tému, niekoľko e-mailových vlákien helpdesku k nej (otázka člena a odpoveď helpdesku s dátumom) a úseky noriem z knižnice zväzu.",
  "Napíš jeden až tri záznamy FAQ, ktoré pokryjú tému. Viac ako jeden len vtedy, keď ide naozaj o rôzne otázky s rôznou odpoveďou.",
  "Pravidlá:",
  "– Nikdy neuvádzaj mená, adresy, čísla, kluby ani iné údaje konkrétnej osoby. Píš všeobecne („hráč“, „klub“, „rodič“).",
  "– Odpoveď vychádza z odpovedí helpdesku, a to z **najnovšej**. Nič nedomýšľaj. Úseky noriem použi na doplnenie a uveď ich čísla v „sources“; keď sa norma s odpoveďou helpdesku rozchádza, nastav „normConflict“ a v „note“ to vysvetli.",
  "– Keď sa odpovede helpdesku v čase líšia (starší postup, iný poplatok, iná obrazovka), nastav „changedOverTime“ a v „note“ stručne povedz, čo sa zmenilo a odkedy.",
  "– Ak z vlákien nevyplýva použiteľná všeobecná odpoveď, vráť prázdny zoznam.",
  "– Píš v jazyku vlákien. V textoch používaj úvodzovky „…“, nikdy znak \".",
  "Vráť JSON podľa schémy.",
].join("\n")

export const DRAFT_SCHEMA = {
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
          variants: { type: "array", items: { type: "string" }, description: "Iné znenia tej istej otázky." },
          answer: { type: "string", description: "Úplná odpoveď bez osobných údajov." },
          audience: { type: "array", items: { type: "string" }, description: "Komu je určená: klubový manažér, rozhodca, tréner, hráč, rodič…" },
          sources: { type: "array", items: { type: "integer" }, description: "Čísla použitých úsekov noriem." },
          changedOverTime: { type: "boolean" },
          normConflict: { type: "boolean" },
          note: { type: "string", description: "Pre kurátora: čo sa zmenilo alebo v čom sa norma rozchádza; inak prázdne." },
        },
        required: ["question", "variants", "answer", "audience", "sources", "changedOverTime", "normConflict", "note"],
      },
    },
  },
  required: ["entries"],
} as const

export interface DraftThread {
  askedAt: Date
  question: string
  answers: { at: Date; text: string }[]
}

const ym = (d: Date) => d.toISOString().slice(0, 10)

export function draftPrompt(topic: Pick<HarvestTopic, "label" | "description" | "threads">, threads: DraftThread[], chunks: { title: string; articleRef: string | null; text: string }[]): string {
  const cut = (s: string) => (s.length > DRAFT_THREAD_CHARS ? `${s.slice(0, DRAFT_THREAD_CHARS)} …` : s)
  const parts = [`Téma: ${topic.label}\nOpis: ${topic.description}\nPočet otázok v histórii: ${topic.threads}`]
  threads.forEach((t, i) => {
    const lines = [`### Vlákno ${i + 1} (otázka ${ym(t.askedAt)})`, "Otázka:", cut(t.question)]
    t.answers.forEach(a => lines.push("", `Odpoveď helpdesku (${ym(a.at)}):`, cut(a.text)))
    parts.push(lines.join("\n"))
  })
  parts.push(chunks.length
    ? `## Úseky noriem\n${chunks.map((c, i) => `[${i + 1}] ${c.title}${c.articleRef ? `, ${c.articleRef}` : ""}\n${c.text.slice(0, 1500)}`).join("\n\n")}`
    : "## Úseky noriem\nŽiadne sa nenašli.")
  return parts.join("\n\n")
}

/** Vlákno zo schránky → očistený prepis s dátumami; bez otázky alebo odpovede nič. */
export function draftThread(messages: MailMessage[]): DraftThread | null {
  const ordered = messages.slice().sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
  const first = ordered.find(m => !m.outgoing && !isBounce(m))
  if (!first) return null
  const answers = ordered
    .filter(m => m.outgoing && m.receivedAt > first.receivedAt)
    .map(m => ({ at: m.receivedAt, text: scrubPersonalData(stripQuotedHistory(m.text)).trim() }))
    .filter(a => a.text)
  const question = scrubPersonalData(stripQuotedHistory(first.text)).trim()
  if (!question || !answers.length) return null
  return { askedAt: first.receivedAt, question, answers }
}

export interface DraftEntry {
  question: string
  variants: string[]
  answer: string
  audience: string[]
  sourceIndexes: number[]
  changedOverTime: boolean
  normConflict: boolean
  note: string
}

export function parseDraft(raw: unknown, chunkCount: number): DraftEntry[] {
  const list = (raw as { entries?: unknown })?.entries
  const out: DraftEntry[] = []
  const strs = (xs: unknown, max: number) => (Array.isArray(xs) ? xs : []).map(x => String(x ?? "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, max)
  for (const e of Array.isArray(list) ? list.slice(0, 3) : []) {
    const x = e as Record<string, unknown>
    const question = String(x.question ?? "").replace(/\s+/g, " ").trim()
    const answer = String(x.answer ?? "").trim()
    if (!question || !answer) continue
    out.push({
      question: question.slice(0, 300),
      variants: strs(x.variants, 10),
      answer: answer.slice(0, 4000),
      audience: strs(x.audience, 6),
      sourceIndexes: (Array.isArray(x.sources) ? x.sources : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= chunkCount),
      changedOverTime: x.changedOverTime === true,
      normConflict: x.normConflict === true,
      note: String(x.note ?? "").trim().slice(0, 1000),
    })
  }
  return out
}

// ── Volanie modelu ──────────────────────────────────────────────────────────

/**
 * Volanie so štruktúrovaným výstupom. `effort` len pre model odpovedí —
 * Sonnet 5 premýšľa predvolene a bez stropu úsilia by premýšľanie zjedlo
 * `max_tokens`; Haiku 4.5 (triedenie) `effort` nepozná a vrátil by 400.
 */
async function callJson(
  client: Anthropic, model: string, system: string, prompt: string, schema: object, maxTokens: number,
  usage: (tokens: Partial<TokenCounts>, failed?: boolean) => void,
  effort?: "low" | "medium" | "high",
): Promise<unknown> {
  let answer: Anthropic.Message
  try {
    answer = await client.messages.create({
      model, max_tokens: maxTokens, system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: schema as Record<string, unknown> }, ...(effort ? { effort } : {}) },
    })
  } catch (e) {
    usage({}, true)
    console.error("[faq-harvest] volanie modelu zlyhalo:", e)
    throw new FaqHarvestError("helpdesk.miningFailed", "Ťažba FAQ sa nepodarila — skúste to o chvíľu.")
  }
  usage({
    input: answer.usage.input_tokens, output: answer.usage.output_tokens,
    cacheWrite: answer.usage.cache_creation_input_tokens ?? 0, cacheRead: answer.usage.cache_read_input_tokens ?? 0,
  })
  const block = answer.content.find(b => b.type === "text")
  try { return JSON.parse(block && block.type === "text" ? block.text : "") } catch { return null }
}

// ── Úložisko ────────────────────────────────────────────────────────────────

async function harvests() { return getCollection<FaqHarvest>(HARVESTS_COLLECTION) }
async function threadsCol() { return getCollection<HarvestThread>(HARVEST_THREADS_COLLECTION) }
async function exclusionsCol() { return getCollection<{ companyCode: string; channelKey: string; hash: string; addedAt: Date; addedBy: string }>(HARVEST_EXCLUSIONS_COLLECTION) }

export async function harvestFor(companyCode: string, channelKey: string): Promise<FaqHarvest | null> {
  const code = requireCompanyCode(companyCode, "harvestFor")
  return (await harvests()).findOne({ companyCode: code, channelKey }, { projection: { _id: 0 } })
}

export async function exclusionCount(companyCode: string, channelKey: string): Promise<number> {
  const code = requireCompanyCode(companyCode, "exclusionCount")
  return (await exclusionsCol()).countDocuments({ companyCode: code, channelKey })
}

/** Námietka (D186): adresy → odtlačky. Vracia počet nových. */
export async function addExclusions(companyCode: string, channelKey: string, addresses: string[], actorEmail: string): Promise<number> {
  const code = requireCompanyCode(companyCode, "addExclusions")
  const col = await exclusionsCol()
  let added = 0
  for (const a of addresses) {
    const address = a.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) continue
    const r = await col.updateOne(
      { companyCode: code, channelKey, hash: addressHash(address) },
      { $setOnInsert: { companyCode: code, channelKey, hash: addressHash(address), addedAt: new Date(), addedBy: actorEmail } },
      { upsert: true },
    )
    if (r.upsertedCount) added += 1
  }
  return added
}

async function excludedHashes(code: string, channelKey: string): Promise<Set<string>> {
  const rows = await (await exclusionsCol()).find({ companyCode: code, channelKey }, { projection: { hash: 1 } }).toArray()
  return new Set(rows.map(r => r.hash))
}

/**
 * Nový beh nad posledných `months` celých mesiacov (12, 24 alebo 36). Zahodí
 * záznamy vlákien predchádzajúceho behu a **nerozhodnuté** návrhy kanála —
 * rozhodnuté sú už vo FAQ alebo zamietnuté a ostávajú.
 */
export async function startHarvest(companyCode: string, channelKey: string, months: number, actorEmail: string, now = new Date()): Promise<void> {
  const code = requireCompanyCode(companyCode, "startHarvest")
  const channel = await channelByKey(code, channelKey)
  if (!channel) throw new FaqHarvestError("helpdesk.notFound", "Taký kanál tu nie je.")
  if (!channel.mailbox) throw new FaqHarvestError("helpdesk.noMailbox", "Kanál nemá schránku.")
  const ai = await aiForCompany(code)
  if (!ai.apiKey) throw new FaqHarvestError("chunking.aiNoKey", "Umelá inteligencia nemá nastavený kľúč.")
  const period = (ANALYSIS_PERIODS as readonly number[]).includes(months) ? months : DEFAULT_ANALYSIS_MONTHS
  const plan = monthsBack(now, period)
  await (await threadsCol()).deleteMany({ companyCode: code, channelKey })
  await removeOpenProposals(code, channelKey)
  await (await harvests()).replaceOne(
    { companyCode: code, channelKey },
    {
      companyCode: code, channelKey, runId: randomBytes(8).toString("hex"), leaseUntil: null,
      stage: "collect", months: plan, pending: plan, topics: [], draftPending: [],
      counts: { threads: 0, colleague: 0, excluded: 0, unanswered: 0, noTopic: 0 },
      startedAt: now, startedBy: actorEmail, updatedAt: now, finishedAt: null, error: null, failures: 0,
    },
    { upsert: true },
  )
}

export interface HarvestBudget { budgetMs: number; hardMs: number }

interface RunCtx {
  code: string
  runId: string
  channel: HelpdeskChannel
  client: Anthropic
  utilityModel: string
  answerModel: string
  keySource: Awaited<ReturnType<typeof aiForCompany>>["keySource"]
  actor: UsageActor
  hardStop: number
}

/** Podmienka zápisov behu: organizácia, kanál a **tento** beh. */
function runFilter(ctx: RunCtx) {
  return { companyCode: ctx.code, channelKey: ctx.channel.key, runId: ctx.runId }
}

function usageFor(ctx: RunCtx, model: string, subject: string) {
  return (tokens: Partial<TokenCounts>, failed?: boolean) => void recordAiUsage(usageRecord({
    actor: ctx.actor, purpose: "faq-mining", subject: `${ctx.channel.name} → ${subject}`.slice(0, 200),
    provider: "anthropic", model, keySource: ctx.keySource, tokens, failed,
  }))
}

/** Jeden mesiac etapy `collect`. */
async function collectMonth(ctx: RunCtx, doc: FaqHarvest, key: string): Promise<void> {
  const adapter = mailboxFor(ctx.channel)
  const { start, end } = monthRange(key)
  const excluded = await excludedHashes(ctx.code, ctx.channel.key)
  const headers = await adapter.listHeaders(new Date(start.getTime() - MARGIN_DAYS * DAY), new Date(end.getTime() + MARGIN_DAYS * DAY), ctx.hardStop)
  const { refs, skips } = harvestCandidates(headers, key, adapter.address, excluded)
  const messages: MailMessage[] = []
  for (let i = 0; i < refs.length; i += THREAD_FETCH_PARALLEL) {
    if (Date.now() > ctx.hardStop) throw new FaqHarvestError("mailbox.slow", "Schránka odpovedá pomaly — mesiac sa nestihol prečítať.", { read: i })
    for (const list of await Promise.all(refs.slice(i, i + THREAD_FETCH_PARALLEL).map(r => adapter.listThread(r)))) messages.push(...list)
  }
  // Výber a čistenie robí `harvestItems` nad textom; počty vynechaných sú z hlavičiek.
  const { items } = harvestItems(messages, key, adapter.address, excluded)

  const topics = doc.topics.map(t => ({ key: t.key, label: t.label, description: t.description, threads: t.threads }))
  let seq = doc.topics.length
  const newKey = () => `t${String(++seq).padStart(4, "0")}`
  const topicOf = new Map<string, string>()
  const created: { key: string; label: string; description: string; threads?: number }[] = []
  const batches: HarvestItem[][] = []
  for (let i = 0; i < items.length; i += CLASSIFY_BATCH) batches.push(items.slice(i, i + CLASSIFY_BATCH))
  for (let i = 0; i < batches.length; i += CLASSIFY_PARALLEL) {
    // Počty v tomto mesiaci sa pripočítajú, aby model videl, ktoré témy sú časté.
    const known = [...topics, ...created].map(t => ({ ...t, threads: (t.threads ?? 0) + [...topicOf.values()].filter(k => k === t.key).length }))
    const results = await Promise.all(batches.slice(i, i + CLASSIFY_PARALLEL).map(b =>
      callJson(ctx.client, ctx.utilityModel, CLASSIFY_SYSTEM, classifyPrompt(known, b), CLASSIFY_SCHEMA, 6000, usageFor(ctx, ctx.utilityModel, `témy ${key}`))
        .then(raw => ({ b, raw }))))
    for (const { b, raw } of results) {
      const r = applyClassification(raw, b, [...known, ...created], newKey)
      for (const [ref, k] of r.topicOf) topicOf.set(ref, k)
      created.push(...r.created)
    }
  }

  const col = await threadsCol()
  for (const it of items) {
    await col.updateOne(
      { ...runFilter(ctx), threadRef: it.threadRef },
      { $set: { ...runFilter(ctx), threadRef: it.threadRef, month: key, topicKey: topicOf.get(it.threadRef) ?? NO_TOPIC, askedAt: it.askedAt, lastAnswerAt: it.lastAnswerAt } },
      { upsert: true },
    )
  }
  const counts = new Map<string, number>()
  let noTopic = 0
  for (const k of topicOf.values()) { if (k === NO_TOPIC) noTopic += 1; else counts.set(k, (counts.get(k) ?? 0) + 1) }
  const nextTopics: HarvestTopic[] = [
    ...doc.topics.map(t => ({
      ...t, threads: t.threads + (counts.get(t.key) ?? 0),
      firstMonth: counts.get(t.key) ? (t.firstMonth && t.firstMonth < key ? t.firstMonth : key) : t.firstMonth,
      lastMonth: counts.get(t.key) ? (t.lastMonth && t.lastMonth > key ? t.lastMonth : key) : t.lastMonth,
    })),
    ...created.map(c => ({ ...c, threads: counts.get(c.key) ?? 0, firstMonth: key, lastMonth: key, proposals: null })),
  ]
  await (await harvests()).updateOne(
    runFilter(ctx),
    {
      $set: { topics: nextTopics, updatedAt: new Date(), error: null, failures: 0 },
      $inc: { "counts.threads": items.length - noTopic, "counts.noTopic": noTopic, "counts.colleague": skips.colleague, "counts.excluded": skips.excluded, "counts.unanswered": skips.unanswered },
      $pull: { pending: key },
    },
  )
  doc.topics = nextTopics
  doc.pending = doc.pending.filter(k => k !== key)
  console.info(`[faq-harvest] ${ctx.code}/${ctx.channel.key} ${key}: ${headers.length} hlavičiek, ${refs.length} vlákien na čítanie, ${items.length} do tém, ${created.length} nových tém`)
}

/** Toľko tém ide modelu v jednom volaní zlučovania; k nim kotvy (najväčšie témy). */
export const MERGE_CHUNK = 300
export const MERGE_ANCHORS = 60

/**
 * Kúsky zlučovania: témy od najväčšej, po `MERGE_CHUNK`; každý ďalší kúsok
 * dostane aj `MERGE_ANCHORS` najväčších tém, aby sa k nim mohli pripojiť aj
 * malé témy z konca zoznamu.
 */
export function mergeChunks(topics: HarvestTopic[]): HarvestTopic[][] {
  const sorted = topics.slice().sort((a, b) => b.threads - a.threads)
  const anchors = sorted.slice(0, MERGE_ANCHORS)
  const out: HarvestTopic[][] = []
  for (let i = 0; i < sorted.length; i += MERGE_CHUNK) {
    const chunk = sorted.slice(i, i + MERGE_CHUNK)
    out.push(i === 0 ? chunk : [...anchors, ...chunk])
  }
  return out
}

/** Etapa `merge`: zlúčenie duplicitných tém po kúskoch, prečíslovanie vlákien. */
async function mergeTopics(ctx: RunCtx, doc: FaqHarvest): Promise<void> {
  let merged = doc.topics.filter(t => t.threads > 0)
  const col = await threadsCol()
  if (merged.length > 1) {
    for (const chunk of mergeChunks(merged)) {
      // Kotvy mohli byť zlúčené v predošlom kúsku — berie sa ich aktuálny stav.
      const live = new Map(merged.map(t => [t.key, t]))
      const part = [...new Map(chunk.filter(t => live.has(t.key)).map(t => [t.key, live.get(t.key)!])).values()]
      if (part.length < 2) continue
      const prompt = part.map(t => `${t.key} (${t.threads}) — ${t.label}: ${t.description}`).join("\n")
      const raw = await callJson(ctx.client, ctx.answerModel, MERGE_SYSTEM, prompt, MERGE_SCHEMA, 16000, usageFor(ctx, ctx.answerModel, "zlúčenie tém"), "medium")
      const r = applyMerge(raw, part)
      for (const [from, to] of r.mapping) {
        if (from !== to) await col.updateMany({ ...runFilter(ctx), topicKey: from }, { $set: { topicKey: to } })
      }
      const partKeys = new Set(part.map(t => t.key))
      merged = [...merged.filter(t => !partKeys.has(t.key)), ...r.merged]
    }
    // Prvý a posledný mesiac a počet zlúčenej témy z vlákien, nie z pôvodných tém.
    const spans = await col.aggregate<{ _id: string; first: string; last: string; n: number }>([
      { $match: runFilter(ctx) },
      { $group: { _id: "$topicKey", first: { $min: "$month" }, last: { $max: "$month" }, n: { $sum: 1 } } },
    ]).toArray()
    const span = new Map(spans.map(s => [s._id, s]))
    merged = merged
      .map(t => ({ ...t, threads: span.get(t.key)?.n ?? t.threads, firstMonth: span.get(t.key)?.first ?? t.firstMonth, lastMonth: span.get(t.key)?.last ?? t.lastMonth }))
      .sort((a, b) => b.threads - a.threads)
  }
  const draftPending = merged.filter(t => t.threads >= MIN_THREADS).map(t => t.key)
  await (await harvests()).updateOne(
    runFilter(ctx),
    { $set: { topics: merged, draftPending, stage: draftPending.length ? "draft" : "done", updatedAt: new Date(), error: null, failures: 0, ...(draftPending.length ? {} : { finishedAt: new Date() }) } },
  )
  doc.topics = merged
  doc.draftPending = draftPending
  doc.stage = draftPending.length ? "draft" : "done"
}

/** Úseky noriem z knižnice kanála k téme — rovnako ako návrh odpovede ticketu, len verejné. */
async function topicChunks(code: string, channel: HelpdeskChannel, query: string): Promise<{ documentId: string; title: string; articleRef: string | null; text: string }[]> {
  const now = new Date()
  const profile = await getTenantProfile(code)
  const providers = getProviders(profile)
  const scope = await searchScope(code, now, now, { folderIds: channel.folderIds })
  if (!scope.versionIds.length && !scope.verifiedAnswers) return []
  const opts: SearchOptions = {
    query: query.slice(0, 2000), accessLevel: "public", companyCode: code, limit: 20, rerankLimit: 5,
    useStageRerank: providers.rerank.isPipelineStage, rerankModel: profile.providers.rerank.model,
    vectorPath: profile.providers.embedding.vectorPath, versionIds: scope.versionIds, verifiedAnswers: scope.verifiedAnswers,
  }
  let chunks: ChunkResult[] = await hybridSearch(await getCollection("document_chunks"), opts)
  if (chunks.length && !providers.rerank.isPipelineStage) {
    try { chunks = await providers.rerank.rerank(query, chunks, 5) } catch { chunks = chunks.slice(0, 5) }
  }
  chunks = attachVersions(chunks.slice(0, 5), scope.versions)
  const meta = buildSources(chunks)
  return chunks.map((c, i) => ({ documentId: c.documentId, title: meta[i]?.title ?? c.documentId, articleRef: c.articleRef ?? null, text: c.text }))
}

/** Jedna téma etapy `draft`. */
async function draftTopic(ctx: RunCtx, doc: FaqHarvest, key: string): Promise<void> {
  const topic = doc.topics.find(t => t.key === key)
  const col = await threadsCol()
  let made = 0
  if (topic) {
    const all = await col.find({ ...runFilter(ctx), topicKey: key }, { projection: { _id: 0, threadRef: 1, askedAt: 1 } }).toArray()
    const adapter = mailboxFor(ctx.channel)
    const threads: DraftThread[] = []
    for (const t of pickThreads(all)) {
      if (Date.now() > ctx.hardStop) throw new FaqHarvestError("mailbox.slow", "Schránka odpovedá pomaly — téma sa nestihla spracovať.")
      const t2 = draftThread(await adapter.listThread(t.threadRef))
      if (t2) threads.push(t2)
    }
    if (threads.length) {
      const chunks = await topicChunks(ctx.code, ctx.channel, `${topic.label}. ${topic.description}\n${threads[0].question.slice(0, 600)}`)
      const raw = await callJson(ctx.client, ctx.answerModel, DRAFT_SYSTEM, draftPrompt(topic, threads, chunks), DRAFT_SCHEMA, 16000, usageFor(ctx, ctx.answerModel, topic.label), "medium")
      const entries = parseDraft(raw, chunks.length)
      const proposals: NewProposal[] = entries.map(e => ({
        topicKey: key, topicLabel: topic.label,
        question: e.question, variants: e.variants, answer: e.answer, audience: e.audience,
        sources: [...new Map(e.sourceIndexes.map(i => chunks[i - 1]).map(c => [`${c.documentId}|${c.articleRef ?? ""}`, { documentId: c.documentId, title: c.title, articleRef: c.articleRef }])).values()],
        threads: topic.threads, firstMonth: topic.firstMonth, lastMonth: topic.lastMonth,
        flags: { changedOverTime: e.changedOverTime, normConflict: e.normConflict }, note: e.note,
        origin: { threadRefs: all.map(t => t.threadRef) }, model: ctx.answerModel,
      }))
      // Beh mohol byť medzitým nahradený novým — jeho návrhy by boli duplicitné.
      if (!(await (await harvests()).findOne(runFilter(ctx), { projection: { _id: 1 } }))) {
        throw new FaqHarvestError("harvest.superseded", "Ťažbu medzitým niekto spustil znova.")
      }
      made = await saveProposals(ctx.code, ctx.channel.key, proposals)
    }
  }
  const last = doc.draftPending.length === 1
  const topics = doc.topics.map(t => (t.key === key ? { ...t, proposals: made } : t))
  await (await harvests()).updateOne(
    runFilter(ctx),
    { $set: { topics, updatedAt: new Date(), error: null, failures: 0, ...(last ? { stage: "done", finishedAt: new Date() } : {}) }, $pull: { draftPending: key } },
  )
  if (last) {
    // Pôvod nesú už návrhy; záznamy vlákien nie sú potrebné (minimalizácia).
    // Len tohto behu — dobiehajúci starý beh nesmie zmazať vlákna nového.
    // Pár vlákien, ktoré starý beh zapíše po reštarte, zmaže ďalší štart.
    await col.deleteMany(runFilter(ctx))
  }
  doc.topics = topics
  doc.draftPending = doc.draftPending.filter(k => k !== key)
  if (last) doc.stage = "done"
}

/**
 * Ďalší kúsok behu v rámci `budget`. Pokus sa započíta pred prácou (ako pri
 * analýze, 8. 10. 2026) — beh zrušený časovým limitom sa tak neopakuje
 * donekonečna. Vracia počet spracovaných kúskov (mesiacov, tém).
 */
export async function continueHarvest(companyCode: string, channelKey: string, budget: HarvestBudget, actor?: UsageActor): Promise<number> {
  const code = requireCompanyCode(companyCode, "continueHarvest")
  const col = await harvests()
  const now = new Date()
  // Zámok kúska: cron každých 5 minút môže dobehnúť predošlý (až 300 s)
  // a akcia „Spustiť" ide popri crone. Kúsok berie len ten, kto zámok získa.
  const doc = await col.findOneAndUpdate(
    {
      companyCode: code, channelKey, stage: { $ne: "done" }, failures: { $lt: MAX_FAILURES },
      $or: [{ leaseUntil: null }, { leaseUntil: { $exists: false } }, { leaseUntil: { $lt: now } }],
    },
    { $set: { leaseUntil: new Date(now.getTime() + budget.hardMs + 60_000) } },
    { returnDocument: "after" },
  )
  if (!doc) return 0
  const channel = await channelByKey(code, channelKey)
  const ai = await aiForCompany(code)
  if (!channel?.mailbox || !ai.apiKey) {
    await col.updateOne({ companyCode: code, channelKey, runId: doc.runId }, { $set: { leaseUntil: null } })
    return 0
  }
  const began = Date.now()
  const ctx: RunCtx = {
    code, runId: doc.runId, channel,
    client: new Anthropic({ apiKey: ai.apiKey, maxRetries: 1, timeout: 180_000 }),
    utilityModel: ai.models.utility, answerModel: ai.models.answer, keySource: ai.keySource,
    actor: actor ?? { companyCode: code, personId: null, personName: "Ťažba FAQ (cron)", email: doc.startedBy },
    hardStop: began + budget.hardMs,
  }
  const mine = runFilter(ctx)
  let done = 0
  try {
    while ((doc.stage as HarvestStage) !== "done") {
      if (done > 0 && Date.now() > began + budget.budgetMs) break
      const r = await col.updateOne(mine, { $inc: { failures: 1 }, $set: { updatedAt: new Date() } })
      if (!r.matchedCount) break // beh nahradil nový
      if (doc.stage === "collect") {
        const key = doc.pending[0]
        if (!key) {
          await col.updateOne(mine, { $set: { stage: "merge", failures: 0 } })
          doc.stage = "merge"
          continue
        }
        await collectMonth(ctx, doc, key)
      } else if (doc.stage === "merge") {
        await mergeTopics(ctx, doc)
      } else if (doc.stage === "draft") {
        const key = doc.draftPending[0]
        if (!key) {
          await col.updateOne(mine, { $set: { stage: "done", finishedAt: new Date(), failures: 0 } })
          break
        }
        await draftTopic(ctx, doc, key)
      }
      done += 1
    }
  } catch (e) {
    console.error(`[faq-harvest] ${code}/${channelKey} zlyhala:`, e)
    await col.updateOne(mine, { $set: { error: e instanceof AppError ? e.code : "failed", updatedAt: new Date() } })
  } finally {
    await col.updateOne(mine, { $set: { leaseUntil: null } })
  }
  return done
}

export async function harvestsInProgress(): Promise<Pick<FaqHarvest, "companyCode" | "channelKey">[]> {
  return (await harvests())
    .find({ stage: { $ne: "done" }, failures: { $lt: MAX_FAILURES } }, { projection: { _id: 0, companyCode: 1, channelKey: 1 } })
    .toArray()
}
