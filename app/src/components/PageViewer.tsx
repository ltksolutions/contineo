"use client"

/**
 * PageViewer — prehliadač strán PDF z citácie (Ján 3. 11. 2026).
 *
 * Klik na náhľad strany alebo na „Strana N" v citácii otvorí plachtu so
 * stranou namiesto odchodu z odpovede: PDF otvorené v novej karte prehliadač
 * podľa nastavenia často **stiahne** a na telefóne človek stratí rozhovor.
 * Tvar podľa SwiftUI `.sheet`: hore dokument a „Strana N z M" so zavretím,
 * dole listovanie, „Otvoriť v knižnici" a „Stiahnuť PDF". Ten istý tvar má
 * widget kanála (`.xw-viewer` v `widgetScript.ts`).
 *
 * Kreslí pdf.js z toho istého PDF ako náhľad (`sharedDocument`), takže sa
 * znenie nesťahuje druhýkrát. Esc, závoj alebo „×" zavrie a fokus sa vráti
 * tam, odkiaľ sa plachta otvorila; šípky vľavo a vpravo listujú.
 */

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { pageRenderSize } from "@/lib/pdfPages"
import { documentPageHref, pdfHref } from "@/lib/pageLink"
import { sharedDocument } from "./pdfjs"

export default function PageViewer({ documentId, versionId, page: startPage, title, language, onClose }: {
  documentId: string
  /** Znenie, z ktorého je úsek — nie dnešné (`pageLink.ts`). */
  versionId: string
  page: number
  /** Názov dokumentu do hlavičky. */
  title: string
  language?: UiLanguage
  onClose: () => void
}) {
  const pdf = pdfHref(documentId, versionId)
  const t = dictionary(language).answer
  const panel = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(startPage)
  const [pages, setPages] = useState(0)
  // Výsledok kreslenia patrí strane — po prelistovaní je nová strana „loading"
  // sama od seba, bez nastavovania stavu v efekte.
  const [result, setResult] = useState<{ page: number; ok: boolean } | null>(null)
  const status = result?.page !== page ? "loading" : result.ok ? "drawn" : "failed"
  const [width, setWidth] = useState(0)

  // `onClose` je nová funkcia pri každom vykreslení rodiča (ako v CitationSheet).
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  const pageRef = useRef(page)
  useEffect(() => { pageRef.current = page })
  const go = (n: number) => setPage(p => (n < 1 || (pages && n > pages) ? p : n))
  const goRef = useRef(go)
  useEffect(() => { goRef.current = go })

  useEffect(() => {
    const from = document.activeElement
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current()
      else if (e.key === "ArrowLeft") goRef.current(pageRef.current - 1)
      else if (e.key === "ArrowRight") goRef.current(pageRef.current + 1)
    }
    document.addEventListener("keydown", onKey)
    // Obrazovka pod plachtou sa neroluje.
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      ;(from as HTMLElement | null)?.focus?.()
    }
  }, [])
  useEffect(() => {
    const box = bodyRef.current
    if (!box) return
    const observer = new ResizeObserver(entries => {
      // Papier má najviac 760 px (`.page-viewer-paper`), okraj tela 2 × 16 px.
      const w = Math.min(760, Math.floor((entries[0]?.contentRect.width ?? 0)))
      setWidth(prev => (prev === w ? prev : w))
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!width) return
    let cancelled = false
    let cancelRender: (() => void) | null = null
    ;(async () => {
      try {
        const doc = await sharedDocument(pdf)
        if (cancelled) return
        setPages(doc.numPages)
        if (page > doc.numPages) throw new Error(`strana ${page} nie je v dokumente`)
        const p = await doc.getPage(page)
        const viewport = p.getViewport({ scale: 1 })
        const size = pageRenderSize(viewport.width, viewport.height, width, window.devicePixelRatio)
        const canvas = canvasRef.current
        if (cancelled || !size || !canvas) return
        canvas.width = size.pixelWidth
        canvas.height = size.pixelHeight
        const task = p.render({ canvas, viewport: p.getViewport({ scale: size.viewportScale }) })
        cancelRender = () => task.cancel()
        await task.promise
        if (!cancelled) setResult({ page, ok: true })
      } catch (e) {
        if ((e as { name?: string } | null)?.name === "RenderingCancelledException") return
        console.error(`[pdf] stranu ${page} sa nepodarilo vykresliť:`, e)
        if (!cancelled) setResult({ page, ok: false })
      }
    })()
    // Nová strana začína hore, nie tam, kde človek dorolloval na predošlej.
    bodyRef.current?.scrollTo({ top: 0 })
    return () => {
      cancelled = true
      cancelRender?.()
    }
  }, [pdf, page, width])

  const label = t.viewerPage(page, pages)
  return (
    <>
      <div className="page-viewer-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={panel} className="page-viewer" role="dialog" aria-modal="true" aria-label={`${title} — ${label}`} tabIndex={-1}>
        <div className="page-viewer-head">
          <div className="page-viewer-title">
            <b>{title}</b>
            <span aria-live="polite">{label}</span>
          </div>
          <button type="button" className="page-viewer-close" aria-label={t.close} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" aria-hidden="true">
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
            </svg>
          </button>
        </div>
        <div ref={bodyRef} className="page-viewer-body">
          <div className={`page-viewer-paper${status === "drawn" ? " is-drawn" : ""}`}>
            <canvas ref={canvasRef} role="img" aria-label={label} />
            {status !== "drawn" && (
              <p className="page-viewer-status" role={status === "failed" ? "alert" : "status"}>
                {status === "failed" ? t.viewerFailed : t.viewerLoading}
              </p>
            )}
          </div>
        </div>
        <div className="page-viewer-bar">
          <button type="button" className="button button--quiet" disabled={page <= 1} onClick={() => go(page - 1)}>
            ← {t.prevPage}
          </button>
          <button type="button" className="button button--quiet" disabled={!pages || page >= pages} onClick={() => go(page + 1)}>
            {t.nextPage} →
          </button>
          <span className="page-viewer-bar-end">
            <Link className="button button--quiet" href={documentPageHref(documentId, page, versionId)}>{t.openInLibrary}</Link>
          </span>
          <a className="button button--quiet" href={`${pdf}${pdf.includes("?") ? "&" : "?"}download=1`} download>
            {t.downloadPdf}
          </a>
        </div>
      </div>
    </>
  )
}
