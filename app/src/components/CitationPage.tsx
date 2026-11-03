"use client"

/**
 * CitationPage — strana PDF pri citácii: náhľad, „Strana N" a prehliadač
 * strán (Ján 3. 11. 2026).
 *
 * Náhľad aj „Strana N" sú odkazy na dokument v knižnici na tej strane —
 * bez JavaScriptu, novou kartou alebo prostredným tlačidlom vedú tam. Bežný
 * klik otvorí prehliadač strán (`PageViewer`) a človek ostáva pri odpovedi.
 */

import { useState, type MouseEvent } from "react"
import Link from "next/link"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { citedPage, documentPageHref, pdfHref, type SourcePages } from "@/lib/pageLink"
import PdfPageThumb from "./PdfPageThumb"
import PageViewer from "./PageViewer"

/** Klik s modifikátorom alebo iným tlačidlom nechá prehliadaču (nová karta). */
export function plainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

export default function CitationPage({ documentId, versionId, pages, title, language }: {
  documentId: string
  versionId: string
  pages: SourcePages
  title: string
  language?: UiLanguage
}) {
  const t = dictionary(language).answer
  const [open, setOpen] = useState(false)
  // Strana schémy, ak ju úsek opisuje, inak začiatok úseku (`citedPage`).
  const page = citedPage(pages)
  const here = documentPageHref(documentId, page, versionId)
  const pdf = pdfHref(documentId, versionId)
  const onOpen = (e: MouseEvent) => {
    if (!plainClick(e)) return
    e.preventDefault()
    setOpen(true)
  }
  return (
    <div className="answer-citation-page">
      <PdfPageThumb pdf={pdf} page={page} href={here} label={t.pageThumb(page)} onClick={onOpen} />
      <div className="answer-citation-links">
        <Link href={here} onClick={onOpen}>
          {pages.figure ? t.figurePage(page) : t.sourcePages(pages.from, pages.to)}
        </Link>
      </div>
      {open && (
        <PageViewer
          documentId={documentId}
          versionId={versionId}
          page={page}
          title={title}
          language={language}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
