/**
 * aiUsage.ts — spotreba umelej inteligencie (ADR-026, D158, D159; 5. 10. 2026).
 *
 * Každé volanie modelu sa zapíše jedným riadkom: kto, kedy, na čo, ktorým
 * modelom, koľko tokenov, odhad sumy a ktorý kľúč. Z toho je prehľad
 * Organizácia → Umelá inteligencia → Spotreba a export CSV a Excel.
 *
 * **Znenie otázky sa neukladá** (D158). Otázka môže niesť osobné údaje —
 * meno hráča v disciplinárnej veci — a výkaz nákladov by sa tak stal ďalším
 * registrom osobných údajov. Na kontrolu nákladov stačí účel, osoba a čas.
 *
 * **25 mesiacov** (D159), potom zmaže TTL index. Nie je to dôkazný záznam
 * (D24), ale prevádzkový výkaz.
 *
 * Zápis **nikdy nezhodí volanie**: keď sa nepodarí, odpoveď človek dostane
 * a chyba ide do logu. Chýbajúci riadok vo výkaze je menšia škoda než
 * neodpovedaná otázka.
 */

import type { ObjectId } from "mongodb"
import { getCollection } from "./mongodb"
import { cost, EMPTY_TOKENS, type TokenCounts } from "./pricing"
import type { KeySource } from "./aiSettings"

export const AI_USAGE_COLLECTION = "ai_usage"

/** 25 mesiacov (D159) — celý minulý rok na porovnanie a rezerva na uzávierku. */
export const AI_USAGE_RETENTION_DAYS = 761

/**
 * Na čo sa model volal. Kľúče sú dáta v `ai_usage` — nepremenúvať.
 * Popis „na čo a prečo" k nim dáva slovník (`org.aiUsage.purposes`).
 */
export const AI_USAGE_PURPOSES = ["answer", "query-rewrite", "query-classify", "pdf-rewrite", "markdown-clean", "chunking-analysis"] as const
export type AiUsagePurpose = (typeof AI_USAGE_PURPOSES)[number]

export function isAiUsagePurpose(value: string | undefined): value is AiUsagePurpose {
  return (AI_USAGE_PURPOSES as readonly string[]).includes(value ?? "")
}

/** Kto volanie spustil — kópia v čase volania, nie odkaz (meno sa môže zmeniť). */
export interface UsageActor {
  companyCode: string
  personId: string | null
  personName: string
  email: string
}

export interface AiUsageRecord extends UsageActor {
  _id?: ObjectId
  at: Date
  purpose: AiUsagePurpose
  /** K čomu sa volanie viazalo, keď to nie sú osobné údaje — názov dokumentu pri prepise. */
  subject?: string
  provider: "anthropic" | "bedrock" | "openai"
  model: string
  keySource: KeySource | null
  tokens: TokenCounts
  usd: number
  pricelistVersion: string
  /** Model nie je v cenníku — suma 0 sa nedá brať vážne. */
  unknownModel?: boolean
  /** Volanie zlyhalo (prerušenie, chyba poskytovateľa). Tokeny môžu chýbať. */
  failed?: boolean
}

let indexReady: Promise<unknown> | null = null
async function collection() {
  const col = await getCollection<AiUsageRecord>(AI_USAGE_COLLECTION)
  indexReady ??= Promise.all([
    // Výpis za obdobie jednej organizácie, najnovšie hore.
    col.createIndex({ companyCode: 1, at: -1 }, { name: "ai_usage_company_at" }),
    col.createIndex({ at: 1 }, { name: "ai_usage_ttl", expireAfterSeconds: AI_USAGE_RETENTION_DAYS * 24 * 3600 }),
  ]).catch(e => { indexReady = null; throw e })
  await indexReady
  return col
}

/** Riadok spotreby z tokenov — suma sa počíta tu, v deň volania (`pricing.ts`). */
export function usageRecord(input: {
  actor: UsageActor
  purpose: AiUsagePurpose
  subject?: string
  provider: AiUsageRecord["provider"]
  model: string
  keySource: KeySource | null
  tokens?: Partial<TokenCounts>
  failed?: boolean
  at?: Date
}): AiUsageRecord {
  const at = input.at ?? new Date()
  const tokens = { ...EMPTY_TOKENS, ...input.tokens }
  const c = cost(input.model, tokens, at)
  return {
    ...input.actor,
    at,
    purpose: input.purpose,
    ...(input.subject ? { subject: input.subject } : {}),
    provider: input.provider,
    model: input.model,
    keySource: input.keySource,
    tokens,
    usd: c.usd,
    pricelistVersion: c.pricelistVersion,
    ...(c.unknownModel ? { unknownModel: true } : {}),
    ...(input.failed ? { failed: true } : {}),
  }
}

/** Zapíše riadok. Nikdy nevyhodí — viď hlavička. */
export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
  try {
    await (await collection()).insertOne(record)
  } catch (e) {
    console.error("[spotreba AI] riadok sa nepodarilo zapísať:", e)
  }
}

// ── čítanie ──────────────────────────────────────────────────────────────────

export interface UsageFilter {
  /** Prvý deň obdobia vrátane (UTC polnoc). */
  from: Date
  /** Deň **za** posledným dňom obdobia (exkluzívne). */
  to: Date
  personId?: string
  purpose?: AiUsagePurpose
}

/**
 * Obdobie z adresy: `from` a `to` ako `YYYY-MM-DD`, `to` vrátane. Chýbajúce
 * alebo nečitateľné = aktuálny mesiac. Prehodené dátumy sa vymenia — človek
 * chcel obdobie medzi nimi, nie prázdny výpis.
 */
export function usagePeriod(
  fromText: string | undefined,
  toText: string | undefined,
  now: Date = new Date(),
): { from: Date; to: Date; fromText: string; toText: string } {
  const day = (t: string | undefined) => {
    if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
    const d = new Date(`${t}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  let from = day(fromText) ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  let last = day(toText) ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  if (last < from) [from, last] = [last, from]
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from, to: new Date(last.getTime() + 24 * 3600 * 1000), fromText: iso(from), toText: iso(last) }
}

function query(companyCode: string, f: UsageFilter) {
  return {
    companyCode,
    at: { $gte: f.from, $lt: f.to },
    ...(f.personId ? { personId: f.personId } : {}),
    ...(f.purpose ? { purpose: f.purpose } : {}),
  }
}

/** Riadky obdobia, najnovšie hore. `limit` len pre obrazovku; export berie všetko. */
export async function usageRows(companyCode: string, f: UsageFilter, limit?: number): Promise<AiUsageRecord[]> {
  const cursor = (await collection()).find(query(companyCode, f)).sort({ at: -1 })
  return (limit ? cursor.limit(limit) : cursor).toArray()
}

export interface UsageTotals {
  calls: number
  tokens: TokenCounts
  usd: number
}

/** Súčty za celé obdobie — aj keď obrazovka ukazuje len prvých N riadkov. */
export async function usageTotals(companyCode: string, f: UsageFilter): Promise<UsageTotals> {
  const [row] = await (await collection()).aggregate<UsageTotals & { _id: null; input: number; output: number; cacheWrite: number; cacheRead: number }>([
    { $match: query(companyCode, f) },
    {
      $group: {
        _id: null,
        calls: { $sum: 1 },
        usd: { $sum: "$usd" },
        input: { $sum: "$tokens.input" },
        output: { $sum: "$tokens.output" },
        cacheWrite: { $sum: "$tokens.cacheWrite" },
        cacheRead: { $sum: "$tokens.cacheRead" },
      },
    },
  ]).toArray()
  if (!row) return { calls: 0, tokens: { ...EMPTY_TOKENS }, usd: 0 }
  return {
    calls: row.calls,
    usd: row.usd,
    tokens: { input: row.input, output: row.output, cacheWrite: row.cacheWrite, cacheRead: row.cacheRead },
  }
}

/** Ľudia, ktorí v organizácii AI niekedy volali — do filtra osoby. */
export async function usagePeople(companyCode: string): Promise<{ personId: string; personName: string }[]> {
  const rows = await (await collection()).aggregate<{ _id: string; personName: string }>([
    { $match: { companyCode, personId: { $ne: null } } },
    { $sort: { at: -1 } },
    { $group: { _id: "$personId", personName: { $first: "$personName" } } },
  ]).toArray()
  return rows
    .map(r => ({ personId: r._id, personName: r.personName }))
    .sort((a, b) => a.personName.localeCompare(b.personName, "sk"))
}

/**
 * Filter z adresy — **jeden** pre obrazovku aj export, aby výkaz sedel
 * s tým, čo človek videl. Neznámy účel sa ignoruje.
 */
export function usageFilterFromQuery(
  q: { from?: string; to?: string; person?: string; purpose?: string },
  now: Date = new Date(),
): UsageFilter & { fromText: string; toText: string } {
  const period = usagePeriod(q.from, q.to, now)
  return {
    ...period,
    ...(q.person ? { personId: q.person } : {}),
    ...(isAiUsagePurpose(q.purpose) ? { purpose: q.purpose } : {}),
  }
}
