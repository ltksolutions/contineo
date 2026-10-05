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
  chunks: Pick<InspectedChunk, "articleRef" | "tokens" | "chunkType">[],
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
  const fragments = chunks.filter(c => c.articleRef && c.tokens < profile.minTokens / 2).length
  if (fragments) out.push({ code: "fragments", count: fragments })
  return out
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
export async function inspectChunking(companyCode: string, documentId: string): Promise<ChunkingInspection | null> {
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
    const forChunker = toChunkerProfile(params)
    const { chunky } = chunkText(text, { nazovDokumentu: doc.title ?? "", profil: forChunker })
    const id = chunkingFingerprint(chunky, { ...DEFAULT_PROFILE, ...forChunker })
    const withArticle = chunky.filter((c: { articleRef?: string | null }) => c.articleRef).length
    today = {
      count: chunky.length,
      withArticlePercent: chunky.length ? Math.round((withArticle / chunky.length) * 100) : 0,
      outdated: needsReindex(raw[0]?.chunkingId, id),
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
  }
}
