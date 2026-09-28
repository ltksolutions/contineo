/**
 * versionCompare.ts — čo sa zmenilo medzi dvomi zneniami (plán „znenia
 * v indexe", krok 7; `docs/TODO.md`). Čisté funkcie bez databázy.
 *
 * **Po článkoch, nie celé texty naraz.** `textDiff()` nad dvomi celými
 * zneniami pri väčšej novele prepadne do hrubého režimu (nad 400 × 400
 * riadkov: celý starý blok proti celému novému) a model by dostal stovky
 * riadkov bez toho, kde čo patrí. Obe znenia sa preto narežú tým istým
 * chunkerom a profilom, články sa spárujú podľa `articleRef` a porovná sa
 * každý zvlášť.
 *
 * **Obmedzenie:** prečíslovaný článok vyjde ako zrušený a pridaný — párovať
 * sa dá len podľa čísla (ADR-024).
 */

import { effectiveVersion } from "./documents"
import type { DocumentRecord, Version } from "./documents"
import { textDiff } from "./textFix"
import { normalizeMarkdown } from "./chunkIdentity"

export type PairResult =
  | { ok: true; from: Version; to: Version; direction: "since" | "upcoming" | "previous" }
  | { ok: false; reason: "single-version" }

const time = (d: Date | null | undefined) => (d instanceof Date ? d.getTime() : NaN)

/**
 * Ktoré dve znenia porovnať (schválil Ján):
 *   1. otázka nesie dátum („od roku 2020") → znenie platné vtedy ↔ dnešné,
 *   2. inak, keď má dokument znenie s budúcou účinnosťou (novela vopred)
 *      → dnešné ↔ budúce,
 *   3. inak predchádzajúce ↔ dnešné.
 */
export function comparePair(doc: DocumentRecord, now: Date, since?: Date): PairResult {
  const versions = (doc.versions ?? []).filter(v => v.effectiveFrom instanceof Date)
  const today = effectiveVersion(doc, now)

  if (since && today.ok) {
    const then = effectiveVersion(doc, since)
    if (then.ok && then.version.versionId !== today.version.versionId) {
      return { ok: true, from: then.version, to: today.version, direction: "since" }
    }
  }

  const upcoming = versions
    .filter(v => v.isActive && time(v.effectiveFrom) > now.getTime())
    .sort((a, b) => time(a.effectiveFrom) - time(b.effectiveFrom))[0]
  if (upcoming && today.ok) return { ok: true, from: today.version, to: upcoming, direction: "upcoming" }

  if (today.ok) {
    const start = time(today.version.effectiveFrom)
    const previous = versions
      .filter(v => v.versionId !== today.version.versionId && time(v.effectiveFrom) < start)
      .sort((a, b) => time(b.effectiveFrom) - time(a.effectiveFrom))[0]
    if (previous) return { ok: true, from: previous, to: today.version, direction: "previous" }
  }

  return { ok: false, reason: "single-version" }
}

/**
 * Text znenia. `DocumentRecord.markdown` nesie len **najnovšie** znenie —
 * staršiemu sa nepodstrčí, radšej `null` („starší text chýba") než
 * porovnanie znenia so sebou samým.
 */
export function versionText(doc: DocumentRecord, v: Version): string | null {
  if (v.markdown?.trim()) return v.markdown
  const newest = [...(doc.versions ?? [])].sort((a, b) => time(b.effectiveFrom) - time(a.effectiveFrom))[0]
  return newest?.versionId === v.versionId && doc.markdown?.trim() ? doc.markdown : null
}

/** Úsek z chunkera — len to, čo porovnanie potrebuje. */
export interface ArticlePiece {
  chunkIndex: number
  text: string
  heading: string
  articleRef: string | null
}

export interface ArticleChange {
  /** Označenie článku tak, ako ho má text („čl. 47"). */
  ref: string
  heading: string
  kind: "changed" | "added" | "removed"
  before?: string
  after?: string
  /** Počet pridaných a odobratých riadkov — pre prehľad. */
  added: number
  removed: number
}

const refKey = (ref: string) => ref.toLowerCase().replace(/\s+/g, " ").replace(/\s*\.\s*/g, ".").trim()

/** Úlomky toho istého článku sa spoja v poradí, v akom idú v texte. */
function byArticle(pieces: ArticlePiece[]): Map<string, { ref: string; heading: string; text: string; order: number }> {
  const out = new Map<string, { ref: string; heading: string; text: string; order: number }>()
  for (const p of [...pieces].sort((a, b) => a.chunkIndex - b.chunkIndex)) {
    const ref = p.articleRef?.trim() || p.heading?.trim() || "(úvod)"
    const key = refKey(ref)
    const prev = out.get(key)
    if (prev) prev.text += `\n${p.text}`
    else out.set(key, { ref, heading: p.heading ?? "", text: p.text, order: p.chunkIndex })
  }
  return out
}

/** Zmeny po článkoch: v poradí nového znenia, zrušené na konci v poradí starého. */
export function compareArticles(before: ArticlePiece[], after: ArticlePiece[]): ArticleChange[] {
  const a = byArticle(before)
  const b = byArticle(after)
  const changes: Array<ArticleChange & { order: number }> = []

  for (const [key, nu] of b) {
    const old = a.get(key)
    if (!old) {
      changes.push({ ref: nu.ref, heading: nu.heading, kind: "added", after: nu.text, added: nu.text.split("\n").length, removed: 0, order: nu.order })
      continue
    }
    if (normalizeMarkdown(old.text).trim() === normalizeMarkdown(nu.text).trim()) continue
    const d = textDiff(old.text, nu.text)
    changes.push({ ref: nu.ref, heading: nu.heading, kind: "changed", before: old.text, after: nu.text, added: d.added, removed: d.removed, order: nu.order })
  }
  const removed = [...a].filter(([key]) => !b.has(key)).sort((x, y) => x[1].order - y[1].order)
  for (const [, old] of removed) {
    changes.push({ ref: old.ref, heading: old.heading, kind: "removed", before: old.text, added: 0, removed: old.text.split("\n").length, order: Number.MAX_SAFE_INTEGER })
  }
  // Poradie slúžilo len na zoradenie; von ide zmena bez neho.
  return changes.map(c => {
    const out: ArticleChange & { order?: number } = { ...c }
    delete out.order
    return out
  })
}

/** Najviac toľkoto článkov ide modelu podrobne (schválil Ján); ostatné len menovite. */
export const DETAIL_LIMIT = 8

/** Podrobne najprv články, ktoré našlo hľadanie, potom zmeny v poradí dokumentu. */
export function selectDetail(changes: ArticleChange[], preferRefs: string[], limit = DETAIL_LIMIT): ArticleChange[] {
  const wanted = new Set(preferRefs.map(refKey))
  const first = changes.filter(c => wanted.has(refKey(c.ref)))
  const rest = changes.filter(c => !wanted.has(refKey(c.ref)))
  return [...first, ...rest].slice(0, limit)
}
