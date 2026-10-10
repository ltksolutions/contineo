/**
 * faqPdf.ts — PDF zo záznamov FAQ (ADR-028, D164).
 *
 * FAQ nevzniká z PDF, ale v aplikácii. ADR-011 však hovorí, že schvaľuje
 * a archivuje sa PDF — a výnimka v dátovom modeli („tento druh PDF nemá")
 * by bola drahšia než jedno vykreslenie. Preto sa pri každom uložení
 * záznamov zloží PDF zo záznamov a uloží ako koncept rovnako, ako keby ho
 * niekto nahral.
 *
 * **Rovnaký vstup dá rovnaké bajty.** Identita znenia je odtlačok PDF
 * a textu (D96); keby sa do PDF dostal čas vzniku, dve uloženia tých istých
 * záznamov by boli dve rôzne znenia a schválenie by sa rozpadlo bez zmeny
 * obsahu. Dátum v metadátach PDF je preto pevný.
 *
 * Písma sú Noto z `assets/fonts/` (viď `certificatePdf.ts`, prečo nie
 * štandardné písma PDF a prečo bez `subset`).
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { FONT_DIR, wrapText, PDF_FONT_OPTIONS } from "./certificatePdf"
import type { FaqEntry } from "./faq"

/** A4 na výšku v bodoch. */
const PAGE = { width: 595.28, height: 841.89 }
const MARGIN = 56
const INK = rgb(0.137, 0.165, 0.208)
const MUTED = rgb(0.357, 0.392, 0.447)
const RULE = rgb(0.85, 0.87, 0.9)

/** Pevný čas v metadátach — viď hlavičku súboru. */
export const FAQ_PDF_DATE = new Date("2026-01-01T00:00:00Z")

export interface FaqPdfTexts {
  intro: string
  variants: string
  answer: string
  sources: string
  audience: string
  empty: string
  /** Pätička strany: „strana N z M". */
  page: (n: number, total: number) => string
}

let fontCache: Promise<{ sans: Uint8Array; bold: Uint8Array }> | null = null
function fontBytes() {
  fontCache ??= (async () => {
    const [sans, bold] = await Promise.all(
      ["NotoSans-Regular.ttf", "NotoSans-SemiBold.ttf"].map(f => readFile(path.join(FONT_DIR, f))),
    )
    return { sans, bold }
  })()
  return fontCache
}

/** Zdroj záznamu ako jeden riadok textu — názov dokumentu a článok. */
export function sourceLine(source: { documentId: string; articleRef: string | null }, titles: Map<string, string>): string {
  const title = titles.get(source.documentId) ?? source.documentId
  return source.articleRef ? `${title} (${source.articleRef})` : title
}

export async function renderFaqPdf(input: {
  title: string
  entries: FaqEntry[]
  texts: FaqPdfTexts
  /** Názvy zdrojových dokumentov podľa `documentId` — kópia v čase vzniku. */
  titles: Map<string, string>
  author?: string
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const bytes = await fontBytes()
  const [sans, bold] = await Promise.all([
    doc.embedFont(bytes.sans, PDF_FONT_OPTIONS),
    doc.embedFont(bytes.bold, PDF_FONT_OPTIONS),
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
  /** Odsek: zalomí, pri nedostatku miesta otočí stranu. */
  const paragraph = (text: string, font: PDFFont, size: number, color = INK, indent = 0) => {
    const lines = wrapText(text, font, size, W - indent)
    const lineHeight = size * 1.4
    for (const line of lines) {
      if (y - lineHeight < MARGIN) newPage()
      y -= lineHeight
      page.drawText(line, { x: MARGIN + indent, y, size, font, color })
    }
  }
  const gap = (h: number) => { y -= h }

  newPage()
  paragraph(input.title, bold, 18)
  gap(6)
  paragraph(input.texts.intro, sans, 10, MUTED)
  gap(14)

  if (!input.entries.length) paragraph(input.texts.empty, sans, 11, MUTED)

  input.entries.forEach((e, i) => {
    // Otázka s odpoveďou držia spolu aspoň prvými riadkami: pri konci strany
    // sa radšej otočí, než aby otázka ostala sama dole.
    if (y - 90 < MARGIN) newPage()
    if (i > 0) {
      page.drawLine({ start: { x: MARGIN, y: y }, end: { x: MARGIN + W, y: y }, thickness: 0.5, color: RULE })
      gap(14)
    }
    paragraph(`${i + 1}. ${e.question}`, bold, 12)
    if (e.variants.length) {
      gap(3)
      paragraph(`${input.texts.variants}: ${e.variants.join(" · ")}`, sans, 9, MUTED, 14)
    }
    gap(6)
    for (const block of e.answer.split(/\n{2,}/)) {
      paragraph(block.replace(/\s*\n\s*/g, " "), sans, 10.5, INK, 14)
      gap(4)
    }
    if (e.sources.length) {
      paragraph(`${input.texts.sources}: ${e.sources.map(s => sourceLine(s, input.titles)).join("; ")}`, sans, 9, MUTED, 14)
    }
    if (e.audience.length) {
      paragraph(`${input.texts.audience}: ${e.audience.join(", ")}`, sans, 9, MUTED, 14)
    }
    gap(12)
  })

  pages.forEach((p, i) => {
    const label = input.texts.page(i + 1, pages.length)
    p.drawText(label, { x: PAGE.width - MARGIN - sans.widthOfTextAtSize(label, 8), y: MARGIN / 2, size: 8, font: sans, color: MUTED })
  })

  return doc.save({ useObjectStreams: false })
}
