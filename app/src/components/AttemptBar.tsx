"use client"

/**
 * Lišta pokusu (rám TEST-ATTEMPT): „Otázka 7 / 20" · odpočet · stav
 * ukladania · pás postupu. Sticky pod hlavičkou.
 *
 * Čas počíta **server** (`deadlineAt`), lišta ho len zobrazuje; pod 5 min
 * výstraha, pod 1 min chyba, po limite sa stránka obnoví a server pokus
 * uzavrie. Odpoveď sa ukladá každých 30 s (formulár pokusu → API), pri
 * „Ďalej" ju uloží odoslanie formulára.
 */

import { useCallback, useEffect, useRef, useState } from "react"

const SAVE_EVERY_MS = 30_000

export interface AttemptBarLabels {
  position: string
  /** Šablóna s `{t}`. */
  remaining: string
  saving: string
  /** Šablóna s `{t}`. */
  saved: string
  failed: string
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`
}

export default function AttemptBar({ deadlineAt, formId, saveUrl, progress, labels }: {
  deadlineAt: string | null
  formId: string
  saveUrl: string
  /** 0–1, pomer zodpovedaných. */
  progress: number
  labels: AttemptBarLabels
}) {
  const [now, setNow] = useState<number | null>(null)
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle")
  const [savedAt, setSavedAt] = useState("")
  const last = useRef("")

  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  const save = useCallback(async () => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return
    const fd = new FormData(form)
    const snapshot = JSON.stringify([...fd.getAll("a")])
    if (snapshot === last.current) return
    setState("saving")
    try {
      const r = await fetch(saveUrl, { method: "POST", body: fd })
      if (r.status === 409) { location.reload(); return }
      if (!r.ok) throw new Error(String(r.status))
      last.current = snapshot
      setSavedAt(new Date().toLocaleTimeString(document.documentElement.lang || "sk", { hour: "2-digit", minute: "2-digit" }))
      setState("saved")
    } catch {
      setState("failed")
    }
  }, [formId, saveUrl])

  useEffect(() => {
    const t = setInterval(save, SAVE_EVERY_MS)
    return () => clearInterval(t)
  }, [save])

  const left = deadlineAt && now !== null ? new Date(deadlineAt).getTime() - now : null
  useEffect(() => {
    // Po limite: obnoviť — server pokus uzavrie a ukáže „čas vypršal".
    if (left !== null && left <= 0) location.reload()
  }, [left])

  const tone = left === null ? "" : left < 60_000 ? " is-bad" : left < 5 * 60_000 ? " is-warn" : ""
  return (
    <div className="abar" role="status">
      <span className="abar-pos">{labels.position}</span>
      {left !== null && <span className={`abar-time${tone}`}>{labels.remaining.replace("{t}", mmss(left))}</span>}
      <span className={`abar-save${state === "failed" ? " is-warn" : ""}`} aria-live="polite">
        {state === "saving" ? labels.saving : state === "saved" ? labels.saved.replace("{t}", savedAt) : state === "failed" ? labels.failed : ""}
      </span>
      <span className="abar-track" aria-hidden="true"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
    </div>
  )
}
