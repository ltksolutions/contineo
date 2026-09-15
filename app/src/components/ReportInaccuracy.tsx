"use client"

/**
 * „Nahlásiť nepresnosť" pod odpoveďou.
 *
 * **Zabalené v `<details>`, nie vždy otvorené.** Formulár pod každou
 * odpoveďou by tvrdil, že odpovede sú spravidla zlé; zavretý riadok hovorí
 * „keď je niečo mimo, povedz to" a nezaberá miesto tomu, kvôli čomu sa sem
 * človek prišiel pozrieť.
 *
 * **Vyžaduje JavaScript a je to v poriadku** — na rozdiel od knižnice, ktorá
 * beží aj bez neho. Obrazovka s odpoveďou ho vyžaduje tak či tak: odpoveď sa
 * streamuje. Formulár bez skriptu by tu nemal čo odoslať.
 *
 * Po odoslaní sa **odpoveď nestratí**: nič sa nepresmeruje, len sa vymení
 * obsah tohto bloku za poďakovanie. Kto hlási nepresnosť, má ju stále pred
 * očami — aj preto, aby vedel, že poslal to, čo videl.
 */

import { useState } from "react"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import type { AnswerSource } from "@/lib/sseClient"

export default function ReportInaccuracy({
  question: question,
  answer: answer,
  sources: sources,
  language,
}: {
  question: string
  answer: string
  sources: AnswerSource[]
  language?: UiLanguage
}) {
  const t = dictionary(language).report
  const [note, setNote] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [error, setError] = useState("")

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim() || state === "sending") return
    setState("sending")
    setError("")
    try {
      const r = await fetch("/api/answer-report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: question,
          answer: answer,
          note: note,
          // Zdroje sa posielajú **orezané na to podstatné**: názov, článok
          // a odkaz. Celý objekt zo streamu by niesol aj polia, ktoré
          // s hlásením nesúvisia.
          sources: sources.map(s => ({ title: s.title, articleRef: s.articleRef, url: s.url })),
        }),
      })
      const data = await r.json() as { ok?: boolean; error?: string }
      if (!r.ok || !data.ok) {
        setError(data.error || t.failed)
        setState("idle")
        return
      }
      setState("sent")
    } catch {
      setError(t.failed)
      setState("idle")
    }
  }

  if (state === "sent") {
    return <p className="quiet" style={{ fontSize: 13.5, margin: "10px 0 0" }}>{t.thanks}</p>
  }

  return (
    <details style={{ marginTop: 10 }}>
      <summary className="quiet" style={{ cursor: "pointer", fontSize: 13.5 }}>
        {t.open}
      </summary>
      <form onSubmit={send} style={{ display: "grid", gap: 8, marginTop: 10, maxWidth: 560 }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">{t.whatIsWrong}</span>
          <textarea
            className="field-input"
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t.placeholder}
            required
          />
          <span className="quiet field-hint">{t.note}</span>
        </label>
        {error && <p style={{ color: "var(--bad-fg)", fontSize: 13.5, margin: 0 }}>{error}</p>}
        <div>
          <button className="button" type="submit" disabled={state === "sending" || !note.trim()}>
            {state === "sending" ? t.sending : t.submit}
          </button>
        </div>
      </form>
    </details>
  )
}
