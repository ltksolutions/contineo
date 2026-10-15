/**
 * chunkBlocks.ts — text znenia ako bloky a rez podľa ručných hraníc
 * (KNIZ-rezac-blokov, rozhodnutie Jána Q3 A, 15. 10. 2026).
 *
 * **Hranica je index bloku, nie pozícia znaku.** Blok je nadpis, odsek,
 * položka zoznamu alebo celá tabuľka — to, medzi čím sa dá rezať bez toho,
 * aby sa rozdelila veta alebo riadok tabuľky. Index bloku prežije opravu
 * preklepu (text bloku sa zmení, poradie nie); znakový posun by ju neprežil.
 *
 * Ručné hranice platia **len pre text, z ktorého vznikli** (`textHash`).
 * Nové znenie má iný text, a teda začína bez nich — návrh sa robí znova.
 *
 * Modul je čistý TypeScript bez databázy, aby sa dal testovať. Rez profilom
 * (slovo článku, tokeny) ostáva v `chunker.mjs`; tu je len druhá cesta,
 * ktorú si vyberie kurátor.
 */

import { estimateTokens, stripHeadingEmphasis, type Chunk } from "./chunker.mjs"

export type BlockKind = "heading" | "paragraph" | "item" | "table"

export interface TextBlock {
  index: number
  kind: BlockKind
  /** Úroveň nadpisu (1–6); pri ostatných 0. */
  level: number
  /** Text bloku tak, ako je v Markdowne (riadky spojené `\n`). */
  text: string
}

const HEADING = /^(#{1,6})\s+\S/
const ITEM = /^\s*(?:[-*•+]|\d+[.)]|[a-z][.)])\s+\S/
const TABLE = /^\s*\|/

/**
 * Markdown → bloky. Čistá funkcia.
 *
 * - nadpis (`#`…`######`) je blok sám, aj keď za ním nie je prázdny riadok;
 * - súvislé riadky tabuľky (`|`) sú jeden blok — tabuľka sa nedelí;
 * - položka zoznamu je blok aj so svojimi odsadenými pokračovaniami;
 * - ostatné súvislé riadky sú odsek; prázdny riadok blok ukončí.
 */
export function splitBlocks(markdown: string): TextBlock[] {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n")
  const out: TextBlock[] = []
  let cur: { kind: BlockKind; level: number; lines: string[] } | null = null
  const flush = () => {
    if (cur && cur.lines.some(l => l.trim())) {
      out.push({ index: out.length, kind: cur.kind, level: cur.level, text: cur.lines.join("\n").replace(/\s+$/, "") })
    }
    cur = null
  }
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "")
    if (!line.trim()) { flush(); continue }
    const h = HEADING.exec(line)
    if (h) {
      flush()
      out.push({ index: out.length, kind: "heading", level: h[1].length, text: line })
      continue
    }
    if (TABLE.test(line)) {
      if (cur?.kind !== "table") { flush(); cur = { kind: "table", level: 0, lines: [] } }
      cur!.lines.push(line)
      continue
    }
    if (ITEM.test(line)) {
      flush()
      cur = { kind: "item", level: 0, lines: [line] }
      continue
    }
    // Odsadené pokračovanie položky zoznamu ostáva v položke.
    if (cur?.kind === "item" && /^\s{2,}\S/.test(raw)) { cur.lines.push(line); continue }
    if (!cur || cur.kind !== "paragraph") { flush(); cur = { kind: "paragraph", level: 0, lines: [] } }
    cur.lines.push(line)
  }
  flush()
  return out
}

/** Nadpis bez mriežok a tučného písma — „## **1.3 Stav**" → „1.3 Stav". */
export function headingText(block: Pick<TextBlock, "text">): string {
  return stripHeadingEmphasis(block.text).replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim()
}

/** Hranice v poradí, bez duplicít, len platné indexy (1 … počet − 1). */
export function normalizeBoundaries(boundaries: unknown, blockCount: number): number[] {
  const list = Array.isArray(boundaries) ? boundaries : []
  const ok = list
    .map(n => Math.round(Number(n)))
    .filter(n => Number.isFinite(n) && n > 0 && n < blockCount)
  return [...new Set(ok)].sort((a, b) => a - b)
}

/** Skupiny blokov podľa hraníc: `[[0,1,2],[3,4],…]` ako indexy. */
export function groupBlocks(blockCount: number, boundaries: number[]): number[][] {
  const cuts = [0, ...normalizeBoundaries(boundaries, blockCount), blockCount]
  const groups: number[][] = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const g: number[] = []
    for (let b = cuts[i]; b < cuts[i + 1]; b++) g.push(b)
    if (g.length) groups.push(g)
  }
  return groups
}

/** Text skupiny blokov — položky zoznamu pod sebou, ostatné s prázdnym riadkom. */
export function joinBlocks(blocks: TextBlock[]): string {
  let s = ""
  blocks.forEach((b, i) => {
    if (i > 0) s += b.kind === "item" && blocks[i - 1].kind === "item" ? "\n" : "\n\n"
    s += b.text
  })
  return s
}

/**
 * Rez podľa ručných hraníc → úseky v tvare chunkera, aby ich indexovanie
 * zapísalo rovnako ako rez profilom.
 *
 * - `heading`: nadpis, ktorým úsek začína, inak posledný nadpis pred ním
 *   (úsek pokračuje v časti, ktorá začala skôr);
 * - `articleRef`: ten istý nadpis — pri manuáli je to miesto, kam citácia
 *   vedie („1.3 Stav podania"); bez nadpisu `null`;
 * - `typ`: `clanok`, keď úsek patrí pod nadpis, inak `preambula`;
 * - `uplnaJednotka`: úsek začína nadpisom (nie je to pokračovanie).
 */
export function cutByBoundaries(markdown: string, boundaries: number[]): Chunk[] {
  const blocks = splitBlocks(markdown)
  const groups = groupBlocks(blocks.length, boundaries)
  let lastHeading: string | null = null
  return groups.map((g, chunkIndex) => {
    const part = g.map(i => blocks[i])
    const startsWithHeading = part[0].kind === "heading"
    const firstHeading = part.find(b => b.kind === "heading")
    const heading = startsWithHeading ? headingText(part[0]) : lastHeading
    for (const b of part) if (b.kind === "heading") lastHeading = headingText(b)
    const ref = heading ?? (firstHeading ? headingText(firstHeading) : null)
    return {
      chunkIndex,
      text: joinBlocks(part),
      heading: ref ?? "",
      articleRef: ref,
      cast: null,
      typ: ref ? "clanok" : "preambula",
      uplnaJednotka: startsWithHeading,
      obsahujeTabulku: part.some(b => b.kind === "table"),
    }
  })
}

const norm = (s: string) => stripHeadingEmphasis(s).replace(/^#{1,6}\s+/, "").replace(/[*_`|]/g, "").replace(/\s+/g, " ").trim().toLowerCase()

/**
 * Hranice existujúceho rezu (uložené úseky) v reči blokov — aby sa dal
 * porovnať s návrhom. Pre každý úsek okrem prvého sa nájde blok, v ktorom
 * jeho prvý riadok začína (hľadá sa dopredu). Úsek, ktorý začína uprostred
 * bloku (chunker delil dlhý odsek), dostane hranicu na tom bloku a vráti sa
 * `approximate: true`.
 */
export function boundariesFromChunks(blocks: TextBlock[], chunkTexts: string[]): { boundaries: number[]; approximate: boolean } {
  const normBlocks = blocks.map(b => norm(b.text))
  const out: number[] = []
  let cursor = 0
  let approximate = false
  for (let c = 1; c < chunkTexts.length; c++) {
    const first = String(chunkTexts[c] ?? "").split("\n").map(l => l.trim()).find(Boolean) ?? ""
    const probe = norm(first).slice(0, 60)
    if (!probe) { approximate = true; continue }
    let found = -1
    for (let b = Math.max(cursor, 1); b < normBlocks.length; b++) {
      if (normBlocks[b].startsWith(probe)) { found = b; break }
      if (normBlocks[b].includes(probe)) { found = b; approximate = true; break }
    }
    if (found < 0) { approximate = true; continue }
    out.push(found)
    cursor = found
  }
  return { boundaries: normalizeBoundaries(out, blocks.length), approximate }
}

/** Tokeny skupín podľa hraníc — pre súhrn a štítky bez skladania úsekov. */
export function groupTokens(blocks: TextBlock[], boundaries: number[]): number[] {
  return groupBlocks(blocks.length, boundaries).map(g => estimateTokens(joinBlocks(g.map(i => blocks[i]))))
}

/** Rozdiel dvoch rezov: hranice len v návrhu (`added`) a len v dnešnom (`removed`). */
export function boundaryDiff(current: number[], proposed: number[]): { added: number[]; removed: number[]; kept: number[] } {
  const c = new Set(current)
  const p = new Set(proposed)
  return {
    added: proposed.filter(b => !c.has(b)),
    removed: current.filter(b => !p.has(b)),
    kept: proposed.filter(b => c.has(b)),
  }
}
