/**
 * courierInline.ts — kurzíva, podčiarknuté a prečiarknuté v správe Kuriéra
 * (16. 10. 2026, pripomienky Jána k editoru; ADR-033 D208, D222).
 *
 * **Len Kuriér**, rovnako ako odkazy von: spoločný `formatText.ts` (odpoveď
 * asistenta, text predpisov) sa nemení. Zápis v ľahkom Markdowne:
 *
 *   - kurzíva `_text_` (podčiarkovník na hranici slova — `snake_case`
 *     a adresy ostanú bez zmeny; hviezdička by sa bila s tučným `**`),
 *   - prečiarknuté `~~text~~` (GitHub),
 *   - podčiarknuté `++text++` (Markdown na to štandard nemá; `++` je
 *     zaužívané rozšírenie a nikdy z toho nie je HTML).
 *
 * Čistý TypeScript — testuje sa bez prehliadača.
 */

import { splitExternal } from "./courierLinks"

export type InlineMark = "italic" | "underline" | "strike"

export interface InlinePart {
  text: string
  marks: InlineMark[]
  /** Odkaz von (D222) — text odkazu bez ďalšieho formátovania. */
  href?: string
  host?: string
}

const PATTERNS: [InlineMark, RegExp][] = [
  ["underline", /\+\+(?=\S)([^\n]*?\S)\+\+/],
  ["strike", /~~(?=\S)([^\n]*?\S)~~/],
  ["italic", /(?<![\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/u],
]

/** Kurzíva, podčiarknuté, prečiarknuté — aj vnorené (`++_x_++`). */
export function parseMarks(text: string, marks: InlineMark[] = []): InlinePart[] {
  let best: { mark: InlineMark; m: RegExpExecArray } | null = null
  for (const [mark, re] of PATTERNS) {
    if (marks.includes(mark)) continue
    const m = re.exec(text)
    if (m && (!best || m.index < best.m.index)) best = { mark, m }
  }
  if (!best) return text ? [{ text, marks }] : []
  const before = text.slice(0, best.m.index)
  const after = text.slice(best.m.index + best.m[0].length)
  return [
    ...(before ? [{ text: before, marks }] : []),
    ...parseMarks(best.m[1], [...marks, best.mark]),
    ...parseMarks(after, marks),
  ]
}

/** Text správy po `formatText` → odkazy von a značky v jednom zozname úsekov. */
export function splitCourierInline(text: string): InlinePart[] {
  return splitExternal(text).flatMap(p => p.druh === "von"
    ? [{ text: p.text, marks: [] as InlineMark[], href: p.href, host: p.host }]
    : parseMarks(p.text))
}

/** Zápis značky okolo textu — opak `parseMarks` (poradie: kurzíva vnútri). */
export function wrapMarks(text: string, marks: { italic?: boolean; strike?: boolean; underline?: boolean }): string {
  let t = text
  if (marks.italic) t = `_${t}_`
  if (marks.strike) t = `~~${t}~~`
  if (marks.underline) t = `++${t}++`
  return t
}
