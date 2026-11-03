/**
 * conversionReview.ts — nezhody kontroly slov tak, ako ich číta človek
 * (KNIZ-kontrola-slov, Ján 3. 11. 2026).
 *
 * `conversionCheck.ts` hlási, kde sa slová líšia; nehovorí, čo sa stalo.
 * Pri rozpise ÚLK bola väčšina z 27 nezhôd **presun** — model prečítal bunky
 * tabuľky v inom poradí a ten istý text sa ukázal raz ako „chýba" a o kus
 * nižšie ako „navyše". Ako dva nesúvisiace riadky to nikto nevedel potvrdiť.
 * Tu sa také dvojice spoja do jednej položky a položky sa zoskupia podľa
 * strany PDF, na ktorú sa treba pozrieť.
 *
 * Potvrdzuje sa stále po odtlačkoch nezhôd (`ids`), takže presun potvrdí obe
 * jeho polovice a uložené potvrdenia sa nemenia.
 *
 * **Presun v jednom riadku tabuľky nie je na rozhodnutie** (Ján 3. 11. 2026).
 * Textová vrstva PDF číta tabuľku po riadkoch strany: adresa zalomená v bunke
 * na dva riadky a telefón vedľa jej prvého riadku dajú „…lekárstva,
 * 0910 703 757 Lehnice 15…". Model bunky zložil správne a kontrola to
 * porovnala s rozhádzaným poradím. Slová aj riadok ostali — ide medzi drobnosti
 * na hromadné potvrdenie a ukáže sa ako riadok tabuľky. Presun **medzi**
 * riadkami ostáva položkou: tam môže telefón patriť inému človeku.
 */

import type { CheckDifference } from "./conversionCheck"

export type ReviewKind = "moved" | "changed" | "missing" | "added" | "image"

export interface ReviewItem {
  /** Odtlačky nezhôd, ktoré položka potvrdí — pri presune dva. */
  ids: string[]
  kind: ReviewKind
  pdfText: string
  mdText: string
  before: string
  after: string
  /** Pri presune okolie miesta, kam sa text v texte dostal. */
  movedBefore?: string
  movedAfter?: string
  pages: number[]
  line: number
  /** Pri presune riadok, kam sa text dostal. */
  toLine?: number
  /** Presun medzi riadkami tabuľky: prvá bunka riadku podľa PDF a podľa textu. */
  fromRow?: string
  toRow?: string
}

/** Presun v jednom riadku tabuľky — riadok textu ako bunky. */
export interface RowOrderItem extends ReviewItem {
  cells: string[]
  /** Bunka s presunutým textom (−1, keď sa nedá určiť). */
  marked: number
}

export interface ReviewPage {
  from: number
  to: number
  items: ReviewItem[]
}

export interface Review {
  pages: ReviewPage[]
  /** Len interpunkcia — potvrdzuje sa naraz. */
  minor: CheckDifference[]
  /** Iné poradie buniek v jednom riadku tabuľky — potvrdzuje sa naraz. */
  rowOrder: RowOrderItem[]
}

/** Bunky riadku tabuľky Markdownu; `null`, keď riadok nie je riadok tabuľky. */
export function tableCells(line: string | undefined): string[] | null {
  const l = (line ?? "").trim()
  if (!l.startsWith("|") || /^\|[\s:|-]+\|?$/.test(l)) return null
  return l.replace(/^\|/, "").replace(/\|$/, "").split("|")
    .map(c => c.replace(/<br\s*\/?>/gi, " / ").trim())
}

/** Slová bez interpunkcie a veľkosti písmen — podľa nich sa pozná presun. */
function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

const key = (text: string) => words(text).join(" ")
const bag = (text: string) => words(text).sort().join(" ")

function single(d: CheckDifference): ReviewItem {
  // Text pri obrázku, ktorý v PDF nie je: model ho opísal alebo prepísal
  // z obrázka. Stroj ho overiť nevie, človek áno — iná veta než „navyše".
  const kind: ReviewKind = d.kind === "added" && d.nearImage ? "image"
    : d.kind === "changed" && d.pdfText && bag(d.pdfText) === bag(d.mdText) ? "moved"
    : d.kind
  return { ids: [d.id], kind, pdfText: d.pdfText, mdText: d.mdText, before: d.before, after: d.after, pages: d.pages, line: d.line }
}

/**
 * Nepotvrdené nezhody ako položky na kontrolu. Presun je dvojica „chýba"
 * a „navyše" s tými istými slovami; páruje sa s najbližším riadkom, aby sa
 * pri opakovanom texte (telefónne čísla v tabuľke) nespojilo, čo k sebe nepatrí.
 */
export function reviewDifferences(open: CheckDifference[], markdown = ""): Review {
  const minor = open.filter(d => d.minor)
  const rest = open.filter(d => !d.minor).sort((a, b) => a.line - b.line)
  const used = new Set<string>()
  const items: ReviewItem[] = []

  for (const d of rest) {
    if (used.has(d.id)) continue
    if (d.kind === "missing" && key(d.pdfText)) {
      const k = key(d.pdfText)
      const pair = rest
        .filter(x => x.kind === "added" && !used.has(x.id) && key(x.mdText) === k)
        .sort((a, b) => Math.abs(a.line - d.line) - Math.abs(b.line - d.line))[0]
      if (pair) {
        used.add(d.id).add(pair.id)
        items.push({
          ids: [d.id, pair.id], kind: "moved",
          pdfText: d.pdfText, mdText: pair.mdText,
          before: d.before, after: d.after,
          movedBefore: pair.before, movedAfter: pair.after,
          pages: [...new Set([...d.pages, ...pair.pages])].sort((a, b) => a - b),
          line: d.line, toLine: pair.line,
        })
        continue
      }
    }
    if (d.kind === "added" && key(d.mdText)) {
      const k = key(d.mdText)
      const pair = rest
        .filter(x => x.kind === "missing" && !used.has(x.id) && key(x.pdfText) === k)
        .sort((a, b) => Math.abs(a.line - d.line) - Math.abs(b.line - d.line))[0]
      if (pair) {
        used.add(d.id).add(pair.id)
        items.push({
          ids: [pair.id, d.id], kind: "moved",
          pdfText: pair.pdfText, mdText: d.mdText,
          before: pair.before, after: pair.after,
          movedBefore: d.before, movedAfter: d.after,
          pages: [...new Set([...pair.pages, ...d.pages])].sort((a, b) => a - b),
          line: pair.line, toLine: d.line,
        })
        continue
      }
    }
    used.add(d.id)
    items.push(single(d))
  }

  // Presuny v tabuľke: v jednom riadku idú medzi drobnosti, medzi riadkami
  // dostanú mená riadkov (prvá bunka — pri tabuľke osôb meno).
  const lines = markdown.split("\n")
  const rowOrder: RowOrderItem[] = []
  const kept: ReviewItem[] = []
  for (const item of items) {
    const toLine = item.toLine ?? item.line
    // Medzera po vynechanom texte sa hlási riadkom slova za ňou. Keď PDF
    // prečítalo bunku až za koncom riadku tabuľky, je to začiatok ďalšieho
    // riadku — patrí však k riadku, ktorým okolie pred medzerou končí.
    const tail = words(item.before).slice(-3).join(" ")
    const atRowEnd = item.kind === "moved" && toLine < item.line && Boolean(tail)
      && tableCells(lines[toLine - 1]) !== null && key(lines[toLine - 1]).endsWith(tail)
    const line = atRowEnd ? toLine : item.line
    const from = item.kind === "moved" ? tableCells(lines[line - 1]) : null
    const to = from ? tableCells(lines[toLine - 1]) : null
    if (from && to && toLine === line) rowOrder.push({ ...item, cells: from, marked: from.findIndex(c => key(c).includes(key(item.mdText))) })
    else if (from && to) kept.push({ ...item, fromRow: from[0] || from.find(Boolean) || "", toRow: to[0] || to.find(Boolean) || "" })
    else kept.push(item)
  }

  // Skupina podľa prvej strany položky; rozsah skupiny je, čo jej položky pokrývajú.
  const groups = new Map<number, ReviewItem[]>()
  for (const item of kept) {
    const first = item.pages[0] ?? 0
    groups.set(first, [...(groups.get(first) ?? []), item])
  }
  const pages = [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([from, list]) => ({
      from,
      to: Math.max(from, ...list.flatMap(i => i.pages)),
      items: list.sort((a, b) => a.line - b.line),
    }))
  return { pages, minor, rowOrder }
}
