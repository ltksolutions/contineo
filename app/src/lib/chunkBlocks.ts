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

/** Najdlhší riadok, ktorý ešte môže byť nadpisom bez mriežok. */
const PSEUDO_MAX = 120
// Bez `\b`: v JavaScripte nepozná „Ť" ako písmeno a „ČASŤ PRVÁ" by neprešla.
const PART = /^(?:ČASŤ|Časť|HLAVA|Hlava|DIEL|Diel)(?=\s|$)/
// Veľkosť písmen nehrá rolu: texty noriem v databáze majú „## čl. 5 — Názov"
// (porovnanie 16. 10. 2026), iné „Článok 5" alebo „ČLÁNOK 5".
const ARTICLE = /^(?:článok|čl\.|§|príloha)\s*(?:č\.\s*)?\d+[a-z]?(?![0-9])/iu
const NUMBERED = /^(\d+(?:\.\d+)*)\.?\s+\S/

/**
 * Úroveň nadpisu, ktorý je nadpisom bez mriežok (ADR-035, D223 bod 2) —
 * prevod PDF ich často dá ako tučný riadok alebo „Článok 5". `0` = nie je.
 *
 * - „ČASŤ / HLAVA / DIEL" → 2; „Článok 5", „§ 5", „Príloha č. 2" → 3;
 * - celý tučný krátky riadok: podľa číslovania (`1` → 2, `1.2` → 3,
 *   `1.2.3` → 4), bez čísla 3.
 * Riadok končiaci bodkou je veta, nie nadpis.
 */
export function pseudoHeadingLevel(line: string): number {
  const raw = line.trim()
  if (!raw || raw.length > PSEUDO_MAX || /[.;:,]$/.test(raw.replace(/\*+$/, ""))) return 0
  const bold = /^\*\*[^*].*\*\*$/.test(raw)
  const text = raw.replace(/^\*\*|\*\*$/g, "").trim()
  if (PART.test(text)) return 2
  if (ARTICLE.test(text)) return 3
  if (!bold) return 0
  const n = NUMBERED.exec(text)
  return n ? Math.min(6, n[1].split(".").length + 1) : 3
}

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
      // Jednoriadkový odsek, ktorý je nadpisom bez mriežok, je nadpis.
      const pseudo = cur.kind === "paragraph" && cur.lines.length === 1 ? pseudoHeadingLevel(cur.lines[0]) : 0
      out.push({
        index: out.length,
        kind: pseudo ? "heading" : cur.kind,
        level: pseudo || cur.level,
        text: cur.lines.join("\n").replace(/\s+$/, ""),
      })
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
    // Nadpis bez mriežok aj bez prázdneho riadku za ním (prevod PDF). Uprostred
    // odseku len tučný alebo krátky riadok — zalomená veta „§ 5 sa…" nadpis nie je.
    const pseudo = pseudoHeadingLevel(line)
    if (pseudo && (line.trim().startsWith("**") || line.trim().length <= 60)) {
      flush()
      out.push({ index: out.length, kind: "heading", level: pseudo, text: line })
      continue
    }
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

/** Nadpis článku, § alebo prílohy — jednotka normy, ktorá má vlastný úsek (ADR-035). */
export function isUnitHeading(block: Pick<TextBlock, "kind" | "text">): boolean {
  return block.kind === "heading" && /^(?:čl\.|§|príloha)/.test(refFromHeading(headingText(block)))
}

/** Čísla odsekov „(1)" v blokoch úseku — pre citáciu delenej jednotky („čl. 12 ods. 1–9"). */
function paragraphRange(part: TextBlock[]): string | null {
  const nums = part.map(b => /^\((\d+[a-z]?)\)/.exec(b.text.trim())?.[1]).filter((x): x is string => Boolean(x))
  if (!nums.length) return null
  return nums.length === 1 || nums[0] === nums[nums.length - 1] ? nums[0] : `${nums[0]}–${nums[nums.length - 1]}`
}

/**
 * Citácia z nadpisu (ADR-035, D223 bod 5): článok, § a príloha v tvare
 * chunkera („čl. 5", „§ 5", „príloha č. 2") — tak ich citujú odpovede aj
 * porovnanie znení; inak text nadpisu („1.2 Spracovanie").
 */
export function refFromHeading(heading: string): string {
  const h = heading.trim()
  const article = /^(?:článok|čl\.)\s*(\d+[a-z]?)/iu.exec(h)
  if (article) return `čl. ${article[1]}`
  const paragraph = /^§\s*(\d+[a-z]?)/.exec(h)
  if (paragraph) return `§ ${paragraph[1]}`
  // Príloha môže mať písmeno („Príloha č. 1a" v RaPP) — bez neho by splynula s prílohou 1.
  const annex = /^príloha\s*(?:č\.\s*)?(\d+[a-z]?)/iu.exec(h)
  if (annex) return `príloha č. ${annex[1]}`
  return h
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
export function cutByBoundaries(markdown: string, boundaries: number[], title = ""): Chunk[] {
  const blocks = splitBlocks(markdown)
  const groups = groupBlocks(blocks.length, boundaries)
  // Cesta nadpisov podľa úrovne — riadok kontextu úseku („Názov › Časť › Oddiel").
  const path: { level: number; text: string }[] = []
  const pathBefore = (i: number) => {
    for (let b = 0; b < i; b++) {
      const x = blocks[b]
      if (x.kind !== "heading") continue
      while (path.length && path[path.length - 1].level >= x.level) path.pop()
      path.push({ level: x.level, text: headingText(x) })
    }
    // Úsek, ktorý začína nadpisom, nemá v kontexte súrodencov ani nižšie
    // úrovne pred sebou — len nadradené („Článok 2" nie pod „Článok 1").
    const first = blocks[i]
    if (first?.kind === "heading") while (path.length && path[path.length - 1].level >= first.level) path.pop()
    const out = path.map(p => p.text)
    path.length = 0
    return out
  }
  let lastHeading: string | null = null
  // Úsek, ktorý nemá vlastný článok, pokračuje v predošlom — pri delenom
  // článku sa do citácie pridajú odseky (ako pri chunkeri).
  const hasUnit = groups.map(g => g.some(i => isUnitHeading(blocks[i])))
  return groups.map((g, chunkIndex) => {
    const part = g.map(i => blocks[i])
    const startsWithHeading = part[0].kind === "heading"
    const firstHeading = part.find(b => b.kind === "heading")
    // Článok v úseku má prednosť pred nadpisom časti nad ním („PRVÁ ČASŤ" + „Článok 1" → čl. 1).
    const unit = part.find(b => isUnitHeading(b))
    const heading = unit ? headingText(unit) : startsWithHeading ? headingText(part[0]) : lastHeading
    for (const b of part) if (b.kind === "heading") lastHeading = headingText(b)
    const name = heading ?? (firstHeading ? headingText(firstHeading) : null)
    const continued = !hasUnit[chunkIndex] && chunkIndex > 0
    const continuesNext = chunkIndex + 1 < groups.length && !hasUnit[chunkIndex + 1]
    const baseRef = name ? refFromHeading(name) : null
    const ods = baseRef && /^(?:čl\.|§)/.test(baseRef) && (continued || continuesNext) ? paragraphRange(part) : null
    // Kontext: názov dokumentu a nadradené nadpisy pred úsekom (bez nadpisu,
    // ktorým úsek začína — ten je v texte). Rovnaký tvar ako pri chunkeri.
    const context = [title, ...pathBefore(g[0])].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i)
    const body = joinBlocks(part)
    return {
      chunkIndex,
      text: context.length ? `${context.join(" › ")}\n\n${body}` : body,
      heading: name ?? "",
      articleRef: baseRef ? (ods ? `${baseRef} ods. ${ods}` : baseRef) : null,
      cast: null,
      typ: name ? (/^príloha/.test(refFromHeading(name)) ? "priloha" : "clanok") : "preambula",
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
    // Uložený úsek môže začínať riadkom kontextu („Názov › Oddiel") a jeho
    // telo býva zlúčené do jedného riadku — hľadá sa prvý riadok bez „›".
    // Prvé dva riadky: prvý môže byť riadok kontextu („Názov › Oddiel", pri
    // dokumente bez nadradeného nadpisu len „Názov") — ten v blokoch nie je.
    const lines = String(chunkTexts[c] ?? "").split("\n").map(l => l.trim()).filter(Boolean)
    const candidates = lines.slice(0, 2).filter(l => !l.includes(" › "))
    if (!candidates.length && lines[0]) candidates.push(lines[0])
    let probe = ""
    let found = -1
    for (const line of candidates) {
      probe = norm(line).slice(0, 60)
      if (!probe) continue
      for (let b = Math.max(cursor, 1); b < normBlocks.length; b++) {
        const nb = normBlocks[b]
        // Blok začína úsekom, alebo zlúčený úsek začína celým (krátkym) blokom — nadpisom.
        if (nb.startsWith(probe) || (nb.length >= 8 && probe.startsWith(nb.slice(0, 60)))) { found = b; break }
      }
      if (found >= 0) break
    }
    if (!probe) { approximate = true; continue }
    if (found < 0) {
      for (let b = Math.max(cursor, 1); b < normBlocks.length; b++) {
        if (normBlocks[b].includes(probe)) { found = b; approximate = true; break }
      }
    }
    // Úsek začína uprostred dlhého odseku a jeho zlúčený text siaha cez
    // hranicu bloku — skúsi sa kratšia vzorka (začiatok vety).
    if (found < 0 && probe.length > 24) {
      const short = probe.slice(0, 24)
      for (let b = Math.max(cursor, 0); b < normBlocks.length; b++) {
        if (normBlocks[b].includes(short)) { found = Math.max(b, 1); approximate = true; break }
      }
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
