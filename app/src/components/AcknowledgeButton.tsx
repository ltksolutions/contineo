"use client"

/**
 * Potvrdzovacie tlačidlo.
 *
 * Klientský komponent, lebo potrebuje stav odosielania — človek musí vidieť,
 * že sa niečo deje, inak klikne druhýkrát. Druhý klik síce nič nepokazí
 * (unikátny index, D24), ale ticho po prvom kliku vyzerá ako pokazená stránka.
 *
 * Do požiadavky ide **len `documentId`**. Verziu aj znenie určuje server.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"

type Status = "ready" | "sending" | "done" | "error"

export default function AcknowledgeButton({
  documentId,
  labels,
}: {
  documentId: string
  labels: {
    button: string
    pending: string
    confirmed: string
    error: Record<string, string>
  }
}) {
  const [status, setStatus] = useState<Status>("ready")
  const [reason, setReason] = useState<string>("")
  const router = useRouter()

  async function submit() {
    setStatus("sending")
    try {
      const r = await fetch("/api/acknowledgements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.ok) {
        setStatus("done")
        // Zoznam aj hlavička sa musia obnoviť zo servera — stav sa nikde
        // neukladá, odvodzuje sa (D27), takže ho nemá zmysel dopočítavať tu.
        router.refresh()
        return
      }
      setReason(String(data.reason ?? "write-failed"))
      setStatus("error")
    } catch {
      setReason("write-failed")
      setStatus("error")
    }
  }

  if (status === "done") {
    return <p className="stitok" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
      {labels.confirmed}
    </p>
  }

  return (
    <div>
      <button
        className="tlacidlo"
        onClick={submit}
        disabled={status === "sending"}
        style={{ minWidth: 180 }}
      >
        {status === "sending" ? labels.pending : labels.button}
      </button>

      {status === "error" && (
        <p style={{ color: "var(--bad-fg)", fontSize: 14, marginTop: 12 }}>
          {labels.error[reason] ?? labels.error["write-failed"]}
        </p>
      )}
    </div>
  )
}
