/**
 * chunkingInspect.ts — ako je dokument narezaný na úseky (editor členenia, krok A;
 * ADR-027, rozhodnutie Jána 5. 10. 2026).
 *
 * Ukazuje **uložené úseky** platného znenia — presne to, z čoho asistent
 * odpovedá — a vedľa toho, či by dnešný kód s profilom dokumentu narezal to
 * isté. Nič nemení: preindexovanie je samostatný, vedomý krok v detaile
 * dokumentu (D58).
 *
 * Návrh profilu dáva analyzátor (`chunkingAnalysis.ts`), nie model — zadarmo
 * a opakovateľne. Analýza modelom je krok C.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { CHUNKS_COLLECTION, chunkingTenant } from "./libraryWrite"
import { chunkText, DEFAULT_PROFILE, estimateTokens } from "./chunker.mjs"
import { chunkingFor, toChunkerProfile, DEFAULT_PROFILE_KEY, DEFAULT_CHUNKING, type ChunkingProfile } from "./chunkingProfile"
import { chunkingFingerprint, needsReindex } from "./chunkIdentity"
import { analyseChunking, type ChunkingAnalysis } from "./chunkingAnalysis"

/** Úsek tak, ako sa zobrazí. Text celý — obrazovka ho skryje do rozbaľovača. */
export interface InspectedChunk {
  chunkIndex: number
  heading: string
  articleRef: string | null
  chunkType: string
  text: string
  tokens: number
  /**
   * Celý článok v jednom úseku (`true`) alebo kúsok rozdeleného (`false`).
   * Uložené úseky to v databáze nemajú — doplní sa z dnešného rezu, keď
   * s uloženým sedí; inak `undefined` a úlomky sa nepočítajú.
   */
  complete?: boolean
}

/** Upozornenie s kódom — vetu skladá slovník, nie táto knižnica. */
export type ChunkWarning =
  | { code: "oneBlock" }
  | { code: "fewArticles"; percent: number }
  | { code: "oversized"; count: number; limit: number }
  | { code: "fragments"; count: number }

export interface ChunkStats {
  count: number
  withArticle: number
  /** Podiel úsekov s rozpoznaným článkom, 0–100, zaokrúhlený. */
  withArticlePercent: number
  tokensMin: number
  tokensMax: number
  tokensAvg: number
}

/**
 * Pod týmto podielom úsekov s článkom je dokument prakticky nerozobraný
 * (krok A2 plánu D79). Normy SFZ majú 92–99 %, skúšobný záznam 0 %.
 */
export const FEW_ARTICLES_PERCENT = 20

/** Úsek nad `max × 1,5` je pre vyhľadávanie priveľký — model dostane príliš veľa naraz. */
export const OVERSIZE_FACTOR = 1.5

/** Súhrn rezu. Čistá funkcia. */
export function chunkStats(chunks: Pick<InspectedChunk, "articleRef" | "tokens">[]): ChunkStats {
  const tokens = chunks.map(c => c.tokens)
  const withArticle = chunks.filter(c => c.articleRef).length
  return {
    count: chunks.length,
    withArticle,
    withArticlePercent: chunks.length ? Math.round((withArticle / chunks.length) * 100) : 0,
    tokensMin: tokens.length ? Math.min(...tokens) : 0,
    tokensMax: tokens.length ? Math.max(...tokens) : 0,
    tokensAvg: tokens.length ? Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length) : 0,
  }
}

/**
 * Čo na reze nesedí. Čistá funkcia — rovnaké pravidlá pre obrazovku aj skript.
 *
 * - **oneBlock**: celý text v jednom úseku bez článku („Úvodné ustanovenia") —
 *   chunker nenašiel ani jeden článok; typicky manuál alebo zmluva.
 * - **fewArticles**: článok má menej než 20 % úsekov.
 * - **oversized**: úseky nad 1,5-násobkom cieľovej veľkosti profilu.
 * - **fragments**: krátke úlomky rozdeleného článku (pod polovicou minima).
 */
export function chunkWarnings(
  chunks: Pick<InspectedChunk, "articleRef" | "tokens" | "chunkType" | "complete">[],
  profile: Pick<ChunkingProfile, "minTokens" | "maxTokens">,
): ChunkWarning[] {
  const out: ChunkWarning[] = []
  if (!chunks.length) return out
  const stats = chunkStats(chunks)
  if (stats.withArticle === 0 && chunks.every(c => c.chunkType === "preambula")) {
    out.push({ code: "oneBlock" })
  } else if (stats.withArticlePercent < FEW_ARTICLES_PERCENT) {
    out.push({ code: "fewArticles", percent: stats.withArticlePercent })
  }
  const limit = Math.round(profile.maxTokens * OVERSIZE_FACTOR)
  const oversized = chunks.filter(c => c.tokens > limit).length
  if (oversized) out.push({ code: "oversized", count: oversized, limit })
  // Len **kúsky rozdeleného** článku. Krátky celý článok (čl. 15 Finančnej
  // smernice, 129 tokenov) je prirodzená jednotka, nie problém (5. 10. 2026).
  const fragments = chunks.filter(c => c.articleRef && c.complete === false && c.tokens < profile.minTokens / 2).length
  if (fragments) out.push({ code: "fragments", count: fragments })
  return out
}

type RawChunk = {
  chunkIndex: number; heading?: string; articleRef?: string | null; typ?: string; text: string; uplnaJednotka?: boolean
}

/** Rez textu danými parametrami — to isté, čo by urobilo preindexovanie. */
export function cutWith(
  text: string,
  title: string,
  params: Partial<ChunkingProfile> | undefined,
): { chunks: InspectedChunk[]; fingerprint: string } {
  const forChunker = toChunkerProfile(params)
  const { chunky } = chunkText(text, { nazovDokumentu: title, profil: forChunker }) as { chunky: RawChunk[] }
  return {
    chunks: chunky.map(c => ({
      chunkIndex: c.chunkIndex,
      heading: c.heading ?? "",
      articleRef: c.articleRef ?? null,
      chunkType: c.typ ?? "clanok",
      text: c.text,
      tokens: estimateTokens(c.text),
      complete: Boolean(c.uplnaJednotka),
    })),
    fingerprint: chunkingFingerprint(chunky as never, { ...DEFAULT_PROFILE, ...forChunker }),
  }
}

export interface ChunkingTrial {
  values: ChunkingProfile
  chunks: InspectedChunk[]
  stats: ChunkStats
  warnings: ChunkWarning[]
  /** Skúšobné hodnoty sú zhodné s niektorým pomenovaným profilom. */
  matchesProfile: string | null
}

export interface ChunkingInspection {
  documentId: string
  title: string
  version: { versionId: string; label: string } | null
  /** Kľúč a menovka profilu, ktorým sa dokument reže. */
  profile: { key: string; label: string; values: ChunkingProfile }
  stored: InspectedChunk[]
  stats: ChunkStats
  warnings: ChunkWarning[]
  /** Dnešný rez tým istým profilom — koľko úsekov a či sa líši od uloženého. */
  today: { count: number; withArticlePercent: number; outdated: boolean } | null
  analysis: ChunkingAnalysis | null
  /** Pomenované profily organizácie — na výber „Použiť profil". */
  profiles: { key: string; label: string; values: ChunkingProfile }[]
  /** Skúšobný rez, keď prišli skúšobné parametre (krok B). */
  trial: ChunkingTrial | null
}

/** Rovnaké parametre rezu? (kľúč a menovka nehrajú rolu) */
function sameValues(a: ChunkingProfile, b: ChunkingProfile): boolean {
  return a.articleWord === b.articleWord && a.annexWord === b.annexWord &&
    a.headerRepeats === b.headerRepeats && a.minTokens === b.minTokens && a.maxTokens === b.maxTokens
}

interface VersionRow {
  versionId: string
  label?: string
  isActive?: boolean
  markdown?: string
}

/**
 * Rez platného znenia dokumentu. `null`, keď dokument v organizácii nie je (D32).
 *
 * Platné znenie = `isActive` — to, z ktorého odpovedá asistent. Dokument bez
 * neho (koncept) nemá uložené úseky; ukáže sa len návrh analyzátora nad
 * konceptom, aby sa členenie dalo posúdiť ešte pred zverejnením.
 */
export async function inspectChunking(
  companyCode: string,
  documentId: string,
  trialValues?: ChunkingProfile | null,
): Promise<ChunkingInspection | null> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { documentId: 1, title: 1, versions: 1, chunkingProfile: 1, draftMarkdown: 1 } },
  ) as { documentId: string; title?: string; versions?: VersionRow[]; chunkingProfile?: string; draftMarkdown?: string } | null
  if (!doc) return null

  const tenant = await chunkingTenant(companyCode)
  const key = doc.chunkingProfile ?? DEFAULT_PROFILE_KEY
  const params = chunkingFor(tenant, doc.chunkingProfile)
  // Na obrazovku úplné hodnoty; do chunkera ide `params` tak, ako je (odtlačok).
  const values: ChunkingProfile = { ...DEFAULT_CHUNKING, ...params }
  const label = (tenant?.chunkingProfiles ?? []).find(p => p.key === key)?.label ?? key

  const effective = (doc.versions ?? []).find(v => v.isActive) ?? null
  const text = String(effective?.markdown ?? doc.draftMarkdown ?? "").trim()

  const raw = effective
    ? await (await getCollection(CHUNKS_COLLECTION))
        .find(
          { companyCode, documentId, versionId: effective.versionId, superseded: { $ne: true } },
          { projection: { chunkIndex: 1, heading: 1, articleRef: 1, chunkType: 1, text: 1, chunkingId: 1 } },
        )
        .sort({ chunkIndex: 1 })
        .toArray() as unknown as { chunkIndex: number; heading?: string; articleRef?: string | null; chunkType?: string; text?: string; chunkingId?: string }[]
    : []

  const stored: InspectedChunk[] = raw.map(c => ({
    chunkIndex: c.chunkIndex,
    heading: c.heading ?? "",
    articleRef: c.articleRef ?? null,
    chunkType: c.chunkType ?? "clanok",
    text: c.text ?? "",
    tokens: estimateTokens(c.text ?? ""),
  }))

  let today: ChunkingInspection["today"] = null
  if (effective && text) {
    const cut = cutWith(text, doc.title ?? "", params)
    const outdated = needsReindex(raw[0]?.chunkingId, cut.fingerprint)
    today = { count: cut.chunks.length, withArticlePercent: chunkStats(cut.chunks).withArticlePercent, outdated }
    // Uložené úseky nevedia, či sú celý článok — keď sedia s dnešným rezom,
    // vezme sa to z neho (rovnaké poradie, rovnaký text).
    if (!outdated) for (const c of stored) c.complete = cut.chunks[c.chunkIndex]?.complete
  }

  const profiles = (tenant?.chunkingProfiles ?? []).map(p => {
    const { key: k, label: l, ...rest } = p
    return { key: k, label: l || k, values: { ...DEFAULT_CHUNKING, ...rest } as ChunkingProfile }
  })

  let trial: ChunkingTrial | null = null
  if (trialValues && text) {
    const cut = cutWith(text, doc.title ?? "", trialValues)
    trial = {
      values: trialValues,
      chunks: cut.chunks,
      stats: chunkStats(cut.chunks),
      warnings: chunkWarnings(cut.chunks, trialValues),
      matchesProfile: profiles.find(p => sameValues(p.values, trialValues))?.key ?? null,
    }
  }

  return {
    documentId,
    title: doc.title ?? documentId,
    version: effective ? { versionId: effective.versionId, label: effective.label ?? "" } : null,
    profile: { key, label, values },
    stored,
    stats: chunkStats(stored),
    warnings: chunkWarnings(stored, values),
    today,
    analysis: text ? analyseChunking(text) : null,
    profiles,
    trial,
  }
}
