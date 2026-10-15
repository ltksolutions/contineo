/**
 * chunkingInspect.ts — ako je dokument narezaný na úseky (stránka Členenie).
 *
 * Ukazuje **uložené úseky** platného znenia — presne to, z čoho asistent
 * odpovedá — a vedľa toho, či by dnešný rez (`cutForIndex()`: ručné hranice,
 * štruktúra Markdownu, chunker pre text bez nadpisov) narezal to isté. Nič
 * nemení: preindexovanie je samostatný, vedomý krok v detaile dokumentu.
 *
 * Profily členenia, skúšobný rez a návrh profilu zanikli (ADR-035 D224).
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { CHUNKS_COLLECTION } from "./libraryWrite"
import { estimateTokens } from "./chunker.mjs"
import { chunkingFingerprint, needsReindex } from "./chunkIdentity"
import { cutForIndex, type ChunkCut, type CutMethod } from "./chunkCut"
import { CUT_MIN, CUT_MAX } from "./chunkHeadings"

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
  profile: { minTokens: number; maxTokens: number } = { minTokens: CUT_MIN, maxTokens: CUT_MAX },
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

export interface ChunkingInspection {
  documentId: string
  title: string
  version: { versionId: string; label: string } | null
  stored: InspectedChunk[]
  stats: ChunkStats
  warnings: ChunkWarning[]
  /** Dnešný rez — koľko úsekov, spôsob a či sa líši od uloženého. */
  today: { count: number; withArticlePercent: number; outdated: boolean; method: CutMethod } | null
  /** Text, z ktorého sa reže (platné znenie, inak koncept) — rezač blokov. */
  text: string
  /** Prijaté ručné hranice pri dokumente (KNIZ-rezac-blokov). */
  chunkCuts: ChunkCut[]
}

interface VersionRow {
  versionId: string
  label?: string
  isActive?: boolean
  markdown?: string
}

/** Úseky dnešného rezu v tvare obrazovky. */
export function inspectedCut(text: string, title: string, cuts?: ChunkCut[] | null) {
  const index = cutForIndex(text, title, cuts)
  return {
    method: index.method,
    chunks: index.chunks.map(c => ({
      chunkIndex: c.chunkIndex, heading: c.heading ?? "", articleRef: c.articleRef ?? null, chunkType: c.typ ?? "clanok",
      text: c.text, tokens: estimateTokens(c.text), complete: Boolean(c.uplnaJednotka),
    })) as InspectedChunk[],
    fingerprint: chunkingFingerprint(index.chunks, index.fingerprintProfile),
  }
}

/**
 * Rez platného znenia dokumentu. `null`, keď dokument v organizácii nie je (D32).
 *
 * Platné znenie = `isActive` — to, z ktorého odpovedá asistent. Dokument bez
 * neho (koncept) nemá uložené úseky.
 */
export async function inspectChunking(companyCode: string, documentId: string): Promise<ChunkingInspection | null> {
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const doc = await col.findOne(
    { companyCode, documentId },
    { projection: { documentId: 1, title: 1, versions: 1, draftMarkdown: 1, chunkCuts: 1 } },
  ) as { documentId: string; title?: string; versions?: VersionRow[]; draftMarkdown?: string; chunkCuts?: ChunkCut[] } | null
  if (!doc) return null

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
    const cut = inspectedCut(text, doc.title ?? "", doc.chunkCuts)
    const outdated = needsReindex(raw[0]?.chunkingId, cut.fingerprint)
    today = { count: cut.chunks.length, withArticlePercent: chunkStats(cut.chunks).withArticlePercent, outdated, method: cut.method }
    // Uložené úseky nevedia, či sú celý článok — keď sedia s dnešným rezom,
    // vezme sa to z neho (rovnaké poradie, rovnaký text).
    if (!outdated) for (const c of stored) c.complete = cut.chunks[c.chunkIndex]?.complete
  }

  return {
    documentId,
    title: doc.title ?? documentId,
    version: effective ? { versionId: effective.versionId, label: effective.label ?? "" } : null,
    stored,
    stats: chunkStats(stored),
    warnings: chunkWarnings(stored),
    today,
    text,
    chunkCuts: doc.chunkCuts ?? [],
  }
}
