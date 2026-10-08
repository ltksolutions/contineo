/**
 * historyAnalysis.ts — analýza histórie schránky bez zápisu (ADR-030, D179, D180).
 *
 * Krok 1 ťažby histórie: koľko správ a vlákien schránka za obdobie mala,
 * koľko z nich dostalo odpoveď, ako rýchlo, a o čom zhruba boli. Číta sa
 * **len hlavička** (dátum, vlákno, odosielateľ, predmet, priečinok); telá
 * sa nečítajú a modelu nič neodchádza.
 *
 * Ukladá sa jeden dokument na kanál s **mesačným súhrnom** — žiadne adresy,
 * mená, predmety ani identifikátory správ. Časté slová z predmetov prejdú
 * do súhrnu, len keď sa v mesiaci opakujú v aspoň `TERM_MIN_THREADS`
 * vláknach od aspoň `TERM_MIN_SENDERS` rôznych odosielateľov: priezvisko
 * z predmetu („Prestup — Novák") ten prah neprejde.
 *
 * Beh ide po mesiacoch od najnovšieho; prvé mesiace spracuje akcia
 * správcu, zvyšok cron `/api/cron/helpdesk-history`. Mesiac sa číta
 * s presahom `MARGIN_DAYS` na obe strany — odpoveď na otázku z 30. dňa
 * príde až v ďalšom mesiaci a vlákno začaté skôr nie je nové.
 *
 * Mesiace sú v UTC: pri súhrne za tri roky posun o hodinu na hranici
 * mesiaca nič nezmení a výpočet nezávisí od časového pásma servera.
 */

import { getCollection } from "./mongodb"
import { AppError } from "./appError"
import { requireCompanyCode } from "./tenantScope"
import { channelByKey, mailboxFor } from "./channels"
import { isBounce } from "./mailbox/bounce"
import { scrubPersonalData } from "./faqMining"
import type { MailHeader } from "./mailbox/types"

export class HistoryAnalysisError extends AppError {}

export const ANALYSES_COLLECTION = "mailbox_analyses"
export const ANALYSIS_PERIODS = [12, 24, 36] as const
export const DEFAULT_ANALYSIS_MONTHS = 36
export const MARGIN_DAYS = 14
export const TERM_MIN_THREADS = 5
export const TERM_MIN_SENDERS = 3
/** Koľko častých slov mesiaca sa uloží. */
export const TERMS_PER_MONTH = 40
/** Po toľkých zlyhaniach za sebou cron analýzu nechá a čaká na správcu. */
export const MAX_FAILURES = 5

const DAY = 86_400_000
const HOUR = 3_600_000

export interface MonthStats {
  month: string
  incoming: number
  outgoing: number
  bounces: number
  junk: number
  deleted: number
  /** Vlákna, ktoré v mesiaci začala správa zvonku. */
  threads: number
  /** Z nich od odosielateľa z domény schránky (kolegovia). */
  internalThreads: number
  answered: number
  answeredWithin24h: number
  /** Medián hodín do prvej odpovede; null, keď nič odpovedané nebolo. */
  medianReplyHours: number | null
  senders: number
  terms: { term: string; threads: number }[]
}

export interface MailboxAnalysis {
  companyCode: string
  channelKey: string
  /** Plánované mesiace, najnovší prvý. */
  months: string[]
  /** Ešte nespracované, v poradí spracovania. */
  pending: string[]
  stats: Record<string, MonthStats>
  startedAt: Date
  startedBy: string
  updatedAt: Date
  finishedAt: Date | null
  error: string | null
  failures: number
}

// ── Mesiace ─────────────────────────────────────────────────────────────────

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export function monthRange(key: string): { start: Date; end: Date } {
  const [y, m] = key.split("-").map(Number)
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) }
}

/**
 * Posledných `count` celých mesiacov pred mesiacom `now`, najnovší prvý.
 * Bežiaci mesiac sa nepočíta — jeho čísla by sa ešte menili.
 */
export function monthsBack(now: Date, count: number): string[] {
  const out: string[] = []
  for (let i = 1; i <= count; i++) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))))
  return out
}

// ── Predmet → slová ─────────────────────────────────────────────────────────

/** Predpony odpovede a preposlania v jazykoch, ktoré v schránke chodia. */
const REPLY_PREFIX = /^\s*(re|fw|fwd|aw|wg|odp|tr|vs|sv|ant|odpoveď|odpověď|přeposlat|preposlať)\s*(\[\d+\]|\(\d+\))?\s*:\s*/i

export function normalizeSubject(subject: string): string {
  let s = subject
  for (let i = 0; i < 10 && REPLY_PREFIX.test(s); i++) s = s.replace(REPLY_PREFIX, "")
  return scrubPersonalData(s).toLowerCase().replace(/\s+/g, " ").trim()
}

/**
 * Slová, ktoré o téme nič nepovedia. Zámerne krátky zoznam: dlhý by
 * zahodil aj odborné slová, ktoré vyzerajú ako výplň („žiadosť").
 */
const STOPWORDS = new Set([
  // sk
  "pre", "pri", "ako", "aby", "ale", "alebo", "ani", "však", "ktorý", "ktorá", "ktoré", "som", "sme", "ste", "sú", "bol", "bola",
  "bolo", "byť", "mám", "máme", "nie", "áno", "ďakujem", "dakujem", "prosím", "prosim", "dobrý", "dobry", "deň", "den", "otázka",
  "otazka", "info", "informácia", "informacia", "dotaz", "the", "and", "for", "you", "your", "with", "from", "this", "that",
  // cs
  "pro", "jak", "nebo", "který", "která", "které", "jsem", "jsme", "jste", "jsou", "byl", "děkuji", "dekuji", "prosím", "dobrý",
  "den", "otázka", "informace",
  // značky z očistenia (`scrubPersonalData`)
  "e-mail", "číslo", "účet", "odkaz",
])

export function subjectTerms(subject: string): string[] {
  const words = normalizeSubject(subject)
    .split(/[^\p{L}\p{N}-]+/u)
    .map(w => w.replace(/^-+|-+$/g, ""))
    .filter(w => w.length >= 3 && !/^\d+$/.test(w) && !STOPWORDS.has(w))
  const out = new Set<string>(words)
  for (let i = 0; i + 1 < words.length; i++) out.add(`${words[i]} ${words[i + 1]}`)
  return [...out]
}

// ── Súhrn mesiaca ───────────────────────────────────────────────────────────

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = xs.slice().sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function bounce(h: MailHeader): boolean {
  return isBounce({ from: h.fromAddress ? { address: h.fromAddress, name: null } : null, subject: h.subject, outgoing: h.outgoing })
}

/**
 * Hlavičky okna (mesiac + presah) → súhrn mesiaca `key`. Počty správ sú
 * len z mesiaca; presah slúži na odpoveď a na to, či je vlákno nové.
 */
export function summarizeMonth(headers: MailHeader[], key: string, mailboxAddress: string): MonthStats {
  const { start, end } = monthRange(key)
  const inMonth = (h: MailHeader) => h.receivedAt >= start && h.receivedAt < end
  const ownDomain = mailboxAddress.toLowerCase().split("@")[1] ?? ""
  const stats: MonthStats = {
    month: key, incoming: 0, outgoing: 0, bounces: 0, junk: 0, deleted: 0,
    threads: 0, internalThreads: 0, answered: 0, answeredWithin24h: 0, medianReplyHours: null, senders: 0, terms: [],
  }
  const live: MailHeader[] = []
  for (const h of headers) {
    const isBounceMsg = bounce(h)
    if (inMonth(h)) {
      if (h.folder === "junk") stats.junk += 1
      else if (h.folder === "deleted" && !h.outgoing) stats.deleted += 1
      else if (h.outgoing) stats.outgoing += 1
      else if (isBounceMsg) stats.bounces += 1
      else stats.incoming += 1
    }
    if (h.folder === "other" && !isBounceMsg) live.push(h)
  }

  const byThread = new Map<string, MailHeader[]>()
  for (const h of live) byThread.set(h.threadRef, [...(byThread.get(h.threadRef) ?? []), h])

  const replyHours: number[] = []
  const senders = new Set<string>()
  const terms = new Map<string, { threads: number; senders: Set<string> }>()
  for (const list of byThread.values()) {
    const ordered = list.slice().sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime())
    const first = ordered[0]
    // Vlákno začal helpdesk alebo začalo pred mesiacom — nie je to nová otázka.
    if (first.outgoing || !inMonth(first)) continue
    stats.threads += 1
    const from = first.fromAddress ?? ""
    if (ownDomain && from.endsWith(`@${ownDomain}`)) stats.internalThreads += 1
    if (from) senders.add(from)
    const reply = ordered.find(h => h.outgoing && h.receivedAt > first.receivedAt)
    if (reply) {
      stats.answered += 1
      const hours = (reply.receivedAt.getTime() - first.receivedAt.getTime()) / HOUR
      replyHours.push(hours)
      if (hours <= 24) stats.answeredWithin24h += 1
    }
    for (const term of subjectTerms(first.subject)) {
      const t = terms.get(term) ?? { threads: 0, senders: new Set<string>() }
      t.threads += 1
      if (from) t.senders.add(from)
      terms.set(term, t)
    }
  }
  const m = median(replyHours)
  stats.medianReplyHours = m === null ? null : Math.round(m * 10) / 10
  stats.senders = senders.size
  stats.terms = [...terms.entries()]
    .filter(([, t]) => t.threads >= TERM_MIN_THREADS && t.senders.size >= TERM_MIN_SENDERS)
    .map(([term, t]) => ({ term, threads: t.threads }))
    .sort((a, b) => b.threads - a.threads || a.term.localeCompare(b.term))
    .slice(0, TERMS_PER_MONTH)
  return stats
}

// ── Súhrn obdobia (pre obrazovku) ───────────────────────────────────────────

export interface AnalysisSummary {
  months: MonthStats[]
  incoming: number
  outgoing: number
  bounces: number
  threads: number
  internalThreads: number
  answered: number
  answeredWithin24h: number
  /** Medián mesačných mediánov — presný medián by potreboval uložiť všetky časy. */
  medianReplyHours: number | null
  /** Témy cez celé obdobie; `older`/`newer` = súčet v staršej a novšej polovici. */
  terms: { term: string; threads: number; months: number; older: number; newer: number }[]
}

export function summarizeAnalysis(a: Pick<MailboxAnalysis, "months" | "stats">, termLimit = 40): AnalysisSummary {
  const months = a.months.map(k => a.stats[k]).filter((s): s is MonthStats => Boolean(s))
  const sum = (f: (s: MonthStats) => number) => months.reduce((n, s) => n + f(s), 0)
  // `months` je najnovší prvý: novšia polovica sú prvé mesiace zoznamu.
  const half = Math.ceil(months.length / 2)
  const terms = new Map<string, { threads: number; months: number; older: number; newer: number }>()
  months.forEach((s, i) => {
    for (const t of s.terms) {
      const x = terms.get(t.term) ?? { threads: 0, months: 0, older: 0, newer: 0 }
      x.threads += t.threads
      x.months += 1
      if (i < half) x.newer += t.threads
      else x.older += t.threads
      terms.set(t.term, x)
    }
  })
  return {
    months,
    incoming: sum(s => s.incoming),
    outgoing: sum(s => s.outgoing),
    bounces: sum(s => s.bounces),
    threads: sum(s => s.threads),
    internalThreads: sum(s => s.internalThreads),
    answered: sum(s => s.answered),
    answeredWithin24h: sum(s => s.answeredWithin24h),
    medianReplyHours: median(months.map(s => s.medianReplyHours).filter((x): x is number => x !== null)),
    terms: [...terms.entries()]
      .map(([term, x]) => ({ term, ...x }))
      .sort((p, q) => q.threads - p.threads || p.term.localeCompare(q.term))
      .slice(0, termLimit),
  }
}

// ── Beh ─────────────────────────────────────────────────────────────────────

async function analyses() {
  return getCollection<MailboxAnalysis>(ANALYSES_COLLECTION)
}

export async function analysisFor(companyCode: string, channelKey: string): Promise<MailboxAnalysis | null> {
  const code = requireCompanyCode(companyCode, "analysisFor")
  return (await analyses()).findOne({ companyCode: code, channelKey }, { projection: { _id: 0 } })
}

/** Nový beh prepíše predchádzajúci — súhrn nie je dôkazný záznam (D180). */
export async function startAnalysis(companyCode: string, channelKey: string, months: number, actorEmail: string, now = new Date()): Promise<void> {
  const code = requireCompanyCode(companyCode, "startAnalysis")
  const channel = await channelByKey(code, channelKey)
  if (!channel) throw new HistoryAnalysisError("helpdesk.notFound", "Taký kanál tu nie je.")
  if (!channel.mailbox) throw new HistoryAnalysisError("helpdesk.noMailbox", "Kanál nemá schránku.")
  const period = (ANALYSIS_PERIODS as readonly number[]).includes(months) ? months : DEFAULT_ANALYSIS_MONTHS
  const plan = monthsBack(now, period)
  await (await analyses()).replaceOne(
    { companyCode: code, channelKey },
    {
      companyCode: code, channelKey, months: plan, pending: plan, stats: {},
      startedAt: now, startedBy: actorEmail, updatedAt: now, finishedAt: null, error: null, failures: 0,
    },
    { upsert: true },
  )
}

/**
 * Spracuje ďalšie mesiace, kým neuplynie `budgetMs`. Každý mesiac sa uloží
 * hneď — prerušený beh (časový limit funkcie) nepríde o hotové mesiace.
 * Vracia počet spracovaných mesiacov v tomto kole.
 */
export async function continueAnalysis(companyCode: string, channelKey: string, budgetMs: number): Promise<number> {
  const code = requireCompanyCode(companyCode, "continueAnalysis")
  const col = await analyses()
  const doc = await col.findOne({ companyCode: code, channelKey })
  if (!doc || !doc.pending.length) return 0
  const channel = await channelByKey(code, channelKey)
  if (!channel?.mailbox) return 0
  const deadline = Date.now() + budgetMs
  let done = 0
  try {
    const adapter = mailboxFor(channel)
    for (const key of doc.pending) {
      if (Date.now() > deadline) break
      const { start, end } = monthRange(key)
      const headers = await adapter.listHeaders(new Date(start.getTime() - MARGIN_DAYS * DAY), new Date(end.getTime() + MARGIN_DAYS * DAY))
      const stats = summarizeMonth(headers, key, adapter.address)
      const last = doc.pending.length === done + 1
      await col.updateOne(
        { companyCode: code, channelKey },
        {
          $set: { [`stats.${key}`]: stats, updatedAt: new Date(), error: null, failures: 0, ...(last ? { finishedAt: new Date() } : {}) },
          $pull: { pending: key },
        },
      )
      done += 1
    }
  } catch (e) {
    console.error(`[history-analysis] ${code}/${channelKey} zlyhala:`, e)
    await col.updateOne(
      { companyCode: code, channelKey },
      { $set: { error: e instanceof AppError ? e.code : "failed", updatedAt: new Date() }, $inc: { failures: 1 } },
    )
  }
  return done
}

/** Rozbehnuté analýzy pre cron — naprieč organizáciami, ako `channelsWithMailbox()`. */
export async function analysesInProgress(): Promise<Pick<MailboxAnalysis, "companyCode" | "channelKey">[]> {
  return (await analyses())
    .find({ "pending.0": { $exists: true }, failures: { $lt: MAX_FAILURES } }, { projection: { _id: 0, companyCode: 1, channelKey: 1 } })
    .toArray()
}
