"use client"

/**
 * „Čo je na odpovedi zle" — vetva „Nesedí" v paneli pod odpoveďou.
 *
 * **Nezakladá vlastný záznam — dopisuje sa k tomu, ktorý už existuje.**
 * Každá dobehnutá odpoveď sa ukladá do `evaluations` (`recordAnswer()`), aj
 * keď ju nikto neposúdi: je tam otázka, odpoveď, zdroje aj citácie. Vlastná
 * kolekcia hlásení by tie isté údaje uložila druhýkrát a obe kópie by sa raz
 * rozišli. Preto sa posiela **len popis chyby** a identifikátor záznamu;
 * otázku a odpoveď netreba posielať z prehliadača, server ich už má.
 *
 * **Nie je zabalený vo `<details>`.** Do 2026-09-15 to bol samostatný
 * rozbaľovací riadok pod každou odpoveďou; odvtedy sa ukáže až vtedy, keď
 * človek klikne „Nesedí". Rozbaľovačka pod každou odpoveďou tvrdila, že
 * odpovede sú spravidla zlé; takto sa formulár objaví práve vtedy, keď má
 * čo zachytiť.
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

/**
 * Rovnaké číslo ako `MAX_READER_NOTE` v `lib/ratings.ts`, napísané druhýkrát
 * zámerne: `lib/ratings.ts` siaha na databázu a do klientskeho balíka sa
 * dostať nesmie. Autorita je server, toto je len zábrana v poli — rovnako
 * ako pri hodnotiacom paneli.
 */
const MAX_NOTE = 2000

export default function ReportInaccuracy({
  recordId: recordId,
  onSent: onSent,
  language,
}: {
  /** Záznam o odpovedi, ku ktorému sa hlásenie pripíše. */
  recordId: string
  /** Zavolá sa po úspešnom odoslaní — panel nad ním na to nadväzuje. */
  onSent?: () => void
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
      const r = await fetch("/api/rating", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: recordId, readerNote: note }),
      })
      const data = await r.json() as { ok?: boolean; error?: string }
      if (!r.ok || !data.ok) {
        setError(data.error || t.failed)
        setState("idle")
        return
      }
      setState("sent")
      onSent?.()
    } catch {
      setError(t.failed)
      setState("idle")
    }
  }

  if (state === "sent") {
    return <p className="quiet" style={{ fontSize: "var(--fs-small)", margin: "10px 0 0" }}>{t.thanks}</p>
  }

  return (
    <form onSubmit={send} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
      <label className="field" style={{ margin: 0 }}>
        <span className="field-label">{t.whatIsWrong}</span>
        <textarea
          className="field-input"
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t.placeholder}
          maxLength={MAX_NOTE}
          required
        />
        <span className="quiet field-hint">{t.note}</span>
      </label>
      {error && <p style={{ color: "var(--bad-fg)", fontSize: "var(--fs-small)", margin: 0 }}>{error}</p>}
      <div>
        <button className="button" type="submit" disabled={state === "sending" || !note.trim()}>
          {state === "sending" ? t.sending : t.submit}
        </button>
      </div>
    </form>
  )
}
