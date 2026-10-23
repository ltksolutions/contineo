/**
 * NormCitation — citácia normy s odkazom do nového okna a náhľadom článku
 * (Ján 11. 10. 2026). Rovnaká v detaile kontroly súladu aj vo fronte návrhov
 * FAQ: odkaz na čitateľský pohľad s kotvou článku, doslovná veta a pod ňou
 * rozbaľovací náhľad celého článku so zvýraznenými odsekmi. Funguje bez
 * JavaScriptu; posun na zvýraznený odsek robí `ScrollToCited`.
 */

import FormattedText from "./FormattedText"
import ScrollToCited from "./ScrollToCited"
import { articleHash, articleLabel } from "@/lib/articleAnchors"
import { stripMarkdownMarks } from "@/lib/formatText"
import type { NormPreview } from "@/lib/normPreview"

export interface NormCitationLabels {
  norm: string
  opensNewWindow: string
  showArticle: (label: string) => string
  articleNote: string
  openPdf: string
}

export default function NormCitation({ citation, preview, labels }: {
  citation: { documentId: string; title: string; articleRef: string | null; quote: string }
  preview?: NormPreview | null
  labels: NormCitationLabels
}) {
  return (
    <div className="cf-blk">
      <span className="cf-blk-l">{labels.norm}</span>
      <p>
        <a href={`/documents/${encodeURIComponent(citation.documentId)}${articleHash(citation.articleRef)}`} target="_blank" rel="noopener">
          {citation.title}{citation.articleRef ? `, ${citation.articleRef}` : ""}
          <svg className="ext-icon" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="sr-only"> {labels.opensNewWindow}</span>
        </a>
      </p>
      {citation.quote && <blockquote className="quote">{stripMarkdownMarks(citation.quote)}</blockquote>}
      {preview && (
        <details className="norm-preview">
          <summary>{labels.showArticle(articleLabel(citation.articleRef))}</summary>
          <div className="norm-preview-body">
            <p className="quiet field-hint">
              {labels.articleNote}
              {preview.pdfHref && <> · <a href={preview.pdfHref} target="_blank" rel="noopener">{labels.openPdf}<span className="sr-only"> {labels.opensNewWindow}</span></a></>}
            </p>
            <div className="answer">
              <FormattedText text={preview.text} anchors highlight={preview.cited} />
            </div>
            <ScrollToCited />
          </div>
        </details>
      )}
    </div>
  )
}
