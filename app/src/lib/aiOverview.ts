/**
 * aiOverview.ts — Prehľad spotreby AI po mesiacoch (návrh ORG-ai-prehlad,
 * 24. 10. 2026; ADR-026).
 *
 * Spotreba ukazuje jednotlivé volania; Prehľad ich sčíta podľa osoby, účelu
 * alebo modelu a mesiaca. Obdobie je **ten istý filter Od–Do** ako v Spotrebe
 * (`usageFilterFromQuery`, Ján 24. 10. 2026) a mesiace sú v UTC ako tam —
 * číslo v bunke sa po kliknutí musí zhodovať so súčtom v Spotrebe.
 *
 * Agregácia je v Mongu, tvar pre obrazovku a export robí `shapeOverview`
 * (čistá funkcia, testovaná bez databázy).
 */

import { getCollection } from "./mongodb"
import {
  AI_USAGE_COLLECTION, BACKGROUND_PERSON, usageQuery, usageTotals,
  type AiUsageRecord, type UsageFilter,
} from "./aiUsage"
import { EMPTY_TOKENS, type TokenCounts } from "./pricing"

export const OVERVIEW_GROUPS = ["people", "purposes", "models"] as const
export type OverviewGroup = (typeof OVERVIEW_GROUPS)[number]

/** Pohľad z adresy (`?by=`); neznámy = Osoby. */
export function overviewGroup(value: string | undefined): OverviewGroup {
  return (OVERVIEW_GROUPS as readonly string[]).includes(value ?? "") ? value as OverviewGroup : "people"
}

export interface OverviewMonth {
  /** `YYYY-MM` — kľúč z agregácie. */
  key: string
  year: number
  /** 0–11 */
  month: number
  /** Prvý a posledný deň mesiaca orezaný na obdobie, `YYYY-MM-DD` — do odkazu na Spotrebu. */
  fromText: string
  toText: string
  /** Mesiac sa ešte nezačal — prázdne miesto, nie nula. */
  future: boolean
}

/** Mesiace, ktoré obdobie zasahuje (`to` je exkluzívne ako v `UsageFilter`). */
export function overviewMonths(from: Date, to: Date, now: Date = new Date()): OverviewMonth[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const last = new Date(to.getTime() - 24 * 3600 * 1000)
  const out: OverviewMonth[] = []
  let y = from.getUTCFullYear(), m = from.getUTCMonth()
  while (y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth())) {
    const start = new Date(Date.UTC(y, m, 1))
    const end = new Date(Date.UTC(y, m + 1, 0))
    out.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      year: y,
      month: m,
      fromText: iso(start < from ? from : start),
      toText: iso(end > last ? last : end),
      future: start > now,
    })
    if (++m === 12) { m = 0; y++ }
  }
  return out
}

/** Riadok agregácie: jedna položka pohľadu v jednom mesiaci. */
export interface OverviewBucket {
  key: string
  name: string
  background: boolean
  month: string
  usd: number
  calls: number
  tokens: TokenCounts
}

export interface OverviewItem {
  /** Hodnota do filtra Spotreby (`person`, `purpose` alebo `model`). */
  key: string
  name: string
  background: boolean
  /** Suma po mesiacoch v poradí `months`; budúci mesiac je `null`. */
  byMonth: (number | null)[]
  /** Tokeny po mesiacoch — pohľad Modely ich ukazuje pod sumou. */
  tokensByMonth: (TokenCounts | null)[]
  usd: number
  calls: number
  tokens: TokenCounts
}

export interface Overview {
  group: OverviewGroup
  months: OverviewMonth[]
  items: OverviewItem[]
  totals: { usd: number; calls: number; tokens: TokenCounts; byMonth: (number | null)[] }
}

const addTokens = (a: TokenCounts, b: TokenCounts): TokenCounts => ({
  input: a.input + b.input, output: a.output + b.output,
  cacheWrite: a.cacheWrite + b.cacheWrite, cacheRead: a.cacheRead + b.cacheRead,
})

/** Z riadkov agregácie matica položka × mesiac, zoradená podľa sumy. */
export function shapeOverview(group: OverviewGroup, months: OverviewMonth[], buckets: OverviewBucket[]): Overview {
  const index = new Map(months.map((m, i) => [m.key, i]))
  const items = new Map<string, OverviewItem>()
  const blank = () => months.map(m => (m.future ? null : 0))
  for (const b of buckets) {
    const i = index.get(b.month)
    if (i === undefined) continue
    let it = items.get(b.key)
    if (!it) {
      it = {
        key: b.key, name: b.name, background: b.background,
        byMonth: blank(), tokensByMonth: months.map(m => (m.future ? null : { ...EMPTY_TOKENS })),
        usd: 0, calls: 0, tokens: { ...EMPTY_TOKENS },
      }
      items.set(b.key, it)
    }
    it.byMonth[i] = (it.byMonth[i] ?? 0) + b.usd
    it.tokensByMonth[i] = addTokens(it.tokensByMonth[i] ?? { ...EMPTY_TOKENS }, b.tokens)
    it.usd += b.usd
    it.calls += b.calls
    it.tokens = addTokens(it.tokens, b.tokens)
  }
  const list = [...items.values()].sort((a, b) => b.usd - a.usd || a.name.localeCompare(b.name, "sk"))
  return {
    group,
    months,
    items: list,
    totals: {
      usd: list.reduce((s, it) => s + it.usd, 0),
      calls: list.reduce((s, it) => s + it.calls, 0),
      tokens: list.reduce((s, it) => addTokens(s, it.tokens), { ...EMPTY_TOKENS }),
      byMonth: months.map((m, i) => (m.future ? null : list.reduce((s, it) => s + (it.byMonth[i] ?? 0), 0))),
    },
  }
}

/** Najväčších `top` položiek a zvyšok spolu — séria grafu. */
export function topWithRest(items: OverviewItem[], top = 5): { top: OverviewItem[]; rest: OverviewItem[] } {
  return { top: items.slice(0, top), rest: items.slice(top) }
}

const KEY: Record<OverviewGroup, unknown> = {
  people: { $ifNull: ["$personId", { $concat: [BACKGROUND_PERSON, "$personName"] }] },
  purposes: "$purpose",
  models: "$model",
}

/** Matica za obdobie filtra; osoba, účel a model filtra sa neberú — Prehľad ich rozkladá. */
export async function usageOverview(companyCode: string, f: UsageFilter, group: OverviewGroup, now: Date = new Date()): Promise<Overview> {
  const months = overviewMonths(f.from, f.to, now)
  const col = await getCollection<AiUsageRecord>(AI_USAGE_COLLECTION)
  const rows = await col.aggregate<{
    _id: { k: string | null; m: string }
    name: string; bg: boolean; usd: number; calls: number
    input: number; output: number; cacheWrite: number; cacheRead: number
  }>([
    { $match: usageQuery(companyCode, { from: f.from, to: f.to }) },
    { $sort: { at: -1 } },
    {
      $group: {
        _id: { k: KEY[group], m: { $dateToString: { date: "$at", format: "%Y-%m", timezone: "UTC" } } },
        // Najnovšia kópia mena — premenovaná osoba sa ukáže pod dnešným menom.
        name: { $first: group === "people" ? "$personName" : group === "purposes" ? "$purpose" : "$model" },
        bg: { $first: { $eq: [{ $ifNull: ["$personId", null] }, null] } },
        usd: { $sum: "$usd" },
        calls: { $sum: 1 },
        input: { $sum: "$tokens.input" },
        output: { $sum: "$tokens.output" },
        cacheWrite: { $sum: "$tokens.cacheWrite" },
        cacheRead: { $sum: "$tokens.cacheRead" },
      },
    },
  ]).toArray()
  const buckets: OverviewBucket[] = rows
    .filter(r => typeof r._id.k === "string")
    .map(r => ({
      key: r._id.k as string,
      name: r.name,
      background: group === "people" && r.bg,
      month: r._id.m,
      usd: r.usd,
      calls: r.calls,
      tokens: { input: r.input, output: r.output, cacheWrite: r.cacheWrite, cacheRead: r.cacheRead },
    }))
  return shapeOverview(group, months, buckets)
}

/**
 * Suma za to isté obdobie o rok skôr — len po dnešok, aby sa neúplný rok
 * neporovnával s celým minulým. `null`, keď vtedy nebola spotreba
 * (záznamy sa držia 25 mesiacov, D159).
 */
export async function previousYearUsd(companyCode: string, f: UsageFilter, now: Date = new Date()): Promise<number | null> {
  const back = (d: Date) => new Date(Date.UTC(d.getUTCFullYear() - 1, d.getUTCMonth(), d.getUTCDate()))
  const end = f.to > now ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)) : f.to
  if (end <= f.from) return null
  const prev = await usageTotals(companyCode, { from: back(f.from), to: back(end) })
  return prev.calls > 0 && prev.usd > 0 ? prev.usd : null
}

/** Počet volaní s modelom mimo cenníka — suma je vtedy neúplná. */
export async function unpricedCalls(companyCode: string, f: UsageFilter): Promise<number> {
  const col = await getCollection<AiUsageRecord>(AI_USAGE_COLLECTION)
  return col.countDocuments(usageQuery(companyCode, { from: f.from, to: f.to, unpriced: true }))
}


/**
 * Matica pre Excel: riadok na položku, stĺpec na mesiac, potom súčty a
 * tokeny. Názvy stĺpcov anglické a stabilné ako v exporte Spotreby
 * (`aiUsageExport.ts`) — výkaz sa spracúva aj skriptom. Sumy plné, nie
 * zaokrúhlené: súčet zaokrúhlených buniek by nesedel so Spolu.
 */
export function overviewAoa(o: Overview, nameOf: (it: OverviewItem) => string): (string | number)[][] {
  const head = ["name", "key", "background", ...o.months.map(m => m.key), "usd", "calls", "inputTokens", "outputTokens", "cacheWriteTokens", "cacheReadTokens"]
  const row = (name: string, key: string, bg: string, byMonth: (number | null)[], usd: number, calls: number, t: TokenCounts) =>
    [name, key, bg, ...byMonth.map(v => v ?? ""), usd, calls, t.input, t.output, t.cacheWrite, t.cacheRead]
  return [
    head,
    ...o.items.map(it => row(nameOf(it), it.key, it.background ? "yes" : "", it.byMonth, it.usd, it.calls, it.tokens)),
    row("total", "", "", o.totals.byMonth, o.totals.usd, o.totals.calls, o.totals.tokens),
  ]
}
