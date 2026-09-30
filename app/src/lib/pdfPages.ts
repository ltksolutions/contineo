/**
 * pdfPages.ts — počty pre vykreslenie strany PDF do plátna (`PdfPages`).
 *
 * Čisté funkcie bez prehliadača, aby sa dali overiť testom: komponent sám
 * beží len v prehliadači a jeho chyba by sa ukázala až na telefóne.
 */

/**
 * Strop pixelov jedného plátna. iOS Safari väčšie plátno nevykreslí vôbec
 * (prázdna biela strana bez chyby) a pri 50 stranách by sa sčítala aj pamäť.
 * 8 Mpx je A4 na šírku 1 400 px pri dvojnásobnej hustote — ostré aj tak.
 */
export const MAX_CANVAS_PIXELS = 8_000_000

/** Hustotu nad 3 oko nerozozná, pamäť áno. */
export const MAX_OUTPUT_SCALE = 3

export interface PageRenderSize {
  /** Mierka pre `page.getViewport({ scale })` — už vrátane hustoty displeja. */
  viewportScale: number
  /** Rozmer plátna v pixeloch zariadenia (`canvas.width/height`). */
  pixelWidth: number
  pixelHeight: number
  /** Rozmer na stránke v CSS pixeloch. */
  cssWidth: number
  cssHeight: number
}

/**
 * Rozmer plátna pre stranu s rozmermi `pageWidth × pageHeight` (body PDF pri
 * mierke 1, už otočené) vloženú do šírky `containerWidth` CSS pixelov.
 *
 * Strana sa vždy roztiahne na šírku kontajnera — na telefóne je to jediný
 * spôsob, ako ju čítať bez približovania; `devicePixelRatio` sa pridá, aby
 * písmo nebolo rozmazané.
 */
export function pageRenderSize(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  devicePixelRatio = 1,
  maxPixels = MAX_CANVAS_PIXELS,
): PageRenderSize | null {
  if (!(pageWidth > 0) || !(pageHeight > 0) || !(containerWidth > 0)) return null
  const cssWidth = Math.floor(containerWidth)
  const cssScale = cssWidth / pageWidth
  const cssHeight = Math.round(pageHeight * cssScale)
  let outputScale = Math.min(Math.max(devicePixelRatio || 1, 1), MAX_OUTPUT_SCALE)
  const area = cssWidth * cssHeight * outputScale * outputScale
  if (area > maxPixels) outputScale = Math.sqrt(maxPixels / (cssWidth * cssHeight))
  const viewportScale = cssScale * outputScale
  return {
    viewportScale,
    pixelWidth: Math.floor(pageWidth * viewportScale),
    pixelHeight: Math.floor(pageHeight * viewportScale),
    cssWidth,
    cssHeight,
  }
}

/** „Strana 3 z 12" zo vzoru v slovníku (`common.pdf.page`). */
export function pageLabel(template: string, page: number, pages: number): string {
  return template.replaceAll("{page}", String(page)).replaceAll("{pages}", String(pages))
}
