/**
 * channelStats.ts — štatistika jedného kanála za kalendárne obdobie
 * (KANAL-statistika, Ján 30. 10. 2026: „statistiky (den, tyzden, mesiac,
 * rok) a prehladu vyuzitia AI, cenu … pre reportovanie na boarde").
 *
 * Nič sa neukladá, všetko sa odvodzuje pri čítaní (D27) z troch zdrojov:
 *
 *   • `evaluations` — zodpovedané otázky, hodnotenie „Sedí / Nesedí"
 *     a posudok hodnotiteľa,
 *   • `unanswered_questions` — otázky, na ktoré sa nič nenašlo (od 30. 10.),
 *   • `tickets` — e-mailové a chatové tickety kanála,
 *   • `ai_usage` — volania AI a ich cena.
 *
 * **Komu záznam patrí.** Odpoveď vo widgete nesie kanál len ako kópiu
 * názvu (`origin.label`) a spotreba ho nesie až od #510. Kanál sa preto
 * určuje cez osobu, ktorá sa pýtala: osoba z widgetu má účet kanála
 * v `externalRef.widget.<kľúč>`. Záznamy bez pôvodu (pred 30. 10.) sa
 * pripíšu len osobám, ktoré widget kanála **založil** (`createdBy`) —
 * zamestnanec, ktorý sa pýta aj cez intranet, by inak do kanála preniesol
 * aj svoje otázky z intranetu.
 *
 * Obdobia sú kalendárne v čase SFZ (`SEARCH_TIME_ZONE`), týždeň od
 * pondelka — board porovnáva celé mesiace, nie „posledných 30 dní" (Q2).
 */

import { getCollection } from "./mongodb"
import { PERSONS_COLLECTION, type Person } from "./persons"
import { RATINGS_COLLECTION, type RatingRecord } from "./ratings"
import { TICKETS_COLLECTION, type Ticket } from "./tickets"
import { AI_USAGE_COLLECTION, type AiUsageRecord } from "./aiUsage"
import { unansweredCollection } from "./unansweredQuestions"
import { needsEvaluation } from "./evaluation"
import { requireCompanyCode } from "./tenantScope"
import { SEARCH_TIME_ZONE } from "./versionContext"

// ── obdobie ──────────────────────────────────────────────────────────────────

export const STAT_PERIODS = ["day", "week", "month", "year"] as const
export type StatPeriod = (typeof STAT_PERIODS)[number]

export function statPeriod(raw: string | undefined): StatPeriod {
  return (STAT_PERIODS as readonly string[]).includes(raw ?? "") ? (raw as StatPeriod) : "week"
}

/** Kalendárny deň v čase SFZ — mesiac od 0. */
export interface LocalDay { year: number; month: number; day: number }

export interface StatBucket extends LocalDay {
  start: Date
  end: Date
  /** Hodina pri dennom pohľade. */
  hour?: number
}

export interface StatRange {
  period: StatPeriod
  /** Prvý deň obdobia `YYYY-MM-DD` — hodnota `?at=` v adrese. */
  at: string
  first: LocalDay
  /** Posledný deň obdobia vrátane. */
  last: LocalDay
  start: Date
  /** Okamih za koncom obdobia (exkluzívne). */
  end: Date
  buckets: StatBucket[]
}

const localFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SEARCH_TIME_ZONE, year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short",
})
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function localParts(d: Date) {
  const p = Object.fromEntries(localFmt.formatToParts(d).map(x => [x.type, x.value]))
  return {
    year: Number(p.year), month: Number(p.month) - 1, day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), weekday: WEEKDAYS.indexOf(p.weekday),
  }
}

/** Okamih, keď je v čase SFZ daný deň a hodina. `Date.UTC` zvládne pretečenie dní a mesiacov. */
export function zonedInstant(year: number, month: number, day: number, hour = 0): Date {
  const wall = Date.UTC(year, month, day, hour)
  const offset = (t: number) => {
    const p = localParts(new Date(t))
    return Date.UTC(p.year, p.month, p.day, p.hour, p.minute) - Math.floor(t / 60_000) * 60_000
  }
  // Dva kroky: posun na hranici letného času je iný ako o hodinu skôr.
  const first = wall - offset(wall)
  return new Date(wall - offset(first))
}

function dayOf(y: number, m: number, d: number): LocalDay {
  const x = new Date(Date.UTC(y, m, d))
  return { year: x.getUTCFullYear(), month: x.getUTCMonth(), day: x.getUTCDate() }
}

const iso = (d: LocalDay) => `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`

function parseDay(text: string | undefined): LocalDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text ?? "")
  if (!m) return null
  const d = dayOf(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return iso(d) === text ? d : null
}

/** Obdobie, do ktorého patrí deň `at` (nečitateľný = dnes). */
export function statRange(period: StatPeriod, atText: string | undefined, now = new Date()): StatRange {
  const today = localParts(now)
  const base = parseDay(atText) ?? { year: today.year, month: today.month, day: today.day }
  const weekday = (new Date(Date.UTC(base.year, base.month, base.day)).getUTCDay() + 6) % 7
  const first =
    period === "day" ? base :
    period === "week" ? dayOf(base.year, base.month, base.day - weekday) :
    period === "month" ? dayOf(base.year, base.month, 1) :
    dayOf(base.year, 0, 1)
  const after =
    period === "day" ? dayOf(first.year, first.month, first.day + 1) :
    period === "week" ? dayOf(first.year, first.month, first.day + 7) :
    period === "month" ? dayOf(first.year, first.month + 1, 1) :
    dayOf(first.year + 1, 0, 1)
  const last = dayOf(after.year, after.month, after.day - 1)

  const buckets: StatBucket[] = []
  if (period === "day") {
    for (let h = 0; h < 24; h++) {
      buckets.push({ ...first, hour: h, start: zonedInstant(first.year, first.month, first.day, h), end: zonedInstant(first.year, first.month, first.day, h + 1) })
    }
  } else if (period === "year") {
    for (let m = 0; m < 12; m++) {
      buckets.push({ ...dayOf(first.year, m, 1), start: zonedInstant(first.year, m, 1), end: zonedInstant(first.year, m + 1, 1) })
    }
  } else {
    const days = Math.round((Date.UTC(after.year, after.month, after.day) - Date.UTC(first.year, first.month, first.day)) / 86_400_000)
    for (let i = 0; i < days; i++) {
      buckets.push({ ...dayOf(first.year, first.month, first.day + i), start: zonedInstant(first.year, first.month, first.day + i), end: zonedInstant(first.year, first.month, first.day + i + 1) })
    }
  }
  return {
    period, at: iso(first), first, last,
    start: zonedInstant(first.year, first.month, first.day),
    end: zonedInstant(after.year, after.month, after.day),
    buckets,
  }
}

/** Obdobie o `n` dozadu (záporné) alebo dopredu. */
export function shiftRange(r: StatRange, n: number): StatRange {
  const f = r.first
  const at =
    r.period === "day" ? dayOf(f.year, f.month, f.day + n) :
    r.period === "week" ? dayOf(f.year, f.month, f.day + 7 * n) :
    r.period === "month" ? dayOf(f.year, f.month + n, 1) :
    dayOf(f.year + n, 0, 1)
  return statRange(r.period, iso(at))
}

// ── dáta ─────────────────────────────────────────────────────────────────────

type RatingRow = Pick<RatingRecord, "createdAt" | "readerVerdict" | "readerNote" | "correct" | "hallucination" | "evaluatedAt" | "dismissedAt">
type TicketRow = Pick<Ticket, "createdAt" | "closedAt"> & { messages: Pick<Ticket["messages"][number], "direction" | "at">[] }
type UsageRow = Pick<AiUsageRecord, "at" | "purpose" | "subject" | "usd" | "tokens">

export interface ChannelStatsData {
  ratings: RatingRow[]
  unanswered: Date[]
  tickets: TicketRow[]
  usage: UsageRow[]
}

/**
 * Skupiny ceny v kanáli. Návrh odpovede na ticket je v `ai_usage` účel
 * „answer" s predmetom `ticket: …` (`ticketDraft.ts`) — pre board je to
 * iná vec než odpoveď vo widgete, preto vlastný riadok.
 */
export const COST_GROUPS = ["answer", "ticket-draft", "query-rewrite", "query-classify", "faq-mining", "other"] as const
export type CostGroup = (typeof COST_GROUPS)[number]

export function costGroup(r: Pick<UsageRow, "purpose" | "subject">): CostGroup {
  if (r.purpose === "answer") return r.subject?.startsWith("ticket:") ? "ticket-draft" : "answer"
  return r.purpose === "query-rewrite" || r.purpose === "query-classify" || r.purpose === "faq-mining" ? r.purpose : "other"
}

const tokenSum = (t: UsageRow["tokens"] | undefined) => (t ? t.input + t.output + t.cacheRead + t.cacheWrite : 0)

export interface PeriodSummary {
  questions: number
  answered: number
  unanswered: number
  reader: { fits: number; doesNotFit: number; none: number }
  verdicts: { correct: number; wrong: number; hallucination: number; dismissed: number; pending: number }
  tickets: { received: number; answered: number; closed: number; reopened: number; medianMs: number | null; p90Ms: number | null }
  cost: { usd: number; calls: number; tokens: number; byGroup: Record<CostGroup, { usd: number; tokens: number }> }
}

const within = (d: Date | null | undefined, from: Date, to: Date) => Boolean(d) && d! >= from && d! < to

/** Percentil podľa najbližšieho poradia — pri desiatkach ticketov netreba interpoláciu. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]
}

/** Ticket začína prvou prichádzajúcou správou — pri importe histórie je `createdAt` deň importu. */
const ticketStart = (t: TicketRow) => t.messages.find(m => m.direction === "in")?.at ?? t.createdAt

/** Čistá funkcia — súhrn za `[from, to)`. */
export function summarize(data: ChannelStatsData, from: Date, to: Date): PeriodSummary {
  const s: PeriodSummary = {
    questions: 0, answered: 0, unanswered: 0,
    reader: { fits: 0, doesNotFit: 0, none: 0 },
    verdicts: { correct: 0, wrong: 0, hallucination: 0, dismissed: 0, pending: 0 },
    tickets: { received: 0, answered: 0, closed: 0, reopened: 0, medianMs: null, p90Ms: null },
    cost: { usd: 0, calls: 0, tokens: 0, byGroup: Object.fromEntries(COST_GROUPS.map(g => [g, { usd: 0, tokens: 0 }])) as PeriodSummary["cost"]["byGroup"] },
  }
  for (const z of data.ratings) {
    if (!within(z.createdAt, from, to)) continue
    s.answered++
    // Ako štatistika posudkov: „Nesedí" je aj poznámka bez kliknutia.
    if (z.readerVerdict === 0 || z.readerNote?.trim()) s.reader.doesNotFit++
    else if (z.readerVerdict === 1) s.reader.fits++
    else s.reader.none++
    if (z.dismissedAt) s.verdicts.dismissed++
    else if (z.evaluatedAt) {
      if (z.correct === 1) s.verdicts.correct++
      if (z.correct === 0) s.verdicts.wrong++
      if (z.hallucination === 1) s.verdicts.hallucination++
    }
    if (!z.dismissedAt && needsEvaluation(z)) s.verdicts.pending++
  }
  s.unanswered = data.unanswered.filter(d => within(d, from, to)).length
  s.questions = s.answered + s.unanswered

  const waits: number[] = []
  for (const t of data.tickets) {
    const start = ticketStart(t)
    const firstOut = t.messages.find(m => m.direction === "out")
    if (within(start, from, to)) {
      s.tickets.received++
      if (firstOut) waits.push(firstOut.at.getTime() - start.getTime())
    }
    if (firstOut && within(firstOut.at, from, to)) s.tickets.answered++
    if (within(t.closedAt, from, to)) s.tickets.closed++
    // Znovu otvorený: po odpovedi prišla ďalšia správa zvonku.
    if (firstOut && t.messages.some(m => m.direction === "in" && m.at > firstOut.at && within(m.at, from, to))) s.tickets.reopened++
  }
  s.tickets.medianMs = percentile(waits, 0.5)
  s.tickets.p90Ms = percentile(waits, 0.9)

  for (const u of data.usage) {
    if (!within(u.at, from, to)) continue
    const g = s.cost.byGroup[costGroup(u)]
    const tokens = tokenSum(u.tokens)
    s.cost.usd += u.usd ?? 0
    s.cost.calls++
    s.cost.tokens += tokens
    g.usd += u.usd ?? 0
    g.tokens += tokens
  }
  return s
}

/** Kto sa v kanáli pýtal: všetky osoby s účtom kanála a tie, ktoré widget založil. */
async function channelPersons(companyCode: string, channelKey: string) {
  const persons = await getCollection<Person>(PERSONS_COLLECTION)
  const rows = await persons
    .find({ companyCode, [`externalRef.widget.${channelKey}`]: { $exists: true } } as never, { projection: { _id: 0, id: 1, createdBy: 1 } })
    .toArray()
  return {
    all: rows.map(p => p.id),
    created: rows.filter(p => (p as { createdBy?: string }).createdBy === `widget:${channelKey}`).map(p => p.id),
  }
}

/** Surové riadky kanála za `[from, to)`. Cenu číta len správca (Q3). */
export async function loadChannelStats(
  companyCode: string,
  channelKey: string,
  from: Date,
  to: Date,
  opts: { withCost: boolean },
): Promise<ChannelStatsData> {
  const code = requireCompanyCode(companyCode, "loadChannelStats")
  const persons = await channelPersons(code, channelKey)
  const ratingsCol = await getCollection<RatingRecord>(RATINGS_COLLECTION)
  const ticketsCol = await getCollection<Ticket>(TICKETS_COLLECTION)

  const [ratings, unanswered, tickets, usage] = await Promise.all([
    persons.all.length
      ? ratingsCol.find({
          companyCode: code, createdAt: { $gte: from, $lt: to },
          $or: [
            { askedBy: { $in: persons.all }, "origin.kind": "widget" },
            { askedBy: { $in: persons.created }, origin: { $exists: false } },
          ],
        } as never, { projection: { _id: 0, createdAt: 1, readerVerdict: 1, readerNote: 1, correct: 1, hallucination: 1, evaluatedAt: 1, dismissedAt: 1 } }).toArray()
      : Promise.resolve([]),
    (await unansweredCollection())
      .find({ companyCode: code, channelKey, at: { $gte: from, $lt: to } }, { projection: { _id: 0, at: 1 } })
      .toArray(),
    // Ticket patrí do obdobia aj odpoveďou či uzavretím, nielen vznikom.
    ticketsCol.find({ companyCode: code, channelKey, updatedAt: { $gte: from }, createdAt: { $lt: to } } as never, {
      projection: { _id: 0, createdAt: 1, closedAt: 1, "messages.direction": 1, "messages.at": 1 },
    }).toArray(),
    opts.withCost
      ? (await getCollection<AiUsageRecord>(AI_USAGE_COLLECTION)).find({
          companyCode: code, at: { $gte: from, $lt: to },
          $or: [
            { channelKey },
            // Pred #510 (30. 10. 2026) riadok kanál nemal.
            { channelKey: { $exists: false }, personId: { $in: persons.created } },
          ],
        } as never, { projection: { _id: 0, at: 1, purpose: 1, subject: 1, usd: 1, tokens: 1 } }).toArray()
      : Promise.resolve([]),
  ])
  return {
    ratings: ratings as RatingRow[],
    unanswered: unanswered.map(u => u.at),
    tickets: (tickets as TicketRow[]).map(t => ({ ...t, messages: [...(t.messages ?? [])].sort((a, b) => a.at.getTime() - b.at.getTime()) })),
    usage: usage as UsageRow[],
  }
}

/** Deň, od ktorého štatistika pozná nezodpovedané otázky a kanál pri cene. */
export const STATS_SINCE = new Date("2026-10-30T00:00:00Z")
