/**
 * conversionBlock.ts — rozdiel kontroly slov v celom bloku textu, ako
 * sledovanie zmien vo Worde (Ján 3. 11. 2026).
 *
 * Úryvok „…pár slov pred · rozdiel · pár slov za…" sa nedal posúdiť: pri
 * tabuľke nebolo vidno, že doplnený text je jej hlavička, pri presune, ku komu
 * údaj patrí. Človek rozhoduje z celku, preto sa ukáže celý odsek alebo
 * tabuľka z textu — nové slová zelené podčiarknuté, slová z PDF, ktoré v texte
 * nie sú, červené prečiarknuté na mieste, kde v PDF boli.
 *
 * Dlhá tabuľka sa skráti na hlavičku a pár riadkov okolo rozdielu — zoznam
 * 120 rozhodcov pri každej položke by z kontroly urobil čítanie predpisu.
 */

import type { ReviewItem } from "./conversionReview"

export type Mark = "new" | "gone"
export interface Seg { text: string; mark?: Mark }
export interface TextLine { heading: boolean; segs: Seg[] }
export type Block =
  | { kind: "table"; head: Seg[][]; rows: Seg[][][]; skippedBefore: number; skippedAfter: number }
  | { kind: "text"; lines: TextLine[] }

/** Riadkov tabuľky okolo rozdielu, keď je tabuľka dlhá. */
const ROWS_AROUND = 3
const LONG_TABLE = 9

// Značky vo vnútri riadku — znaky, ktoré v texte predpisu nie sú.
const NEW_OPEN = "\u0001"
const NEW_CLOSE = "\u0002"
const GONE_OPEN = "\u0003"
const GONE_CLOSE = "\u0004"
const SENTINELS = /[\u0001-\u0004]/

interface Word { key: string; start: number; end: number }

function wordsOf(line: string): Word[] {
  return [...line.matchAll(/[\p{L}\p{N}]+/gu)].map(m => ({ key: m[0].toLowerCase(), start: m.index!, end: m.index! + m[0].length }))
}

const keys = (text: string) => (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])

/** Kde v riadku stoja slová `text` za sebou (bez ohľadu na interpunkciu a `|`). */
function findWords(line: string, text: string, last = false): [number, number] | null {
  const want = keys(text)
  if (!want.length) return null
  const ws = wordsOf(line)
  let found: [number, number] | null = null
  for (let i = 0; i + want.length <= ws.length; i++) {
    if (want.every((k, j) => ws[i + j].key === k)) {
      found = [ws[i].start, ws[i + want.length - 1].end]
      if (!last) return found
    }
  }
  return found
}

const insert = (s: string, at: number, what: string) => s.slice(0, at) + what + s.slice(at)

function markNew(lines: string[], line: number, text: string): number | null {
  const l = lines[line - 1]
  const span = l === undefined ? null : findWords(l, text)
  if (!span) return null
  lines[line - 1] = insert(insert(l, span[1], NEW_CLOSE), span[0], NEW_OPEN)
  return span[0]
}

/**
 * Vynechaný text z PDF sa vloží prečiarknutý tam, kde v PDF bol: za slová,
 * ktoré mu predchádzali, inak pred slová, ktoré nasledovali, inak na začiatok.
 */
function markGone(lines: string[], line: number, text: string, before: string, after: string, at?: number) {
  const l = lines[line - 1]
  if (l === undefined || !text) return
  let pos = at
  if (pos === undefined) {
    const tail = keys(before).slice(-3).join(" ")
    const head = keys(after).slice(0, 3).join(" ")
    const b = tail ? findWords(l, tail, true) : null
    const a = !b && head ? findWords(l, head) : null
    pos = b ? b[1] : a ? a[0] : (l.match(/^\s*(?:#+\s+|\|\s*|[-*]\s+|\d+\.\s+)?/)?.[0].length ?? 0)
  }
  // Medzera len tam, kde by inak slová splynuli — nie pred bodkou či čiarkou.
  const lead = pos > 0 && !/\s/.test(l[pos - 1]) ? " " : ""
  const trail = /^[\p{L}\p{N}\u0001]/u.test(l.slice(pos)) ? " " : ""
  lines[line - 1] = insert(l, pos, `${lead}${GONE_OPEN}${text}${GONE_CLOSE}${trail}`)
}

/** Riadky textu so značkami rozdielu položky. */
export function annotate(markdown: string, item: ReviewItem): string[] {
  const lines = markdown.split("\n")
  if (item.kind === "moved" && item.toLine) {
    markNew(lines, item.toLine, item.mdText)
    markGone(lines, item.line, item.pdfText, item.before, item.after)
  } else if (item.kind === "changed" || item.kind === "moved") {
    const at = markNew(lines, item.line, item.mdText)
    markGone(lines, item.line, item.pdfText, item.before, item.after, at ?? undefined)
  } else if (item.kind === "missing") {
    markGone(lines, item.line, item.pdfText, item.before, item.after)
  } else {
    markNew(lines, item.line, item.mdText)
  }
  return lines
}

/** Text so značkami ako úseky; značka otvorená v predošlej bunke pokračuje. */
function segments(text: string, open: Mark | undefined): { segs: Seg[]; open: Mark | undefined } {
  const segs: Seg[] = []
  let mark = open
  let buf = ""
  const flush = () => { if (buf) segs.push(mark ? { text: buf, mark } : { text: buf }); buf = "" }
  for (const ch of text) {
    if (!SENTINELS.test(ch)) { buf += ch; continue }
    flush()
    mark = ch === NEW_OPEN ? "new" : ch === GONE_OPEN ? "gone" : undefined
  }
  flush()
  return { segs, open: mark }
}

/** Zápis Markdownu preč — človek číta text, nie hviezdičky. */
function clean(text: string): string {
  return text.replace(/\*\*|__/g, "").replace(/\\(.)/g, "$1").replace(/<br\s*\/?>/gi, " / ").replace(/\s+/g, " ")
}

/** Úseky bez prázdnych a bez medzier na okrajoch bunky či riadku. */
function tidy(segs: Seg[]): Seg[] {
  const out = segs.map(x => ({ ...x, text: clean(x.text) })).filter(x => x.text)
  if (out.length) {
    out[0] = { ...out[0], text: out[0].text.trimStart() }
    out[out.length - 1] = { ...out[out.length - 1], text: out[out.length - 1].text.trimEnd() }
  }
  return out.filter(x => x.text)
}

const isTable = (l: string | undefined) => (l ?? "").trim().startsWith("|")
const isSeparator = (l: string) => /^\s*\|[\s:|-]+\|?\s*$/.test(l)

function cellsOf(line: string): Seg[][] {
  const raw = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
  let open: Mark | undefined
  return raw.map(c => {
    const r = segments(c, open)
    open = r.open
    return tidy(r.segs)
  })
}

/** Rozsah bloku okolo riadku: celá tabuľka alebo súvislé riadky textu. */
function blockRange(lines: string[], line: number): [number, number] {
  const i = Math.min(Math.max(line - 1, 0), lines.length - 1)
  const table = isTable(lines[i])
  const same = (l: string | undefined) => l !== undefined && l.trim() !== "" && isTable(l) === table && !(!table && /^#{1,6}\s/.test(l))
  let from = i
  let to = i
  if (!table && /^#{1,6}\s/.test(lines[i] ?? "")) return [i, i]
  while (from > 0 && same(lines[from - 1])) from--
  while (to < lines.length - 1 && same(lines[to + 1])) to++
  return [from, to]
}

function buildBlock(lines: string[], [from, to]: [number, number], focus: number[]): Block {
  if (isTable(lines[from])) {
    const all = lines.slice(from, to + 1)
    const hasHead = all.length > 1 && isSeparator(all[1])
    const head = hasHead ? cellsOf(all[0]) : []
    const bodyStart = from + (hasHead ? 2 : 0)
    const body = lines.slice(bodyStart, to + 1).filter(l => !isSeparator(l))
    let lo = 0
    let hi = body.length - 1
    if (body.length > LONG_TABLE) {
      const idx = focus.map(f => f - 1 - bodyStart).filter(n => n >= 0 && n < body.length)
      // Rozdiel v hlavičke: stačí začiatok tabuľky.
      lo = idx.length ? Math.max(0, Math.min(...idx) - ROWS_AROUND) : 0
      hi = idx.length ? Math.min(body.length - 1, Math.max(...idx) + ROWS_AROUND) : ROWS_AROUND * 2 - 1
    }
    // Hlavička, ktorú rozdiel sám pridal, sa ukáže ako riadok so značkou — tak je vidno, čo je navyše.
    return { kind: "table", head, rows: body.slice(lo, hi + 1).map(cellsOf), skippedBefore: lo, skippedAfter: body.length - 1 - hi }
  }
  return {
    kind: "text",
    lines: lines.slice(from, to + 1).map(l => ({
      heading: /^#{1,6}\s/.test(l),
      segs: tidy(segments(l.replace(/^\s*#{1,6}\s+/, ""), undefined).segs),
    })),
  }
}

/**
 * Bloky na zobrazenie položky — jeden, alebo dva pri presune medzi blokmi
 * (najprv miesto podľa PDF, potom miesto v texte).
 */
export function itemBlocks(markdown: string, item: ReviewItem): Block[] {
  const lines = annotate(markdown, item)
  const places = [...new Set([item.line, item.toLine ?? item.line])]
  const ranges = places.map(l => blockRange(lines, l))
  const unique = ranges.filter((r, i) => ranges.findIndex(x => x[0] === r[0] && x[1] === r[1]) === i)
  return unique.map(r => buildBlock(lines, r, places))
}
