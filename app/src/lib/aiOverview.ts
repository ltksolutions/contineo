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
  AI_USAGE_COLLECTION, NO_PERSON, usageQuery, usageTotals,
  type AiUsageRecord, type UsageFilter,
} from "./aiUsage"
import { EMPTY_TOKENS, type TokenCounts } from "./pricing"
import { PERSONS_COLLECTION, type Person } from "./persons"

/** Celé mená osôb podľa `personId` (`persons.id`) v rámci organizácie. */
async function personNames(companyCode: string, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const col = await getCollection<Person>(PERSONS_COLLECTION)
  const rows = await col.find({ companyCode, id: { $in: [...new Set(ids)] } }, { projection: { id: 1, fullName: 1 } }).toArray()
  return new Map(rows.map(p => [p.id, p.fullName]))
}

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
  /**
   * Za mesiac nemôžu byť dáta — ešte sa nezačal, alebo je pred prvým
   * zapísaným volaním organizácie (spotreba sa zapisuje od 5. 10. 2026).
   * Prázdne miesto, nie nula, a do priemeru sa nepočíta.
   */
  blank: boolean
}

/**
 * Mesiace, ktoré obdobie zasahuje (`to` je exkluzívne ako v `UsageFilter`).
 * `since` = prvé zapísané volanie; mesiace pred ním sú prázdne.
 */
export function overviewMonths(from: Date, to: Date, now: Date = new Date(), since: Date | null = null): OverviewMonth[] {
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
      blank: start > now || (since !== null && end < new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1))),
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
  /** Suma po mesiacoch v poradí `months`; mesiac bez dát (`blank`) je `null`. */
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
  const blank = () => months.map(m => (m.blank ? null : 0))
  for (const b of buckets) {
    const i = index.get(b.month)
    if (i === undefined) continue
    let it = items.get(b.key)
    if (!it) {
      it = {
        key: b.key, name: b.name, background: b.background,
        byMonth: blank(), tokensByMonth: months.map(m => (m.blank ? null : { ...EMPTY_TOKENS })),
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
      byMonth: months.map((m, i) => (m.blank ? null : list.reduce((s, it) => s + (it.byMonth[i] ?? 0), 0))),
    },
  }
}

/** Najväčších `top` položiek a zvyšok spolu — séria grafu. */
export function topWithRest(items: OverviewItem[], top = 5): { top: OverviewItem[]; rest: OverviewItem[] } {
  return { top: items.slice(0, top), rest: items.slice(top) }
}

/**
 * Osoby sa zoskupujú podľa `personId`, nie podľa kópie mena: kontrola súladu
 * spustená človekom má jeho `personId`, ale meno procesu („Kontrola súladu
 * (na pozadí)") — Osoby by inak ukazovali procesy (Ján 24. 10. 2026). Práca
 * bez osoby je jeden riadok `none`.
 */
const KEY: Record<OverviewGroup, unknown> = {
  people: { $ifNull: ["$personId", NO_PERSON] },
  purposes: "$purpose",
  models: "$model",
}

/** Matica za obdobie filtra; osoba, účel a model filtra sa neberú — Prehľad ich rozkladá. */
export async function usageOverview(companyCode: string, f: UsageFilter, group: OverviewGroup, now: Date = new Date()): Promise<Overview> {
  const col = await getCollection<AiUsageRecord>(AI_USAGE_COLLECTION)
  const first = await col.find({ companyCode }, { projection: { at: 1 } }).sort({ at: 1 }).limit(1).next()
  const months = overviewMonths(f.from, f.to, now, first?.at ?? null)
  const rows = await col.aggregate<{
    _id: { k: string | null; m: string }
    name: string; usd: number; calls: number
    input: number; output: number; cacheWrite: number; cacheRead: number
  }>([
    { $match: usageQuery(companyCode, { from: f.from, to: f.to }) },
    { $sort: { at: -1 } },
    {
      $group: {
        _id: { k: KEY[group], m: { $dateToString: { date: "$at", format: "%Y-%m", timezone: "UTC" } } },
        // Najnovšia kópia mena — premenovaná osoba sa ukáže pod dnešným menom.
        name: { $first: group === "people" ? "$personName" : group === "purposes" ? "$purpose" : "$model" },
        usd: { $sum: "$usd" },
        calls: { $sum: 1 },
        input: { $sum: "$tokens.input" },
        output: { $sum: "$tokens.output" },
        cacheWrite: { $sum: "$tokens.cacheWrite" },
        cacheRead: { $sum: "$tokens.cacheRead" },
      },
    },
  ]).toArray()
  // Meno osoby z registra, nie z kópie v riadku spotreby (tá môže byť meno procesu).
  const names = group === "people" ? await personNames(companyCode, rows.map(r => r._id.k).filter((k): k is string => !!k && k !== NO_PERSON)) : new Map<string, string>()
  const buckets: OverviewBucket[] = rows
    .filter(r => typeof r._id.k === "string")
    .map(r => ({
      key: r._id.k as string,
      name: names.get(r._id.k as string) ?? r.name,
      background: group === "people" && r._id.k === NO_PERSON,
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
