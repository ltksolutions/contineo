"use client"

/**
 * Dve polia na súbor pri nahrávaní znenia (ADR-011):
 *
 *   · **PDF — povinné.** To, čo uvidia schvaľovatelia a zamestnanci, vrátane
 *     príloh, formulárov a obrázkov (D94).
 *   · **Upraviteľný zdroj — odporúčaný.** `.docx`, `.xlsx`, `.md`… Z neho
 *     vznikne čistejší text na vyhľadávanie a je to **predloha pre ďalšie
 *     znenie** — správca si ho stiahne, upraví a nahrá ako novelu (D95).
 *
 * **Bez JavaScriptu** sú to obyčajné `<input type="file">` a formulár ich
 * odošle serverovej akcii celé — do 4 MB, viac Vercel v jednej požiadavke
 * nepustí.
 *
 * **S JavaScriptom** sa formulár pred odoslaním zastaví: súbory odídu po
 * kúskoch na `/api/library/upload` (do 25 MB, D98), ich identifikátory sa
 * zapíšu do skrytých polí, polia so súbormi stratia `name` (aby sa bajty
 * neposielali druhýkrát) a formulár sa odošle znova. Priebeh je skutočný —
 * prehliadač vie, koľko kúskov odoslal.
 */

import { useEffect, useRef, useState } from "react"
import { uploadInChunks } from "@/lib/chunkedUpload"

/** Doplní `{kľúč}` v šablóne. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, k: string) => (k in values ? String(values[k]) : all))
}

interface Labels {
  pdfTitle: string
  pdfNote: string
  sourceTitle: string
  sourceNote: string
  /** „najviac 25 MB" */
  maxSize: string
  /** „bez JavaScriptu najviac 4 MB" */
  noScriptLimit: string
  /** Šablóna — `{name}`, `{percent}`. Zo servera nesmie prísť funkcia. */
  uploading: string
  failed: string
  /** Šablóna — `{name}`, `{mb}`, `{maxMb}`. */
  tooLarge: string
}

export default function UploadFiles({
  labels,
  pdfAccept,
  sourceAccept,
  maxBytes,
  highlight = false,
}: {
  labels: Labels
  pdfAccept: string
  sourceAccept: string
  maxBytes: number
  /** Po chybe servera: súbor treba vybrať znova, zóny sa zvýraznia. */
  highlight?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const form = root.current?.closest("form")
    if (!form) return

    const onSubmit = async (e: SubmitEvent) => {
      const pdfInput = form.querySelector<HTMLInputElement>('input[data-upload="pdf"]')
      const sourceInput = form.querySelector<HTMLInputElement>('input[data-upload="source"]')
      const pdfId = form.querySelector<HTMLInputElement>('input[name="pdfFileId"]')
      const sourceId = form.querySelector<HTMLInputElement>('input[name="sourceFileId"]')
      if (!pdfInput || !pdfId || !sourceId) return
      // Druhé odoslanie — súbory sú už nahraté, nech ide serverovej akcii.
      if (pdfId.value) return

      const pdf = pdfInput.files?.[0]
      const source = sourceInput?.files?.[0]
      if (!pdf) return // povinnosť ohlási prehliadač (`required`) alebo server

      e.preventDefault()
      setError(null)
      const buttons = [...form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')]
      buttons.forEach(b => (b.disabled = true))

      try {
        const queue = [{ file: pdf, target: pdfId }, ...(source ? [{ file: source, target: sourceId }] : [])]
        for (const { file } of queue) {
          if (file.size > maxBytes) {
            throw new Error(fill(labels.tooLarge, { name: file.name, mb: Math.ceil(file.size / 1024 / 1024), maxMb: maxBytes / 1024 / 1024 }))
          }
        }
        const total = queue.reduce((n, q) => n + q.file.size, 0)
        let done = 0
        for (const { file, target } of queue) {
          const r = await uploadInChunks(file, sent => {
            const p = Math.round(((done + sent) / total) * 100)
            setPercent(p)
            setStatus(fill(labels.uploading, { name: file.name, percent: p }))
          })
          done += file.size
          target.value = r.fileId
        }
        // Bajty už sú na serveri — z formulára ich druhýkrát neposielať.
        pdfInput.removeAttribute("name")
        sourceInput?.removeAttribute("name")
        setStatus(null)
        setPercent(null)
        buttons.forEach(b => (b.disabled = false))
        form.requestSubmit(e.submitter instanceof HTMLButtonElement ? e.submitter : undefined)
      } catch (err) {
        pdfId.value = ""
        sourceId.value = ""
        setStatus(null)
        setPercent(null)
        setError(`${labels.failed} ${err instanceof Error ? err.message : ""}`.trim())
        buttons.forEach(b => (b.disabled = false))
      }
    }

    form.addEventListener("submit", onSubmit)
    return () => form.removeEventListener("submit", onSubmit)
  }, [labels, maxBytes])

  return (
    <div ref={root} className="upload-files">
      <input type="hidden" name="pdfFileId" defaultValue="" />
      <input type="hidden" name="sourceFileId" defaultValue="" />

      {/*
        Zóna na pretiahnutie je `<label>` okolo `<input type="file">` —
        prehliadač do neho súbor pustí sám, drag & drop funguje aj bez skriptu.
      */}
      <label className={`upload-drop${highlight ? " is-required" : ""}`}>
        <span className="upload-drop-title">{labels.pdfTitle}</span>
        <span className="quiet upload-drop-note">
          {labels.pdfNote}
          <br />
          {labels.maxSize} · {labels.noScriptLimit}
        </span>
        <input className="upload-file" type="file" name="pdf" data-upload="pdf" required accept={pdfAccept} />
      </label>

      <label className="upload-drop upload-drop--optional">
        <span className="upload-drop-title">{labels.sourceTitle}</span>
        <span className="quiet upload-drop-note">{labels.sourceNote}</span>
        <input className="upload-file" type="file" name="source" data-upload="source" accept={sourceAccept} />
      </label>

      <div className="upload-progress" role="status">
        {status && (
          <>
            <span className="upload-progress-bar upload-progress-bar--determinate" aria-hidden="true">
              <span style={{ width: `${percent ?? 0}%` }} />
            </span>
            <span className="quiet upload-progress-note">{status}</span>
          </>
        )}
      </div>
      {error && <p className="upload-error" role="alert">{error}</p>}
    </div>
  )
}
