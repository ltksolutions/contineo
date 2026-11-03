/**
 * pageLink.ts — odkaz na stranu PDF znenia z citácie (Ján 3. 11. 2026).
 *
 * Dve cesty k tej istej strane:
 *
 *   · `/documents/<id>?version=<v>#page-N` — dokument v portáli posunutý na
 *     stranu (`PdfPages` kreslí stranu s `id="page-N"`). Funguje na každom
 *     telefóne a je to tá istá obrazovka, kde sa potvrdzuje.
 *   · `/api/documents/<id>/pdf?version=<v>#page=N` — samotné PDF v novom okne;
 *     `#page=` je zmluva prehliadačov (Chrome, Safari, Firefox, Edge).
 *
 * Znenie je to, z ktorého je úsek — nie dnešné: o rok môže mať platné znenie
 * schému na inej strane.
 */

export interface SourcePages {
  from: number
  to: number
  /** Strana schémy, ktorú úsek opisuje (`chunkPages.ts`). */
  figure?: number
}

/** Strana, na ktorú citácia vedie: schéma, ak ju úsek opisuje, inak začiatok úseku. */
export function citedPage(pages: SourcePages): number {
  return pages.figure ?? pages.from
}

/** Strany úseku z polí uloženého úseku, alebo `null`, keď ich úsek nemá. */
export function chunkPages(c: { pageFrom?: number; pageTo?: number; pageFigure?: number }): SourcePages | null {
  if (typeof c.pageFrom !== "number") return null
  const pages: SourcePages = { from: c.pageFrom, to: c.pageTo ?? c.pageFrom }
  if (typeof c.pageFigure === "number") pages.figure = c.pageFigure
  return pages
}

const query = (versionId?: string) => (versionId ? `?version=${encodeURIComponent(versionId)}` : "")

export function documentPageHref(documentId: string, page: number, versionId?: string): string {
  return `/documents/${encodeURIComponent(documentId)}${query(versionId)}#page-${page}`
}

/** Samotné PDF znenia — z neho kreslí náhľad strany aj `pdfPageHref`. */
export function pdfHref(documentId: string, versionId?: string): string {
  return `/api/documents/${encodeURIComponent(documentId)}/pdf${query(versionId)}`
}

export function pdfPageHref(documentId: string, page: number, versionId?: string): string {
  return `${pdfHref(documentId, versionId)}#page=${page}`
}

/** Strana z adresy (`#page-12`), alebo `null`. */
export function pageFromHash(hash: string): number | null {
  const m = /^#page-(\d{1,5})$/.exec(hash)
  const n = m ? Number(m[1]) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}
