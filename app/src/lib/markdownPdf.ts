/**
 * markdownPdf.ts — PDF z Markdownu pre dokumenty, ktoré neprišli ako súbor
 * (ADR-029, použitie B: import z MCP konektora).
 *
 * Schvaľuje a potvrdzuje sa PDF (ADR-011) — aj článok stiahnutý zo servera
 * ho preto musí mať. Rovnaký postup ako pri FAQ (`faqPdf.ts`): pdf-lib,
 * písmo Noto Sans, pevný čas v metadátach, aby ten istý text dal ten istý
 * súbor a odtlačok znenia (`versionId`) sedel medzi behmi.
 *
 * Je to **čitateľný výtlačok, nie sadzba**: nadpisy, odseky, odrážky
 * a číslované body, riadky kódu v menšom písme. Tabuľky a odkazy ostávajú
 * ako text — na schválenie a potvrdenie to stačí, na vyhľadávanie slúži
 * Markdown vedľa (D95).
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { FONT_DIR, wrapText } from "./certificatePdf"
import { FAQ_PDF_DATE } from "./faqPdf"

const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = 56
const INK = rgb(0.137, 0.165, 0.208)
const MUTED = rgb(0.357, 0.392, 0.447)

let fontCache: Promise<{ sans: Uint8Array; bold: Uint8Array; mono: Uint8Array }> | null = null
function fontBytes() {
  fontCache ??= (async () => {
    const [sans, bold] = await Promise.all(
      ["NotoSans-Regular.ttf", "NotoSans-SemiBold.ttf"].map(f => readFile(path.join(FONT_DIR, f))),
    )
    // Kód sa sádže tým istým písmom v menšej veľkosti — ďalší font by
    // pridal 400 kB do každého PDF kvôli pár riadkom.
    return { sans, bold, mono: sans }
  })()
  return fontCache
}

/** Inline Markdown (`**x**`, `` `x` ``, `[a](b)`) na obyčajný text. */
export function plainInline(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "item"; text: string; marker: string; indent: number }
  | { kind: "code"; lines: string[] }
  | { kind: "rule" }

/** Riadky Markdownu na bloky. Exportované kvôli testom. */
export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  let para: string[] = []
  let code: string[] | null = null
  const flush = () => {
    if (para.length) blocks.push({ kind: "paragraph", text: plainInline(para.join(" ")) })
    para = []
  }
  for (const raw of lines) {
    if (code) {
      if (/^\s*```/.test(raw)) { blocks.push({ kind: "code", lines: code }); code = null }
      else code.push(raw.replace(/\t/g, "  "))
      continue
    }
    const line = raw.replace(/\s+$/, "")
    if (/^\s*```/.test(line)) { flush(); code = []; continue }
    if (!line.trim()) { flush(); continue }
    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) { flush(); blocks.push({ kind: "heading", level: h[1].length, text: plainInline(h[2]) }); continue }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); blocks.push({ kind: "rule" }); continue }
    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/)
    if (li) {
      flush()
      const marker = /\d/.test(li[2]) ? li[2].replace(")", ".") : "•"
      blocks.push({ kind: "item", text: plainInline(li[3]), marker, indent: Math.min(3, Math.floor(li[1].length / 2)) })
      continue
    }
    // Oddeľovací riadok tabuľky (`|---|---|`) nenesie text.
    if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)) continue
    // Tabuľka a citácia ostávajú ako text riadku — bez sadzby, ale čitateľne.
    para.push(line.replace(/^\s*>\s?/, "").replace(/^\|\s*|\s*\|$/g, "").replace(/\s*\|\s*/g, " · "))
  }
  if (code) blocks.push({ kind: "code", lines: code })
  flush()
  return blocks
}

export interface MarkdownPdfTexts {
  /** Pätička strany: „strana N z M". */
  page: (n: number, total: number) => string
  /** Riadok pod názvom: odkiaľ dokument je. */
  origin?: string
}

export async function renderMarkdownPdf(input: { title: string; markdown: string; texts: MarkdownPdfTexts; author?: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const bytes = await fontBytes()
  const [sans, bold] = await Promise.all([
    doc.embedFont(bytes.sans, { subset: false }),
    doc.embedFont(bytes.bold, { subset: false }),
  ])
  doc.setTitle(input.title)
  if (input.author) doc.setAuthor(input.author)
  doc.setCreator("Contineo")
  doc.setProducer("Contineo")
  doc.setCreationDate(FAQ_PDF_DATE)
  doc.setModificationDate(FAQ_PDF_DATE)

  const W = PAGE.width - 2 * MARGIN
  const pages: PDFPage[] = []
  let page!: PDFPage
  let y = 0
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height])
    pages.push(page)
    y = PAGE.height - MARGIN
  }
  const paragraph = (text: string, font: PDFFont, size: number, color = INK, indent = 0, hanging = "") => {
    const lines = wrapText(text, font, size, W - indent)
    const lineHeight = size * 1.4
    lines.forEach((line, i) => {
      if (y - lineHeight < MARGIN) newPage()
      y -= lineHeight
      if (i === 0 && hanging) page.drawText(hanging, { x: MARGIN + indent - font.widthOfTextAtSize(hanging + " ", size), y, size, font, color })
      page.drawText(line, { x: MARGIN + indent, y, size, font, color })
    })
  }
  const gap = (h: number) => { y -= h }

  newPage()
  paragraph(input.title, bold, 18)
  if (input.texts.origin) { gap(4); paragraph(input.texts.origin, sans, 9, MUTED) }
  gap(14)

  for (const b of parseBlocks(input.markdown)) {
    if (b.kind === "heading") {
      // Nadpis nesmie ostať sám na konci strany.
      if (y - 60 < MARGIN) newPage()
      gap(b.level <= 2 ? 10 : 6)
      paragraph(b.text, bold, b.level === 1 ? 15 : b.level === 2 ? 13 : 11.5)
      gap(4)
    } else if (b.kind === "paragraph") {
      paragraph(b.text, sans, 10.5)
      gap(6)
    } else if (b.kind === "item") {
      const indent = 14 + b.indent * 12
      paragraph(b.text, sans, 10.5, INK, indent, b.marker)
      gap(2)
    } else if (b.kind === "code") {
      gap(2)
      for (const line of b.lines) paragraph(line || " ", sans, 8.5, MUTED, 10)
      gap(6)
    } else {
      gap(8)
    }
  }

  pages.forEach((p, i) => {
    const label = input.texts.page(i + 1, pages.length)
    p.drawText(label, { x: PAGE.width - MARGIN - sans.widthOfTextAtSize(label, 8), y: MARGIN / 2, size: 8, font: sans, color: MUTED })
  })
  return doc.save({ useObjectStreams: false })
}
