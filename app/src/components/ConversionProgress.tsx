"use client"

/**
 * ConversionProgress.tsx — priebeh prevodu modelom bez obnovovania stránky
 * (ADR-046; Ján 3. 11. 2026: „priebežne ukazovať info o každom kroku,
 * nečakať na stlačenie Obnoviť").
 *
 * Každé 4 s sa opýta na stav a prepíše vetu; keď beh skončí, stránku
 * obnoví server (`router.refresh()`) — objaví sa text od modelu a kontrola
 * slov. Kým je karta v pozadí, nepýta sa.
 *
 * **Bez JavaScriptu** ostáva veta z prvého vykreslenia a odkaz „Obnoviť"
 * (`<noscript>`); so skriptom ho netreba.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { ConversionNote } from "@/lib/conversionNote"

const POLL_MS = 4000

export default function ConversionProgress({
  documentId,
  initial,
  refreshLabel,
}: {
  documentId: string
  initial: ConversionNote
  refreshLabel: string
}) {
  const router = useRouter()
  const [note, setNote] = useState(initial)

  useEffect(() => {
    let stopped = false
    const timer = setInterval(async () => {
      if (stopped || document.hidden) return
      try {
        const r = await fetch(`/api/library/conversion/${encodeURIComponent(documentId)}`, { cache: "no-store" })
        if (!r.ok) return
        const body = await r.json() as { running: boolean; note: ConversionNote | null }
        if (body.note) setNote(body.note)
        if (!body.running) {
          stopped = true
          clearInterval(timer)
          router.refresh()
        }
      } catch {
        // Výpadok spojenia — ďalší pokus o 4 s.
      }
    }, POLL_MS)
    return () => { stopped = true; clearInterval(timer) }
  }, [documentId, router])

  return (
    <div className="lnote lnote--info lnote--action" role="status" aria-live="polite" style={{ margin: "0 0 16px" }}>
      <span className="lnote-mark" aria-hidden="true">i</span>
      <span className="lnote-text">
        <strong>{note.text}</strong><br />
        {note.detail}
      </span>
      <noscript>
        <a className="button button--quiet button--sm" href={`/library/${encodeURIComponent(documentId)}/text`}>{refreshLabel}</a>
      </noscript>
    </div>
  )
}
