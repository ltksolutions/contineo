/**
 * normPreview.ts — text citovaného článku normy na náhľad (Ján 11. 10. 2026).
 *
 * Spoločné pre detail kontroly súladu a frontu návrhov FAQ: z platného
 * znenia (inak konceptu) sa vyberie článok (`articleSection`), zvýraznia sa
 * citované odseky (`citedParagraphs`) a pridá sa odkaz na záväzné PDF.
 * Čitateľský pohľad pri PDF text neukazuje (ADR-011), preto je náhľad pri
 * citácii — označený ako text na vyhľadávanie.
 */

import { getCollection } from "./mongodb"
import { DOCUMENTS_COLLECTION, effectiveVersion, type DocumentRecord } from "./documents"
import { articleSection, citedParagraphs } from "./articleAnchors"

export interface NormPreview { text: string; hash: string; cited: string[]; pdfHref: string | null }

export async function loadNormPreview(companyCode: string, citation: { documentId: string; articleRef: string | null }): Promise<NormPreview | null> {
  const doc = await (await getCollection(DOCUMENTS_COLLECTION)).findOne({ companyCode, documentId: citation.documentId }) as unknown as DocumentRecord | null
  if (!doc) return null
  const v = effectiveVersion(doc)
  const markdown = v.ok ? String(v.version.markdown ?? doc.markdown ?? "") : String((doc as { draftMarkdown?: string }).draftMarkdown ?? "")
  const section = articleSection(markdown, citation.articleRef)
  if (!section) return null
  const pdfHref = v.ok && v.version.pdf
    ? `/api/documents/${encodeURIComponent(doc.documentId)}/pdf?version=${encodeURIComponent(v.version.versionId)}`
    : null
  // Všetky citované odseky („ods. 8 a ods. 19"); bez odsekov aspoň miesto z kotvy.
  const cited = citedParagraphs(citation.articleRef)
  return { ...section, cited: cited.length ? cited : [section.hash.slice(1)], pdfHref }
}
