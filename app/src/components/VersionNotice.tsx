"use client"

/**
 * Hláška „Je dostupná nová verzia" (Ján 28. 9. 2026).
 *
 * Karta otvorená pred nasadením posiela akcie **starej** verzii — pozvánka
 * tak odišla so starým textom, hoci nový bol v produkcii hodinu. Komponent
 * porovná revíziu, z ktorej sa stránka načítala, s tou, ktorá beží
 * (`/api/version`), pri návrate do karty a každých 5 minút. Lokálne je
 * revízia prázdna a nerobí nič.
 */

import { useEffect, useState } from "react"
import { REVISION } from "@/lib/appVersion"

const EVERY_MS = 5 * 60 * 1000

export default function VersionNotice({ text, reload }: { text: string; reload: string }) {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (!REVISION) return
    let stopped = false
    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return
      try {
        const r = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" })
        if (!r.ok) return
        const { revision } = (await r.json()) as { revision?: string }
        if (revision && revision !== REVISION) setStale(true)
      } catch {
        // Bez siete sa nič nehlási — hláška má byť istá, nie nervózna.
      }
    }
    void check()
    const timer = setInterval(check, EVERY_MS)
    document.addEventListener("visibilitychange", check)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", check)
    }
  }, [])

  if (!stale) return null
  return (
    <div className="version-notice" role="status">
      <span>{text}</span>
      <button type="button" className="button" onClick={() => location.reload()}>{reload}</button>
    </div>
  )
}
