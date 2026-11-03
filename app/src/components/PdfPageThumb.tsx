"use client"

/**
 * PdfPageThumb — malý náhľad strany PDF v citácii odpovede (Ján 3. 11. 2026).
 *
 * Pri Pravidlách futbalu je podstatné to, čo text nepovie: schéma ihriska,
 * postavenie rozhodcu. Náhľad ukáže, že na strane taká je, a kliknutím
 * otvorí dokument presne na nej (`documentPageHref`).
 *
 * Kreslí sa z toho istého PDF, ktoré je v knižnici — žiadne obrázky navyše
 * sa neukladajú. PDF sa stiahne, až keď je citácia blízko obrazovky, a pre
 * všetky citácie z jedného znenia len raz (`sharedDocument`).
 *
 * **Bez JavaScriptu** alebo keď sa strana nevykreslí, ostáva prázdny papier
 * s číslom strany — stále je to odkaz na tú istú stranu.
 */

import Link from "next/link"
import { useEffect, useRef, useState, type MouseEvent } from "react"
import { pageRenderSize } from "@/lib/pdfPages"
import { sharedDocument } from "./pdfjs"

/** Šírka náhľadu v CSS px — musí sedieť s `.page-thumb` v `globals.css`. */
const THUMB_WIDTH = 72

export default function PdfPageThumb({ pdf, page, href, label, onClick }: {
  /** Adresa PDF znenia bez kotvy (`pdfHref`). */
  pdf: string
  page: number
  /** Kam vedie kliknutie — dokument v portáli na tejto strane. */
  href: string
  /** Popis pre čítačku („Náhľad strany 12"). */
  label: string
  /** Klik — citácia ním otvára prehliadač strán (`CitationPage`). */
  onClick?: (e: MouseEvent) => void
}) {
  const boxRef = useRef<HTMLAnchorElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setNear(true)
        observer.disconnect()
      }
    }, { rootMargin: "50% 0px" })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!near) return
    let cancelled = false
    let cancelRender: (() => void) | null = null
    ;(async () => {
      try {
        const doc = await sharedDocument(pdf)
        if (cancelled || page > doc.numPages) return
        const p = await doc.getPage(page)
        const viewport = p.getViewport({ scale: 1 })
        const size = pageRenderSize(viewport.width, viewport.height, THUMB_WIDTH, window.devicePixelRatio)
        const canvas = canvasRef.current
        if (cancelled || !size || !canvas) return
        canvas.width = size.pixelWidth
        canvas.height = size.pixelHeight
        const task = p.render({ canvas, viewport: p.getViewport({ scale: size.viewportScale }) })
        cancelRender = () => task.cancel()
        await task.promise
        if (!cancelled) setDrawn(true)
      } catch (e) {
        // Náhľad je doplnok — odkaz funguje aj bez neho, preto len do konzoly.
        if ((e as { name?: string } | null)?.name !== "RenderingCancelledException") {
          console.error(`[pdf] náhľad strany ${page} sa nepodarilo vykresliť:`, e)
        }
      }
    })()
    return () => {
      cancelled = true
      cancelRender?.()
    }
  }, [near, pdf, page])

  return (
    <Link ref={boxRef} href={href} className={`page-thumb${drawn ? " is-drawn" : ""}`} aria-label={label} onClick={onClick}>
      <canvas ref={canvasRef} className="page-thumb-canvas" aria-hidden="true" />
      <span className="page-thumb-n" aria-hidden="true">{page}</span>
    </Link>
  )
}
