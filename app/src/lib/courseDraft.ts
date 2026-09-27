/**
 * Úpravy konceptu kurzu (rám MANAGE-COURSE) — čisté funkcie nad poľom
 * častí. Obrazovka ich zavolá, výsledok zapíše `saveDraft` (len koncept;
 * zverejnená verzia sa nemení, D118).
 *
 * Každá funkcia vracia **nové** pole; pôvodné sa nemení. Chyby sú kódy
 * (`AppError`), veta sa skladá na obrazovke.
 */

import { AppError } from "./appError"
import { PART_KEY, type ContentBlock, type Part } from "./courses"
import { slugifyTrackKey } from "./slug"

export class DraftError extends AppError {}

/** Kľúč časti z názvu, jedinečný v kurze („uvod", „uvod-2"). */
export function partKeyFor(title: string, parts: Pick<Part, "key">[]): string {
  const base = slugifyTrackKey(title).slice(0, 50) || "cast"
  const used = new Set(parts.map(p => p.key))
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}

export function addPart(parts: Part[], title: string, required: boolean): Part[] {
  const name = title.trim()
  if (!name) throw new DraftError("learning.partTitleRequired", "Názov časti je povinný.")
  const key = partKeyFor(name, parts)
  if (!PART_KEY.test(key)) throw new DraftError("learning.partTitleRequired", "Názov časti je povinný.")
  return [...parts, { key, title: name, required, blocks: [], tests: [] }]
}

function indexOf(parts: Part[], partKey: string): number {
  const i = parts.findIndex(p => p.key === partKey)
  if (i < 0) throw new DraftError("learning.partNotFound", "Taká časť v kurze nie je.")
  return i
}

/** Posun o jedno miesto (šípky bez JS, ako `TreeWithOrder`). Na okraji nič. */
function move<T>(list: T[], i: number, dir: "up" | "down"): T[] {
  const j = dir === "up" ? i - 1 : i + 1
  if (j < 0 || j >= list.length) return list
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export function movePart(parts: Part[], partKey: string, dir: "up" | "down"): Part[] {
  return move(parts, indexOf(parts, partKey), dir)
}

export function updatePart(
  parts: Part[],
  partKey: string,
  change: { title?: string; required?: boolean; summary?: string; estimatedMinutes?: number | null },
): Part[] {
  const i = indexOf(parts, partKey)
  const p = { ...parts[i] }
  if (change.title !== undefined) {
    if (!change.title.trim()) throw new DraftError("learning.partTitleRequired", "Názov časti je povinný.")
    p.title = change.title.trim()
  }
  if (change.required !== undefined) p.required = change.required
  if (change.summary !== undefined) p.summary = change.summary.trim() || undefined
  if (change.estimatedMinutes !== undefined) {
    p.estimatedMinutes = change.estimatedMinutes && change.estimatedMinutes > 0 ? Math.round(change.estimatedMinutes) : undefined
  }
  return parts.map((x, k) => (k === i ? p : x))
}

export function removePart(parts: Part[], partKey: string): Part[] {
  indexOf(parts, partKey)
  return parts.filter(p => p.key !== partKey)
}

function withBlocks(parts: Part[], partKey: string, change: (blocks: ContentBlock[]) => ContentBlock[]): Part[] {
  const i = indexOf(parts, partKey)
  return parts.map((p, k) => (k === i ? { ...p, blocks: change(p.blocks) } : p))
}

/**
 * Pridá blok. Pravidlá, ktoré platia už pri koncepte (nie až pri
 * zverejnení): obrázok má popis, externé video nemôže mať povinné
 * dopozeranie (D122 — zaručiť sa nedá).
 */
export function addBlock(parts: Part[], partKey: string, block: ContentBlock): Part[] {
  if (block.type === "image" && !block.alt.trim()) throw new DraftError("learning.altRequired", "Chýba popis obrázka.")
  if (block.type === "gallery" && (block.items.length === 0 || block.items.some(x => !x.alt.trim()))) {
    throw new DraftError("learning.altRequired", "Chýba popis obrázka.")
  }
  if (block.type === "text" && !block.markdown.trim()) throw new DraftError("learning.textRequired", "Text bloku je prázdny.")
  const clean: ContentBlock = block.type === "video" && block.source.kind === "external" ? { ...block, mustWatch: false } : block
  return withBlocks(parts, partKey, blocks => [...blocks, clean])
}

export function moveBlock(parts: Part[], partKey: string, blockId: string, dir: "up" | "down"): Part[] {
  return withBlocks(parts, partKey, blocks => {
    const i = blocks.findIndex(b => b.id === blockId)
    if (i < 0) throw new DraftError("learning.blockNotFound", "Taký blok v kurze nie je.")
    return move(blocks, i, dir)
  })
}

export function removeBlock(parts: Part[], partKey: string, blockId: string): Part[] {
  return withBlocks(parts, partKey, blocks => {
    if (!blocks.some(b => b.id === blockId)) throw new DraftError("learning.blockNotFound", "Taký blok v kurze nie je.")
    return blocks.filter(b => b.id !== blockId)
  })
}

/** Úprava bloku na mieste — text, popisy, povinné dopozeranie. */
export function updateBlock(parts: Part[], partKey: string, blockId: string, change: (b: ContentBlock) => ContentBlock): Part[] {
  return withBlocks(parts, partKey, blocks => {
    const i = blocks.findIndex(b => b.id === blockId)
    if (i < 0) throw new DraftError("learning.blockNotFound", "Taký blok v kurze nie je.")
    const next = change(blocks[i])
    if (next.type === "video" && next.source.kind === "external" && next.mustWatch) return blocks.map((b, k) => (k === i ? { ...next, mustWatch: false } : b))
    return blocks.map((b, k) => (k === i ? next : b))
  })
}
