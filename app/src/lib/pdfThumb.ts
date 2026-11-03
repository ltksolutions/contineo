/**
 * pdfThumb.ts — náhľad jednej strany PDF ako PNG, vykreslený na serveri
 * (Ján 3. 11. 2026, KANAL-widget-strana).
 *
 * V portáli kreslí náhľad prehliadač (`PdfPageThumb` cez pdf.js). Widget beží
 * na cudzej stránke (ISSF) — ťahať tam pdf.js s pracovným vláknom a celé
 * 224-stranové PDF kvôli obrázku 72 px by bolo neúmerné. Server preto pošle
 * hotový obrázok a widget ho vloží ako `<img>`.
 *
 * Kreslí pdf.js samo cez `@napi-rs/canvas` (jeho voliteľná závislosť,
 * `NodeCanvasFactory`). Na Verceli ho treba priložiť do funkcie ručne —
 * `next.config.mjs`, rovnako ako pracovný modul pdf.js.
 */

import path from "node:path"

/** Šírka obrázka v px: náhľad má 72 CSS px, kreslí sa dvojnásobne pre ostré displeje. */
export const THUMB_PIXEL_WIDTH = 144

/*
 * Písma, ktoré PDF nemá vložené (Helvetica, Times…). PDF z Wordu ich má
 * vložené všetky, ale sken alebo export z iného nástroja nie — bez nich by
 * pdf.js text na náhľade vynechal. V Node ich číta z disku, nie cez fetch.
 */
const STANDARD_FONTS = path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep

/** PNG strany `page` (od 1), `null`, keď taká strana nie je. */
export async function renderPdfPageThumb(data: Uint8Array, page: number, width: number = THUMB_PIXEL_WIDTH): Promise<Buffer | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const task = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    useSystemFonts: false,
    standardFontDataUrl: STANDARD_FONTS,
  })
  try {
    const doc = await task.promise
    if (!Number.isInteger(page) || page < 1 || page > doc.numPages) return null
    const p = await doc.getPage(page)
    const scale = width / p.getViewport({ scale: 1 }).width
    const viewport = p.getViewport({ scale })
    const factory = doc.canvasFactory as {
      create(w: number, h: number): { canvas: { toBuffer(type: "image/png"): Buffer }; context: unknown }
    }
    const { canvas, context } = factory.create(Math.round(viewport.width), Math.round(viewport.height))
    await p.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise
    return canvas.toBuffer("image/png")
  } finally {
    await task.destroy()
  }
}
