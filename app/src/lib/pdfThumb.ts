/**
 * pdfThumb.ts — náhľad jednej strany PDF ako PNG, vykreslený na serveri
 * (Ján 3. 11. 2026, KANAL-widget-strana).
 *
 * V portáli kreslí náhľad prehliadač (`PdfPageThumb` cez pdf.js). Widget beží
 * na cudzej stránke (ISSF) — ťahať tam pdf.js s pracovným vláknom a celé
 * 224-stranové PDF kvôli obrázku 72 px by bolo neúmerné. Server preto pošle
 * hotový obrázok a widget ho vloží ako `<img>`.
 *
 * Kreslí pdf.js do plátna z `@napi-rs/canvas`. Ten je **priama závislosť
 * a importuje sa tu reťazcom v kóde**, nie len cez pdf.js: pdf.js si ho
 * vyžiada `require` za behu, ktorý sledovanie závislostí nevidí, a na
 * Verceli potom modul vo funkcii chýbal („Cannot find module
 * '@napi-rs/canvas'", 3. 11. 2026). Import tu ho do funkcie priloží aj
 * s binárkou pre platformu — a keď už je načítaný, nájde ho aj pdf.js.
 */

import path from "node:path"
import { createCanvas } from "@napi-rs/canvas"

/** Šírka obrázka v px: náhľad má 72 CSS px, kreslí sa dvojnásobne pre ostré displeje. */
export const THUMB_PIXEL_WIDTH = 144

/*
 * Písma, ktoré PDF nemá vložené (Helvetica, Times…). PDF z Wordu ich má
 * vložené všetky, ale sken alebo export z iného nástroja nie — bez nich by
 * pdf.js text na náhľade vynechal. V Node ich číta z disku, nie cez fetch.
 */
const STANDARD_FONTS = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep

/** Šírka strany v prehliadači strán vo widgete — plachta má najviac 860 px, kreslí sa s rezervou pre ostré displeje. */
export const PAGE_PIXEL_WIDTH = 1400

async function openPdf(data: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  return pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    useSystemFonts: false,
    standardFontDataUrl: STANDARD_FONTS,
  })
}

/**
 * Obrázok strany `page` (od 1), `null`, keď taká strana nie je.
 *
 * Náhľad ide ako PNG (malý a ostrý), celá strana pre prehliadač ako WebP —
 * strana A4 v 1400 px je v PNG okolo 1 MB, vo WebP desatina a text ostáva
 * čitateľný.
 */
export async function renderPdfPage(
  data: Uint8Array,
  page: number,
  width: number = THUMB_PIXEL_WIDTH,
  format: "png" | "webp" = "png",
): Promise<Buffer | null> {
  const task = await openPdf(data)
  try {
    const doc = await task.promise
    if (!Number.isInteger(page) || page < 1 || page > doc.numPages) return null
    const p = await doc.getPage(page)
    const scale = width / p.getViewport({ scale: 1 }).width
    const viewport = p.getViewport({ scale })
    const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height))
    await p.render({ canvas: canvas as never, canvasContext: canvas.getContext("2d") as never, viewport }).promise
    return format === "webp" ? canvas.toBuffer("image/webp", 82) : canvas.toBuffer("image/png")
  } finally {
    await task.destroy()
  }
}

/** Počet strán PDF — prehliadač strán podľa neho vypne „Ďalšia". */
export async function pdfPageCount(data: Uint8Array): Promise<number> {
  const task = await openPdf(data)
  try {
    return (await task.promise).numPages
  } finally {
    await task.destroy()
  }
}
