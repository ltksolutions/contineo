/**
 * Certifikát ako PDF (rám CERTIFICATE, D122) — A4 na šírku, jedna strana.
 *
 * Rozloženie kopíruje verziu na tlač (`certificate/print`): logo a číslo
 * hore, nadpis a meno v strede, podpis a overenie dole. Navyše je tu **QR
 * kód** s overovacou adresou — z papiera sa inak adresa prepisuje ručne.
 *
 * Písma sú vložené (Noto, OFL, `assets/fonts/`): štandardné písma PDF
 * nepoznajú „ľ", „ť" ani „ô" a certifikát s otáznikmi v mene je horší než
 * žiadny. Písma sú **vopred orezané** na latinku (`assets/fonts/README.md`)
 * a vkladajú sa celé: orezávanie v `@pdf-lib/fontkit` (`subset: true`)
 * pri Noto stráca znaky — z „CERTIFIKÁT" zostalo „CER" (overené 27. 9. 2026).
 * PDF má tak ~100 kB namiesto 1 MB.
 * Pätkové písmo len nadpis a meno (rám CERTIFICATE Q2 ✅).
 *
 * Funkcia je čistá voči databáze: dostane certifikát, texty, adresu
 * a logo ako PNG. Uloženie a logo rieši `certificatesDb.ts`.
 */

import { readFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import QRCode from "qrcode"
import type { Certificate } from "./certificates"
import { dictionary, formatDate, type UiLanguage } from "./i18n"

/** A4 na šírku v bodoch. */
export const PAGE = { width: 841.89, height: 595.28 }
const MM = 72 / 25.4
const INK = rgb(0.137, 0.165, 0.208)
const MUTED = rgb(0.357, 0.392, 0.447)

export interface CertificatePdfTexts {
  title: string
  sub: string
  confirms: string
  completed: string
  meta: string
  issuedOn: string
  verify: string
  signature: string
}

/** Texty z kópií v certifikáte — tie isté vety ako verzia na tlač. */
export function certificatePdfTexts(
  c: Pick<Certificate, "issuedBy" | "courseTitle" | "courseVersion" | "partsCount" | "testsPassed" | "completedAt" | "issuedAt" | "holderSalutation">,
  language: UiLanguage,
): CertificatePdfTexts {
  const t = dictionary(language).learning.cert
  return {
    title: t.pdfTitle,
    sub: t.pdfSub,
    confirms: t.pdfConfirms(c.issuedBy.legalName ?? c.issuedBy.name),
    completed: t.pdfCompleted(c.courseTitle, c.holderSalutation),
    meta: t.pdfMeta(c.courseVersion, c.partsCount, c.testsPassed, formatDate(c.completedAt, language)),
    issuedOn: t.issuedOn(formatDate(c.issuedAt, language)),
    verify: t.pdfVerify,
    signature: t.signature,
  }
}

export const FONT_DIR = path.join(process.cwd(), "assets", "fonts")

let fontCache: Promise<Record<"sans" | "sansBold" | "serif" | "mono", Uint8Array>> | null = null
function fontBytes() {
  fontCache ??= (async () => {
    const [sans, sansBold, serif, mono] = await Promise.all(
      ["NotoSans-Regular.ttf", "NotoSans-SemiBold.ttf", "NotoSerif-Regular.ttf", "NotoSansMono-Regular.ttf"].map(f => readFile(path.join(FONT_DIR, f))),
    )
    return { sans, sansBold, serif, mono }
  })()
  return fontCache
}

/** Rozdelí text do riadkov do šírky `max` (po slovách; dlhé slovo po znakoch). */
export function wrapText(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= max) { line = next; continue }
    if (line) out.push(line)
    line = word
    while (font.widthOfTextAtSize(line, size) > max && line.length > 1) {
      let cut = line.length - 1
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > max) cut--
      out.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }
  if (line) out.push(line)
  return out
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = INK) {
  page.drawText(text, { x: (PAGE.width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color })
}

/** Text s riedením (pdf-lib nemá `letter-spacing`) — znak po znaku. */
function spaced(page: PDFPage, text: string, y: number, font: PDFFont, size: number, spacing: number) {
  const chars = [...text]
  const width = chars.reduce((w, ch) => w + font.widthOfTextAtSize(ch, size), 0) + spacing * (chars.length - 1)
  let x = (PAGE.width - width) / 2
  for (const ch of chars) {
    page.drawText(ch, { x, y, size, font, color: INK })
    x += font.widthOfTextAtSize(ch, size) + spacing
  }
}

/** QR kód vektorovo — obdĺžniky po riadkoch, bez obrázka. */
function drawQr(page: PDFPage, value: string, x: number, y: number, side: number) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" })
  const n = qr.modules.size
  const cell = side / n
  for (let r = 0; r < n; r++) {
    let c = 0
    while (c < n) {
      if (!qr.modules.get(r, c)) { c++; continue }
      const start = c
      while (c < n && qr.modules.get(r, c)) c++
      page.drawRectangle({ x: x + start * cell, y: y + side - (r + 1) * cell, width: (c - start) * cell, height: cell, color: INK })
    }
  }
}

export async function renderCertificatePdf(input: {
  certificate: Pick<Certificate, "registrationNumber" | "holderName" | "signer" | "issuedBy">
  texts: CertificatePdfTexts
  verifyUrl: string
  /** Logo ako PNG (organizácie alebo Contineo); bez neho sa vynechá. */
  logoPng?: Uint8Array | null
  /** Pevný čas vzniku — rovnaký vstup dá rovnaké PDF (testy). */
  createdAt?: Date
}): Promise<Uint8Array> {
  const { certificate: c, texts: t } = input
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const bytes = await fontBytes()
  const [sans, sansBold, serif, mono] = await Promise.all([
    doc.embedFont(bytes.sans, { subset: false }),
    doc.embedFont(bytes.sansBold, { subset: false }),
    doc.embedFont(bytes.serif, { subset: false }),
    doc.embedFont(bytes.mono, { subset: false }),
  ])
  doc.setTitle(`${t.title} ${c.registrationNumber}`)
  doc.setAuthor(c.issuedBy.legalName ?? c.issuedBy.name)
  doc.setCreator("Contineo")
  doc.setProducer("Contineo")
  const at = input.createdAt ?? new Date()
  doc.setCreationDate(at)
  doc.setModificationDate(at)

  const page = doc.addPage([PAGE.width, PAGE.height])
  const { width: W, height: H } = PAGE

  // Rám: vonkajšia čiara a jemná vnútorná (ako `border` + `outline` v tlači).
  page.drawRectangle({ x: 0.75, y: 0.75, width: W - 1.5, height: H - 1.5, borderColor: INK, borderWidth: 1.5 })
  page.drawRectangle({ x: 6, y: 6, width: W - 12, height: H - 12, borderColor: INK, borderWidth: 0.5 })

  const padX = 20 * MM
  const top = H - 16 * MM
  const bottom = 16 * MM

  // Hore: logo vľavo, číslo a dátum vydania vpravo.
  if (input.logoPng) {
    const img = await doc.embedPng(input.logoPng)
    const s = Math.min(48 / img.height, 112 / img.width)
    page.drawImage(img, { x: padX, y: top - img.height * s, width: img.width * s, height: img.height * s })
  }
  const right = (text: string, y: number, font: PDFFont, size: number, color = INK) =>
    page.drawText(text, { x: W - padX - font.widthOfTextAtSize(text, size), y, size, font, color })
  right(c.registrationNumber, top - 9, mono, 9)
  right(t.issuedOn, top - 22, sans, 9)

  // Stred.
  const maxW = W - 2 * padX - 80
  let y = H / 2 + 92
  spaced(page, t.title, y, sansBold, 10, 3.2)
  y -= 38
  centered(page, t.sub, y, serif, 30)
  y -= 30
  for (const line of wrapText(t.confirms, sans, 11.5, maxW)) { centered(page, line, y, sans, 11.5); y -= 16 }
  y -= 22
  const name = c.holderName ?? "—"
  const nameSize = serif.widthOfTextAtSize(name, 26) > maxW ? Math.max(16, (26 * maxW) / serif.widthOfTextAtSize(name, 26)) : 26
  centered(page, name, y, serif, nameSize)
  const nameW = serif.widthOfTextAtSize(name, nameSize)
  page.drawLine({ start: { x: (W - nameW) / 2, y: y - 6 }, end: { x: (W + nameW) / 2, y: y - 6 }, thickness: 0.75, color: INK })
  y -= 30
  for (const line of wrapText(t.completed, sans, 11.5, maxW)) { centered(page, line, y, sans, 11.5); y -= 16 }
  y -= 2
  for (const line of wrapText(t.meta, sans, 9, maxW)) { centered(page, line, y, sans, 9, MUTED); y -= 13 }

  // Dole vľavo: podpis.
  page.drawLine({ start: { x: padX, y: bottom + 34 }, end: { x: padX + 165, y: bottom + 34 }, thickness: 0.75, color: INK })
  if (c.signer?.name) page.drawText(c.signer.name, { x: padX, y: bottom + 20, size: 9, font: sansBold, color: INK })
  page.drawText(c.signer?.role ?? t.signature, { x: padX, y: bottom + 8, size: 9, font: sans, color: INK })

  // Dole vpravo: QR a overovacia adresa vedľa neho.
  const qrSide = 64
  drawQr(page, input.verifyUrl, W - padX - qrSide, bottom, qrSide)
  const textRight = W - padX - qrSide - 12
  const urlLines = wrapText(input.verifyUrl, mono, 7.5, 230)
  let uy = bottom + 2 + (urlLines.length - 1) * 10
  page.drawText(t.verify, { x: textRight - sans.widthOfTextAtSize(t.verify, 8.5), y: uy + 13, size: 8.5, font: sans, color: INK })
  for (const line of urlLines) {
    page.drawText(line, { x: textRight - mono.widthOfTextAtSize(line, 7.5), y: uy, size: 7.5, font: mono, color: INK })
    uy -= 10
  }

  return doc.save()
}
