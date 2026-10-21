/**
 * chunkCutter.ts — údaje pre rezač blokov (KNIZ-rezac-blokov, 15. 10. 2026).
 *
 * Skladá z `inspectChunking()` to, čo obrazovka a návrh AI potrebujú v reči
 * **blokov**: text, bloky, dnešné hranice a kolá návrhu k tomuto textu.
 *
 * Dnešné hranice sú:
 *   - prijaté ručné hranice, keď sú pre tento text (`chunkCut.ts`);
 *   - inak hranice uložených úsekov platného znenia nájdené v blokoch;
 *   - pri koncepte bez úsekov hranice dnešného rezu profilom.
 * Rez profilom môže začať uprostred bloku (dlhý odsek) — vtedy je hranica
 * na tom bloku a `approximate: true`; obrazovka to povie.
 */

import { inspectChunking, type ChunkingInspection } from "./chunkingInspect"
import { splitBlocks, boundariesFromChunks, type TextBlock } from "./chunkBlocks"
import { cutForIndex, manualCutFor, type CutMethod } from "./chunkCut"
import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION } from "./documents"
import { roundsFor, proposalText, type ChunkRound } from "./chunkProposal"
import { textFingerprint } from "./chunkIdentity"
import { estimateTokens } from "./chunker.mjs"

export interface CutterState {
  inspection: ChunkingInspection
  blocks: TextBlock[]
  /** Dnešné hranice v indexoch blokov. */
  current: number[]
  approximate: boolean
  /** Rez je prijatý ručne. */
  manual: boolean
  /** Spôsob dnešného rezu (ADR-035): ručné hranice, zo štruktúry, bez štruktúry. */
  method: CutMethod
  rounds: ChunkRound[]
  /** Druh dokumentu (kľúč číselníka `category`) — pre návrh AI. */
  category: string | null
  /** Krok „Skontrolovať členenie" je vybavený (prijaté alebo odložené pre tento text). */
  reviewed: boolean
  /** Text, ktorý sa reže: koncept nového znenia, alebo platné znenie. */
  text: string
  /** Reže sa koncept — uložené úseky platného znenia sa ho netýkajú. */
  draft: boolean
  /** Úseky „Dnes": uložené platného znenia, pri koncepte dnešný rez profilom. */
  todayChunks: { chunkIndex: number; heading: string; articleRef: string | null; text: string; tokens: number; complete?: boolean }[]
}

export async function cutterState(companyCode: string, documentId: string): Promise<CutterState | null> {
  const inspection = await inspectChunking(companyCode, documentId)
  if (!inspection) return null
  const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne(
    { companyCode, documentId },
    { projection: { category: 1, chunkRounds: 1, chunkingDeferredHash: 1, versions: 1, draftMarkdown: 1 } },
  ) as {
    category?: string | null; chunkRounds?: ChunkRound[]; chunkingDeferredHash?: string
    versions?: { isActive?: boolean; markdown?: string }[]; draftMarkdown?: string
  } | null

  const text = doc ? proposalText(doc) : inspection.text
  const effectiveText = String((doc?.versions ?? []).find(v => v.isActive)?.markdown ?? "").trim()
  const draft = Boolean(text) && text !== effectiveText
  const blocks = splitBlocks(text)
  const manualCut = manualCutFor(inspection.chunkCuts, text)
  let current: number[]
  let approximate = false
  // „Dnes": pri platnom znení uložené úseky (z tých asistent odpovedá),
  // pri koncepte to, ako by sa narezal pri zverejnení.
  const todayCut = cutForIndex(text, inspection.title, inspection.chunkCuts)
  const todayChunks = !draft && inspection.stored.length
    ? inspection.stored
    : todayCut.chunks.map(c => ({
        chunkIndex: c.chunkIndex, heading: c.heading, articleRef: c.articleRef, text: c.text,
        tokens: estimateTokens(c.text), complete: c.uplnaJednotka,
      }))
  if (manualCut) {
    current = manualCut.boundaries
  } else {
    const found = boundariesFromChunks(blocks, todayChunks.map(c => c.text))
    current = found.boundaries
    approximate = found.approximate
  }
  const hash = text ? textFingerprint(text) : ""
  return {
    inspection,
    blocks,
    current,
    approximate,
    manual: Boolean(manualCut),
    method: todayCut.method,
    rounds: roundsFor(doc?.chunkRounds, text),
    category: doc?.category ?? null,
    reviewed: Boolean(manualCut) || (Boolean(hash) && doc?.chunkingDeferredHash === hash),
    text,
    draft,
    todayChunks,
  }
}
