"use client"

/**
 * CourierLive — živé spojenie Kuriéra v prehliadači (ADR-033, D210).
 *
 * `EventSource` na `/api/courier/stream`: server ho po 55 s zavrie
 * a prehliadač sa pripojí sám. Tri druhy udalostí: počet neprečítaných
 * (ide obálke v hlavičke cez `courier:unread`), nová správa vo vlákne
 * (dokreslí sa pod tie zo servera) a stav ostatných („píše…", „prečítané").
 *
 * Bez JavaScriptu sa nič z toho nedeje a stránka ostáva celá — toto je
 * vrstva nad ňou, nie jej náhrada. Mimo Kuriéra sa komponent nekreslí,
 * takže spojenie inde nedrží (Ján, 12. 10. 2026).
 */

import { useEffect, useRef, useState } from "react"
import FormattedText from "./FormattedText"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import type { LiveEvent } from "@/lib/courierLive"
import LinkPreviews from "@/components/LinkPreviews"
import { SEARCH_TIME_ZONE } from "@/lib/versionContext"

/** Meno udalosti, ktorou obálka v hlavičke dostane nový počet. */
export const UNREAD_EVENT = "courier:unread"

type LiveMessage = Extract<LiveEvent, { type: "message" }>
type Others = Extract<LiveEvent, { type: "status" }>["others"]

function when(iso: string, language: UiLanguage): string {
  return new Date(iso).toLocaleString(language === "en" ? "en-GB" : language, {
    timeZone: SEARCH_TIME_ZONE, day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export default function CourierLive({
  threadId,
  me,
  since,
  language,
  direct,
  initialReadAt,
}: {
  /** Bez vlákna (zoznam) ide spojenie len pre počet na obálke. */
  threadId?: string
  me: string
  /** Čas poslednej správy zo servera — stream pošle len novšie. */
  since?: string
  language: UiLanguage
  /** 1:1 vlákno: ukazuje sa „píše…" a „prečítané" (D206). */
  direct?: boolean
  initialReadAt?: string | null
}) {
  const t = dictionary(language).courier
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [others, setOthers] = useState<Others | null>(null)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    const q = new URLSearchParams()
    if (threadId) q.set("thread", threadId)
    if (since) q.set("since", since)
    const es = new EventSource(`/api/courier/stream?${q.toString()}`)
    es.onmessage = ev => {
      let e: LiveEvent
      try { e = JSON.parse(ev.data) } catch { return }
      if (e.type === "unread") {
        window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: e.count }))
      } else if (e.type === "message") {
        if (seen.current.has(e.id)) return
        seen.current.add(e.id)
        setMessages(prev => [...prev, e])
        // Správa je pred očami — vlákno nech vypadne z neprečítaných aj bez
        // obnovenia stránky. Vlastné správy sú prečítané už zápisom.
        if (threadId && e.author.personId !== me && document.visibilityState === "visible") {
          fetch("/api/courier/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thread: threadId }) }).catch(() => {})
        }
      } else if (e.type === "status") {
        setOthers(e.others)
      }
    }
    return () => es.close()
  }, [threadId, since, me])

  if (!threadId) return null

  const other = direct ? others?.[0] : null
  const readAt = other ? other.lastReadAt : initialReadAt ?? null
  const typing = others?.filter(o => o.typing) ?? []

  return (
    <>
      {messages.map(m => {
        const mine = m.author.personId === me
        return (
          <article key={m.id} className={`thread-msg${mine ? " thread-msg--out" : ""}`}>
            <p className="quiet thread-msg-head"><b>{mine ? t.you : m.author.name}</b> · {when(m.at, language)}</p>
            <div style={{ lineHeight: 1.6, overflowWrap: "anywhere" }}><FormattedText text={m.text} external /></div>
            <LinkPreviews previews={m.previews} />
          </article>
        )
      })}
      {(direct || typing.length > 0) && (
        <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)", textAlign: "right" }} aria-live="polite">
          {typing.length > 0
            ? t.typing(typing.map(o => o.name).join(", "))
            : direct
              ? (readAt ? t.readAt(when(readAt, language)) : t.notReadYet)
              : null}
        </p>
      )}
    </>
  )
}

/**
 * „Píše…" smerom von: počúva pole odpovede (podľa `id`) a najviac raz za
 * 3 s pošle serveru, že sa píše. Bez JS niet písania naživo — a to je v poriadku.
 */
export function TypingSignal({ threadId, fieldId }: { threadId: string; fieldId: string }) {
  useEffect(() => {
    const field = document.getElementById(fieldId)
    if (!field) return
    let last = 0
    const onInput = () => {
      const now = Date.now()
      if (now - last < 3_000) return
      last = now
      fetch("/api/courier/typing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ thread: threadId }) }).catch(() => {})
    }
    field.addEventListener("input", onInput)
    return () => field.removeEventListener("input", onInput)
  }, [threadId, fieldId])
  return null
}
