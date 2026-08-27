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

type Stav = "ready" | "sending" | "done" | "error"

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
  const [stav, setStav] = useState<Stav>("ready")
  const [reason, setReason] = useState<string>("")
  const router = useRouter()

  async function odosli() {
    setStav("sending")
    try {
      const r = await fetch("/api/acknowledgements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      })
      const data = await r.json().catch(() => ({}))
      if (r.ok && data.ok) {
        setStav("done")
        // Zoznam aj hlavička sa musia obnoviť zo servera — stav sa nikde
        // neukladá, odvodzuje sa (D27), takže ho nemá zmysel dopočítavať tu.
        router.refresh()
        return
      }
      setReason(String(data.reason ?? "write-failed"))
      setStav("error")
    } catch {
      setReason("write-failed")
      setStav("error")
    }
  }

  if (stav === "done") {
    return <p className="stitok" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
      {labels.confirmed}
    </p>
  }

  return (
    <div>
      <button
        className="tlacidlo"
        onClick={odosli}
        disabled={stav === "sending"}
        style={{ minWidth: 180 }}
      >
        {stav === "sending" ? labels.pending : labels.button}
      </button>

      {stav === "error" && (
        <p style={{ color: "var(--bad-fg)", fontSize: 14, marginTop: 12 }}>
          {labels.error[reason] ?? labels.error["write-failed"]}
        </p>
      )}
    </div>
  )
}
