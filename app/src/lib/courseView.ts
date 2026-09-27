/**
 * Odvodené údaje pre prehľad kurzu (rám COURSE) — čisté funkcie nad verziou
 * kurzu a udalosťami postupu. Nič sa neukladá (D119).
 */

import type { Part } from "./courses"
import { watchedShare, type PartProgress, type ProgressFacts } from "./learningProgress"

export type SummaryType = "image" | "gallery" | "document" | "video" | "videoExternal"

export interface PartSummary {
  blocks: number
  /** Druhy obsahu okrem textu, bez opakovania, v poradí výskytu. */
  types: SummaryType[]
  /** Súčet minút videí s povinným dopozeraním; `null`, keď žiadne nie je. */
  mustWatchMinutes: number | null
}

/** „4 bloky · povinné video 12 minút" / „3 bloky · galéria, video externé". */
export function partSummary(part: Part): PartSummary {
  const types: SummaryType[] = []
  let mustWatchSec = 0
  let hasMustWatch = false
  for (const b of part.blocks) {
    if (b.type === "text") continue
    if (b.type === "video" && b.mustWatch) {
      hasMustWatch = true
      mustWatchSec += b.durationSec ?? 0
      continue
    }
    const t: SummaryType = b.type === "video" ? (b.source.kind === "external" ? "videoExternal" : "video") : b.type
    if (!types.includes(t)) types.push(t)
  }
  return {
    blocks: part.blocks.length,
    types,
    mustWatchMinutes: hasMustWatch ? Math.max(1, Math.round(mustWatchSec / 60)) : null,
  }
}

/**
 * Najnižšie percento pozretia povinného videa, ktoré ešte nemá hranicu —
 * „rozpracovaná — video pozreté 62 %". `null`, keď nie je čo ukázať.
 */
export function mustWatchPercent(part: Part, facts: ProgressFacts): number | null {
  let lowest: number | null = null
  for (const b of part.blocks) {
    if (b.type !== "video" || !b.mustWatch) continue
    const w = facts.watches.find(x => x.partKey === part.key && x.blockId === b.id)
    if (!w) continue
    const pct = Math.floor(watchedShare(w.watchedRanges, b.durationSec ?? w.durationSec) * 100)
    if (pct > 0 && pct < 100 && (lowest === null || pct < lowest)) lowest = pct
  }
  return lowest
}

/**
 * Po ktorej časti sa zamknutá časť sprístupní: číslo (od 1) prvej nehotovej
 * **povinnej** časti pred ňou. `null`, keď časť zamknutá nie je.
 */
export function unlocksAfter(parts: PartProgress[], index: number): number | null {
  if (parts[index]?.state !== "locked") return null
  const blocker = parts.slice(0, index).findIndex(p => p.part.required && p.state !== "done")
  return blocker < 0 ? null : blocker + 1
}

/**
 * Adresa na vloženie externého videa (`<iframe>`). YouTube a Vimeo z bežnej
 * adresy na prehrávač; iné len `https`. `null` = adresa sa vložiť nedá.
 */
export function embedUrl(provider: "youtube" | "vimeo" | "stream", url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (u.protocol !== "https:") return null
  if (provider === "youtube") {
    const id = u.hostname.endsWith("youtu.be") ? u.pathname.slice(1)
      : u.pathname.startsWith("/embed/") ? u.pathname.slice(7)
      : u.searchParams.get("v")
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  }
  if (provider === "vimeo") {
    const id = u.pathname.split("/").filter(Boolean).pop()
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
  }
  return u.toString()
}
