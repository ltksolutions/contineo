"use client"

/**
 * Nahratie obrázka, galérie alebo videa do bloku kurzu (rám MANAGE-COURSE).
 *
 * Ten istý postup ako `UploadFiles` v knižnici: prvé odoslanie formulára sa
 * zastaví, súbory idú po kúskoch na `/api/learning/upload`, identifikátory
 * sa zapíšu do skrytých polí a formulár sa odošle znova serverovej akcii.
 * **Priebeh je modálne okno v strede** (`.upload-overlay`, rozhodnutie Jána
 * 23. 9. 2026) — v zóne sa nekreslí.
 *
 * Pri videu sa pred nahratím prečíta dĺžka (`durationSec`) z metadát
 * súboru — z nej sa počíta hranica povinného dopozerania (D119).
 */

import { useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { uploadInChunks } from "@/lib/chunkedUpload"

export interface CourseMediaUploadLabels {
  title: string
  note: string
  progressTitle: string
  /** Šablóna s `{name}` a `{percent}`. */
  uploading: string
  failed: string
  /** Šablóna s `{name}`, `{mb}`, `{maxMb}`. */
  tooLarge: string
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""))
}

function videoDuration(file: File): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const v = document.createElement("video")
    v.preload = "metadata"
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : 0) }
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
    v.src = url
  })
}

export default function CourseMediaUpload({ kind, accept, maxBytes, labels }: {
  kind: "image" | "gallery" | "video"
  accept: string
  maxBytes: number
  labels: CourseMediaUploadLabels
}) {
  const root = useRef<HTMLDivElement>(null)
  const done = useRef<{ ids: string; duration: string } | null>(null)
  const submitter = useRef<HTMLElement | null | undefined>(undefined)
  const [uploaded, setUploaded] = useState<{ ids: string; duration: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const form = useFormStatus()

  useEffect(() => {
    const el = root.current?.closest("form")
    if (!el) return
    const onSubmit = async (e: SubmitEvent) => {
      if (done.current) return
      const files = [...(el.querySelector<HTMLInputElement>('input[data-media="1"]')?.files ?? [])]
      if (!files.length) return // povinnosť ohlási server („Najprv nahrajte súbor.")
      e.preventDefault()
      setError(null)
      try {
        for (const f of files) {
          if (f.size > maxBytes) throw new Error(fill(labels.tooLarge, { name: f.name, mb: Math.ceil(f.size / 1048576), maxMb: maxBytes / 1048576 }))
        }
        const duration = kind === "video" ? await videoDuration(files[0]) : 0
        setBusy(true)
        const total = files.reduce((n, f) => n + f.size, 0)
        let sent = 0
        const ids: string[] = []
        for (const f of files) {
          const r = await uploadInChunks(f, s => {
            const p = Math.min(100, Math.round(((sent + s) / total) * 100))
            setPercent(p)
            setStatus(fill(labels.uploading, { name: f.name, percent: p }))
          }, "/api/learning/upload")
          sent += f.size
          ids.push(r.fileId)
        }
        const next = { ids: ids.join(","), duration: duration ? String(duration) : "" }
        done.current = next
        submitter.current = e.submitter
        setUploaded(next)
      } catch (err) {
        setBusy(false)
        setError(`${labels.failed} ${err instanceof Error ? err.message : ""}`.trim())
      }
    }
    el.addEventListener("submit", onSubmit)
    return () => el.removeEventListener("submit", onSubmit)
  }, [kind, labels, maxBytes])

  // Druhé odoslanie až po vykreslení skrytých polí s identifikátormi.
  useEffect(() => {
    if (!uploaded || submitter.current === undefined) return
    const el = root.current?.closest("form")
    const by = submitter.current
    submitter.current = undefined
    el?.requestSubmit(by instanceof HTMLButtonElement ? by : undefined)
  }, [uploaded])

  const showOverlay = busy || (form.pending && Boolean(uploaded))

  return (
    <div ref={root} className="cmu">
      <input type="hidden" name="fileIds" value={uploaded?.ids ?? ""} readOnly />
      <input type="hidden" name="durationSec" value={uploaded?.duration ?? ""} readOnly />
      <label className="upload-drop">
        <span className="upload-drop-title">{labels.title}</span>
        <span className="quiet upload-drop-note">{labels.note}</span>
        <input className="upload-file" type="file" data-media="1" accept={accept} multiple={kind === "gallery"} />
      </label>
      {error && <p className="upload-error" role="alert">{error}</p>}
      {showOverlay && (
        <div className="upload-overlay" role="dialog" aria-modal="true" aria-labelledby="cmu-title">
          <div className="upload-overlay-card">
            <h2 id="cmu-title" className="upload-overlay-title">{labels.progressTitle}</h2>
            <span className="upload-progress-bar upload-progress-bar--determinate" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
            <p className="quiet upload-overlay-note" aria-live="polite">{status}</p>
          </div>
        </div>
      )}
    </div>
  )
}
