/**
 * pdfjs.ts — načítanie pdf.js na strane prehliadača, spoločné pre celé
 * znenie (`PdfPages`) aj náhľad strany v citácii (`PdfPageThumb`).
 */

import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs"

/*
 * Pomocné súbory pdf.js (písma, CMapy, dekodéry obrázkov) kopíruje do
 * `public/pdfjs/` skript `scripts/copy_pdfjs_assets.mjs` pred `dev` aj
 * `build`. Bežné PDF z Wordu ich nepotrebuje — písma má vložené — ale PDF
 * s nevloženým písmom alebo so skenom v JPEG 2000 by bez nich vyšlo inak
 * než v originále, a potvrdzuje sa presne to, čo je na obrazovke.
 */
const ASSETS = "/pdfjs/"

/** Pracovný modul sa nastaví raz za život stránky. */
let workerConfigured = false

export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  if (!workerConfigured) {
    // Legacy zostava, nie moderná: moderná vyžaduje najnovší Safari a na
    // starších iPhonoch by skončila chybou ešte pred prvou stranou.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString()
    workerConfigured = true
  }
  return pdfjs
}

export function documentOptions(href: string) {
  return {
    url: href,
    cMapUrl: `${ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    wasmUrl: `${ASSETS}wasm/`,
    iccUrl: `${ASSETS}iccs/`,
  }
}

/*
 * Odpoveď cituje päť úsekov a často z toho istého znenia — päť náhľadov
 * nesmie päťkrát stiahnuť 224-stranové PDF. Dokument sa preto otvorí raz
 * za stránku a náhľady si ho požičiavajú. Zatvára sa až s odchodom zo
 * stránky; chybné načítanie sa z pamäte vyhodí, aby ďalší pokus mohol prejsť.
 */
const shared = new Map<string, Promise<PDFDocumentProxy>>()

export function sharedDocument(href: string): Promise<PDFDocumentProxy> {
  let doc = shared.get(href)
  if (!doc) {
    doc = loadPdfJs().then(pdfjs => pdfjs.getDocument(documentOptions(href)).promise)
    doc.catch(() => shared.delete(href))
    shared.set(href, doc)
  }
  return doc
}
