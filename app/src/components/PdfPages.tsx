"use client"

/**
 * PdfPages — všetky strany PDF znenia pod sebou, vykreslené cez pdf.js.
 *
 * Prečo vlastné vykreslenie, nie `<object>`: rozhodnutie Jána 30. 9. 2026
 * a dôvod je v `PdfView`. Tu je len mechanika.
 *
 * **Pamäť.** Plátno A4 pri dvojnásobnej hustote má okolo 5 MB; 50 strán
 * naraz by telefón neudržal (iOS Safari potom plátna ticho nevykreslí).
 * Kreslí sa preto len strana blízko obrazovky (`IntersectionObserver`)
 * a strana, ktorá sa vzdiali, plátno uvoľní. Miesto na stránke drží
 * `aspect-ratio` podľa rozmeru strany, takže sa pri tom nič neposúva.
 *
 * **Bez JavaScriptu** sa nevykreslí nič a nezobrazí sa ani „Načítavam" —
 * odkaz „Otvoriť PDF" v `PdfView` je tam vždy.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { PDFDocumentLoadingTask, PDFPageProxy } from "pdfjs-dist/legacy/build/pdf.mjs"
import { pageLabel, pageRenderSize } from "@/lib/pdfPages"
import { pageFromHash } from "@/lib/pageLink"
import { documentOptions, loadPdfJs } from "./pdfjs"

export interface PdfPagesLabels {
  loading: string
  failed: string
  /** Vzor so `{page}` a `{pages}`. */
  page: string
}

interface PageInfo {
  page: PDFPageProxy
  /** Rozmer pri mierke 1, už otočený podľa `/Rotate`. */
  width: number
  height: number
}

type Loaded = { href: string; pages: PageInfo[] } | { href: string; failed: true }

const noop = () => () => {}

function PdfPage({ info, index, count, containerWidth, label }: {
  info: PageInfo
  index: number
  count: number
  containerWidth: number
  label: string
}) {
  const holderRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const holder = holderRef.current
    if (!holder) return
    // Jedna výška okna nad aj pod — strana je hotová skôr, než k nej človek
    // dorolluje, a ďalej od obrazovky sa pamäť vracia.
    const observer = new IntersectionObserver(
      entries => setNear(entries.some(e => e.isIntersecting)),
      { rootMargin: "100% 0px" },
    )
    observer.observe(holder)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = near ? pageRenderSize(info.width, info.height, containerWidth, window.devicePixelRatio) : null
    if (!size) {
      // Uvoľnenie plátna: nulový rozmer je jediný spoľahlivý spôsob, ako
      // Safari vráti jeho pamäť.
      canvas.width = 0
      canvas.height = 0
      info.page.cleanup()
      return
    }
    canvas.width = size.pixelWidth
    canvas.height = size.pixelHeight
    const task = info.page.render({ canvas, viewport: info.page.getViewport({ scale: size.viewportScale }) })
    task.promise.catch((e: unknown) => {
      // Zrušenie pri odrolovaní alebo zmene šírky nie je chyba.
      if ((e as { name?: string } | null)?.name !== "RenderingCancelledException") {
        console.error(`[pdf] stranu ${index + 1} sa nepodarilo vykresliť:`, e)
      }
    })
    return () => task.cancel()
  }, [near, containerWidth, info, index])

  return (
    <div ref={holderRef} id={`page-${index + 1}`} className="pdf-page" style={{ aspectRatio: `${info.width} / ${info.height}` }}>
      <canvas ref={canvasRef} className="pdf-page-canvas" role="img" aria-label={pageLabel(label, index + 1, count)} />
    </div>
  )
}

export default function PdfPages({ href, labels }: { href: string; labels: PdfPagesLabels }) {
  // Na serveri `false`: bez JavaScriptu sa nemá ukázať „Načítavam", ktoré by
  // tam ostalo navždy.
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [width, setWidth] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let task: PDFDocumentLoadingTask | null = null
    ;(async () => {
      try {
        const pdfjs = await loadPdfJs()
        if (cancelled) return
        task = pdfjs.getDocument(documentOptions(href))
        const doc = await task.promise
        // Rozmery všetkých strán vopred: miesto na stránke je hneď také,
        // aké bude, a posuvník neskáče. `getPage` je lacné — nič nekreslí.
        const pages: PageInfo[] = []
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          const viewport = page.getViewport({ scale: 1 })
          pages.push({ page, width: viewport.width, height: viewport.height })
        }
        if (!cancelled) setLoaded({ href, pages })
      } catch (e) {
        if (cancelled) return
        console.error("[pdf] PDF sa nepodarilo načítať:", e)
        setLoaded({ href, failed: true })
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [href])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const observer = new ResizeObserver(entries => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0)
      setWidth(prev => (prev === w ? prev : w))
    })
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  const current = loaded?.href === href ? loaded : null
  const pages = current && "pages" in current ? current.pages : null

  /*
    Odkaz z citácie (`#page-12`, `pageLink.ts`). Prehliadač kotvu hľadá hneď
    pri načítaní, keď strany ešte nie sú — posunie sa preto až po nich,
    a znova pri zmene kotvy na tej istej stránke.
  */
  const pageCount = pages?.length ?? 0
  useEffect(() => {
    if (!pageCount) return
    const go = () => {
      const n = pageFromHash(window.location.hash)
      if (n && n <= pageCount) document.getElementById(`page-${n}`)?.scrollIntoView({ block: "start" })
    }
    go()
    window.addEventListener("hashchange", go)
    return () => window.removeEventListener("hashchange", go)
  }, [pageCount])

  return (
    <div ref={boxRef} className="pdf-pages">
      {mounted && !current && <p className="pdf-pages-status quiet" role="status">{labels.loading}</p>}
      {current && "failed" in current && <p className="pdf-pages-status" role="alert">{labels.failed}</p>}
      {pages?.map((info, i) => (
        <PdfPage key={i} info={info} index={i} count={pages.length} containerWidth={width} label={labels.page} />
      ))}
    </div>
  )
}
