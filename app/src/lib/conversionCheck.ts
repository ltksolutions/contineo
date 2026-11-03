/**
 * conversionCheck.ts — kontrola slov prevodu modelom proti textovej vrstve PDF
 * (ADR-046, D299–D300).
 *
 * Model prevádza PDF prvý (D297), ale **neverí sa mu na slovo**. Každé slovo
 * výsledku sa strojovo porovná s textom, ktorý v PDF naozaj je. Čo nesedí —
 * vynechané slovo, slovo navyše, iné slovo, text prepísaný z obrázka — je
 * nezhoda, ktorú musí potvrdiť človek, kým koncept pôjde na schválenie.
 *
 * Tým ostáva zmysel D53 („text, ktorý vyzerá správne a nie je, je pri norme
 * horší než chýbajúci dokument"), len ho nestráži poradie krokov, ale stroj.
 *
 * **Čo sa nepočíta ako nezhoda** — len to, čo text nemení:
 *   · značkovanie Markdownu (`#`, `|`, `**`, odrážky, oddeľovač tabuľky);
 *   · medzery a delenie slov na konci riadku („pod- mienkami" = „podmienkami");
 *   · úvodzovky, pomlčky a odrážkové znaky (`„"`, `–—`, `▪•➢`);
 *   · riadky, ktoré sa v PDF opakujú na viacerých stranách (hlavička, päta)
 *     a čísla strán — model ich má vynechať.
 *
 * Interpunkcia, ktorá mení zmysel (`.,;:?!()§%`), sa porovnáva. Veľké a malé
 * písmená tiež — „ROZPIS" → „Rozpis" je zmena, ktorú má človek vidieť.
 *
 * Čisté funkcie bez databázy a bez modelu, aby sa dali testovať.
 */

/** Text jednej strany PDF tak, ako ho dá textová vrstva — riadky v poradí. */
export interface LayerPage {
  lines: string[]
  /** Koľko obrázkov strana kreslí. Text z obrázka v textovej vrstve nie je. */
  images: number
}

export type DifferenceKind = "added" | "missing" | "changed"

export interface CheckDifference {
  /** Odtlačok nezhody — potvrdenie prežije opakovanú kontrolu toho istého textu. */
  id: string
  kind: DifferenceKind
  /** Text z PDF (pri `added` prázdny). */
  pdfText: string
  /** Text vo výsledku (pri `missing` prázdny). */
  mdText: string
  /** Pár slov pred a za nezhodou — bez okolia sa nedá prečítať. */
  before: string
  after: string
  /** Strany PDF, ku ktorým nezhoda patrí (1…). */
  pages: number[]
  /** Riadok Markdownu (1…), kde nezhoda začína. */
  line: number
  /** Na niektorej z tých strán je obrázok — text mohol byť prepísaný z neho. */
  nearImage: boolean
  /** Počet slov nezhody (väčšia strana), na zoradenie a súhrn. */
  words: number
  /**
   * Len interpunkcia, žiadne slovo ani číslo — dvojbodka za „Predseda",
   * čiarka medzi položkami, keď sa riadok tabuľky prepíše na zoznam. Potvrdiť
   * ju treba tiež, ale dá sa to naraz.
   */
  minor: boolean
}

export interface ConversionCheck {
  /** Verzia pravidla — zvýši ju človek, keď sa zmení, čo sa počíta ako nezhoda. */
  version: number
  pdfWords: number
  mdWords: number
  sameWords: number
  differences: CheckDifference[]
  /** Opakujúce sa riadky PDF, ktoré sa do porovnania nebrali (hlavička, päta). */
  repeatedLines: string[]
}

export const CHECK_VERSION = 2

/** Nezhody bližšie než toľko zhodných tokenov sa spoja do jednej. */
const MERGE_GAP = 2

/** Koľko slov okolia sa ukáže pri nezhode. */
const CONTEXT_WORDS = 6
/** Riadok, ktorý je aspoň na toľkých stranách, je hlavička alebo päta. */
const REPEATED_MIN_PAGES = 3
/** Koľko riadkov na začiatku a konci strany môže byť hlavička alebo päta. */
const EDGE_LINES = 2

interface Token {
  /** Porovnávaný tvar. */
  key: string
  /** Strana PDF (1…) alebo riadok Markdownu (1…). */
  at: number
  /**
   * Hlavička, päta alebo číslo strany. Model ich má vynechať, ale smie ich aj
   * ponechať — ani jedno nie je nezhoda.
   */
  optional?: boolean
}

// Slovo je súvislý rad písmen a číslic; zmysluplná interpunkcia je token sama.
const TOKEN = /[\p{L}\p{N}]+|[.,;:?!()§%]/gu

/** Riadok bez čísiel — hlavička „Strana 3 z 49" je na každej strane iná len číslom. */
const lineShape = (line: string) => line.replace(/\d+/g, "#").replace(/\s+/g, " ").trim()

const PAGE_NUMBER = /^[-–—]?\s*(?:strana\s+)?\d{1,3}(?:\s*(?:\/|z|of)\s*\d{1,3})?\s*[-–—]?$/i

/**
 * Miesto riadku na okraji strany — „t0" prvý zhora, „b0" prvý zdola; uprostred
 * strany `null`. Hlavička je vždy na tom istom mieste; rovnaký riadok
 * uprostred je obsah („Hrací systém:" pri každej súťaži v rozpise).
 */
function edgeSlot(j: number, n: number): string | null {
  if (j < EDGE_LINES) return `t${j}`
  if (j >= n - EDGE_LINES) return `b${n - 1 - j}`
  return null
}

/**
 * Riadky, ktoré sú na viacerých stranách na tom istom mieste okraja —
 * hlavička a päta. Krátke riadky („a)", „1.") sa neberú: tie sa opakujú,
 * lebo sú obsahom. Vracia kľúče `miesto|tvar`.
 */
export function repeatedLines(pages: LayerPage[]): Set<string> {
  const seen = new Map<string, Set<number>>()
  pages.forEach((p, i) => {
    p.lines.forEach((line, j) => {
      const slot = edgeSlot(j, p.lines.length)
      const shape = lineShape(line)
      if (!slot || shape.length < 8) return
      const key = `${slot}|${shape}`
      if (!seen.has(key)) seen.set(key, new Set())
      seen.get(key)!.add(i)
    })
  })
  const min = Math.min(REPEATED_MIN_PAGES, Math.max(2, pages.length))
  return new Set([...seen].filter(([, s]) => s.size >= min).map(([key]) => key))
}

/** Tokeny jedného riadku. */
function lineTokens(line: string, at: number, optional = false): Token[] {
  return [...line.matchAll(TOKEN)].map(m => (optional ? { key: m[0], at, optional } : { key: m[0], at }))
}

/**
 * Tokeny textovej vrstvy. Slovo rozdelené na konci riadku („pod-" + „mienkami")
 * sa spojí ešte pred porovnaním — to je sadzba, nie text.
 */
export function layerTokens(pages: LayerPage[], repeated: Set<string> = repeatedLines(pages)): Token[] {
  const out: Token[] = []
  pages.forEach((p, i) => {
    const n = p.lines.length
    const lines = p.lines.map((raw, j) => {
      const text = raw.trim()
      const slot = edgeSlot(j, n)
      const optional = PAGE_NUMBER.test(text) || (slot !== null && repeated.has(`${slot}|${lineShape(text)}`))
      return { text, optional }
    }).filter(l => l.text)
    for (let j = 0; j < lines.length; j++) {
      let { text } = lines[j]
      const { optional } = lines[j]
      while (!optional && /\p{Ll}-$/u.test(text) && j + 1 < lines.length && !lines[j + 1].optional && /^\p{Ll}/u.test(lines[j + 1].text)) {
        text = text.slice(0, -1) + lines[++j].text
      }
      out.push(...lineTokens(text, i + 1, optional))
    }
  })
  return out
}

/** Riadok Markdownu bez značkovania — len text, ktorý by človek prečítal. */
export function stripMarkup(line: string): string {
  if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)) return ""   // oddeľovač tabuľky
  return line
    // HTML značky, ktoré Markdown pustí (`<br>` v bunke tabuľky, `<u>`) —
    // nie sú slová (rozpis ÚLK 3. 11. 2026: 14 z 31 nezhôd bolo „br" a „u").
    .replace(/<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>]*)?\/?>/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*(?:[-*+•▪➢]\s+|>\s?)/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/\|/g, " ")
}

/** Tokeny Markdownu s číslom riadku. */
export function markdownTokens(markdown: string): Token[] {
  const out: Token[] = []
  String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n").forEach((line, i) => {
    out.push(...lineTokens(stripMarkup(line), i + 1))
  })
  return out
}

// ── Porovnanie postupností ──────────────────────────────────────────────────

export interface Op {
  kind: "same" | "del" | "ins"
  aStart: number
  aEnd: number
  bStart: number
  bEnd: number
}

/** Nad týmto počtom úprav sa úsek bez kotiev berie ako celý iný. */
const MYERS_MAX_EDITS = 1500

/**
 * Myers O(ND) na krátkom úseku bez kotiev. Vracia dvojice zhodných indexov.
 * `null`, keď je úsek taký iný, že presné porovnanie nemá zmysel.
 */
function myersMatches(a: string[], aLo: number, aHi: number, b: string[], bLo: number, bHi: number): [number, number][] | null {
  const n = aHi - aLo
  const m = bHi - bLo
  const max = Math.min(n + m, MYERS_MAX_EDITS)
  const offset = max + 1
  let v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice())
    const next = v.slice()
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[aLo + x] === b[bLo + y]) { x++; y++ }
      next[offset + k] = x
      if (x >= n && y >= m) {
        // Spätný prechod: v každom kroku `d` sa vráti po diagonále (zhody)
        // a potom o jednu úpravu do bodu, z ktorého sa prišlo.
        const pairs: [number, number][] = []
        let cx = n, cy = m
        for (let dd = d; dd > 0; dd--) {
          const pv = trace[dd]
          const kk = cx - cy
          const prevK = kk === -dd || (kk !== dd && pv[offset + kk - 1] < pv[offset + kk + 1]) ? kk + 1 : kk - 1
          const px = pv[offset + prevK]
          const py = px - prevK
          while (cx > px && cy > py) { cx--; cy--; pairs.push([aLo + cx, bLo + cy]) }
          cx = px
          cy = py
        }
        while (cx > 0 && cy > 0) { cx--; cy--; pairs.push([aLo + cx, bLo + cy]) }
        return pairs.reverse()
      }
    }
    v = next
  }
  return null
}

/** Najdlhšia rastúca podpostupnosť (podľa druhého indexu) — kotvy v poradí. */
function longestIncreasing(pairs: [number, number][]): [number, number][] {
  const tails: number[] = []
  const prev = new Int32Array(pairs.length).fill(-1)
  for (let i = 0; i < pairs.length; i++) {
    let lo = 0, hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (pairs[tails[mid]][1] < pairs[i][1]) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) prev[i] = tails[lo - 1]
    tails[lo] = i
  }
  const out: [number, number][] = []
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) out.push(pairs[i])
  return out.reverse()
}

/**
 * Zhodné dvojice indexov dvoch postupností: najprv kotvy (slová, ktoré sú
 * v úseku jedinečné v oboch), medzi nimi rekurzívne, a kde kotvy nie sú,
 * presný Myers. Celý dokument Myersom porovnať nejde — 60 strán je 30 tisíc
 * slov na každej strane.
 */
function matches(a: string[], aLo: number, aHi: number, b: string[], bLo: number, bHi: number, out: [number, number][]): void {
  while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) out.push([aLo++, bLo++])
  const tail: [number, number][] = []
  while (aHi > aLo && bHi > bLo && a[aHi - 1] === b[bHi - 1]) tail.push([--aHi, --bHi])
  if (aLo < aHi && bLo < bHi) {
    const count = new Map<string, { a: number; b: number; ai: number; bi: number }>()
    for (let i = aLo; i < aHi; i++) {
      const c = count.get(a[i]) ?? { a: 0, b: 0, ai: i, bi: -1 }
      c.a++; c.ai = i
      count.set(a[i], c)
    }
    for (let j = bLo; j < bHi; j++) {
      const c = count.get(b[j])
      if (c) { c.b++; c.bi = j }
    }
    const unique = [...count.values()].filter(c => c.a === 1 && c.b === 1).map(c => [c.ai, c.bi] as [number, number]).sort((x, y) => x[0] - y[0])
    const anchors = longestIncreasing(unique)
    if (anchors.length) {
      let pa = aLo, pb = bLo
      for (const [ia, ib] of anchors) {
        matches(a, pa, ia, b, pb, ib, out)
        out.push([ia, ib])
        pa = ia + 1; pb = ib + 1
      }
      matches(a, pa, aHi, b, pb, bHi, out)
    } else {
      const found = myersMatches(a, aLo, aHi, b, bLo, bHi)
      if (found) out.push(...found)
    }
  }
  out.push(...tail.reverse())
}

/** Úpravy, ktoré z `a` urobia `b`: rady zhôd, vynechaní a vložení. */
export function diffTokens(a: string[], b: string[]): Op[] {
  const pairs: [number, number][] = []
  matches(a, 0, a.length, b, 0, b.length, pairs)
  const ops: Op[] = []
  const push = (kind: Op["kind"], aStart: number, aEnd: number, bStart: number, bEnd: number) => {
    if (aEnd <= aStart && bEnd <= bStart) return
    const last = ops[ops.length - 1]
    if (last && last.kind === kind && last.aEnd === aStart && last.bEnd === bStart) { last.aEnd = aEnd; last.bEnd = bEnd; return }
    ops.push({ kind, aStart, aEnd, bStart, bEnd })
  }
  let ia = 0, ib = 0
  for (const [pa, pb] of pairs) {
    push("del", ia, pa, ib, ib)
    push("ins", pa, pa, ib, pb)
    push("same", pa, pa + 1, pb, pb + 1)
    ia = pa + 1; ib = pb + 1
  }
  push("del", ia, a.length, ib, ib)
  push("ins", a.length, a.length, ib, b.length)
  return ops
}

// ── Nezhody ─────────────────────────────────────────────────────────────────

/** Krátky stabilný odtlačok (FNV-1a) — na `id` nezhody, nie na bezpečnosť. */
function fingerprint(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

/** Text z tokenov — interpunkcia bez medzery pred sebou, aby sa čítal ako veta. */
function render(tokens: Token[]): string {
  return tokens.map(t => t.key).join(" ").replace(/\s+([.,;:?!)%])/g, "$1").replace(/\(\s+/g, "(")
}

/**
 * Porovná výsledok prevodu s textovou vrstvou PDF.
 *
 * Nezhoda, ktorej obe strany sú po spojení bez medzier rovnaké
 * („komis iám" / „komisiám"), sa nehlási — je to medzera, nie slovo.
 */
export function checkConversion(pages: LayerPage[], markdown: string): ConversionCheck {
  const repeated = repeatedLines(pages)
  const pdf = layerTokens(pages, repeated)
  const md = markdownTokens(markdown)
  const ops = diffTokens(pdf.map(t => t.key), md.map(t => t.key))

  // Vynechanie a vloženie vedľa seba sú jedna zmena.
  const hunks: { aStart: number; aEnd: number; bStart: number; bEnd: number }[] = []
  for (const op of ops) {
    if (op.kind === "same") continue
    const last = hunks[hunks.length - 1]
    // Nezhody oddelené jedným-dvoma zhodnými slovami sú jedno miesto na
    // prečítanie — „3. ÚČASTNÍCI" → „čl. 3 — ÚČASTNÍCI" nie sú dve.
    if (last && op.aStart - last.aEnd <= MERGE_GAP && op.bStart - last.bEnd <= MERGE_GAP) { last.aEnd = op.aEnd; last.bEnd = op.bEnd }
    else hunks.push({ aStart: op.aStart, aEnd: op.aEnd, bStart: op.bStart, bEnd: op.bEnd })
  }

  const imagePages = new Set(pages.map((p, i) => (p.images > 0 ? i + 1 : 0)).filter(Boolean))
  const differences: CheckDifference[] = []
  let changedWords = 0
  for (const h of hunks) {
    const from = pdf.slice(h.aStart, h.aEnd).filter(x => !x.optional)
    const to = md.slice(h.bStart, h.bEnd)
    if (!from.length && !to.length) continue
    if (from.map(t => t.key).join("") === to.map(t => t.key).join("")) continue
    const kind: DifferenceKind = !from.length ? "added" : !to.length ? "missing" : "changed"
    const before = render(md.slice(Math.max(0, h.bStart - CONTEXT_WORDS), h.bStart))
    const after = render(md.slice(h.bEnd, h.bEnd + CONTEXT_WORDS))
    // Strana: z PDF, a pri vloženom texte zo slova PDF tesne pred ním.
    const anchor = pdf[Math.min(Math.max(h.aStart - 1, 0), pdf.length - 1)]
    const pageList = [...new Set(from.length ? from.map(t => t.at) : anchor ? [anchor.at] : [])]
    const nearImage = pageList.some(p => imagePages.has(p) || imagePages.has(p + 1))
    const pdfText = render(from)
    const mdText = render(to)
    changedWords += Math.max(from.length, to.length)
    differences.push({
      id: fingerprint(`${kind}|${pdfText}|${mdText}|${before}|${after}`),
      kind, pdfText, mdText, before, after,
      pages: pageList,
      line: (to[0] ?? md[Math.min(h.bStart, md.length - 1)])?.at ?? 1,
      nearImage,
      words: Math.max(from.length, to.length),
      minor: ![...from, ...to].some(x => /[\p{L}\p{N}]/u.test(x.key)),
    })
  }

  return {
    version: CHECK_VERSION,
    pdfWords: pdf.length,
    mdWords: md.length,
    sameWords: Math.max(0, md.length - changedWords),
    differences,
    repeatedLines: [...new Set([...repeated].map(k => k.slice(k.indexOf("|") + 1)))],
  }
}

/** Nezhody, ktoré ešte nikto nepotvrdil. */
export function unresolvedDifferences(check: Pick<ConversionCheck, "differences"> | null | undefined, confirmed: Iterable<string> | null | undefined): CheckDifference[] {
  const ok = new Set(confirmed ?? [])
  return (check?.differences ?? []).filter(d => !ok.has(d.id))
}
