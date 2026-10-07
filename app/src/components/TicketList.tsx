/**
 * Zoznam ticketov riešiteľa (ADR-028, D163; pod Kanálmi od D170).
 *
 * Ten istý zoznam na `/channels/tickets` (všetky moje kanály) aj na
 * `/channels/<kanál>/tickets` (jeden kanál). Prepínač pohľadu (`?view=`)
 * je sivý `.view-switch`: to isté zoznam, iné zoskupenie. Karty pod
 * 1024 px, tabuľka od 1024 px — vykreslí sa oboje, vyberá CSS
 * (`.doc-view-auto`).
 */

import Link from "next/link"
import { dictionary, formatDate, type UiLanguage } from "@/lib/i18n"
import type { TicketListItem } from "@/lib/tickets"

export const TICKET_VIEWS = ["open", "sent", "closed", "all"] as const
export type TicketView = (typeof TICKET_VIEWS)[number]

export function ticketView(raw: string | undefined): TicketView {
  return (TICKET_VIEWS as readonly string[]).includes(raw ?? "") ? (raw as TicketView) : "open"
}

export default function TicketList({ tickets, view, base, channelName, showChannel, personId, language }: {
  tickets: TicketListItem[]
  view: TicketView
  /** Adresa zoznamu — z nej sa skladá prepínač pohľadu. */
  base: string
  channelName: Map<string, string>
  /** Stĺpec kanála len v zozname cez viac kanálov. */
  showChannel: boolean
  personId: string
  language: UiLanguage
}) {
  const t = dictionary(language).helpdesk
  const viewLabel: Record<TicketView, string> = { open: t.viewOpen, sent: t.viewSent, closed: t.viewClosed, all: t.viewAll }
  const href = (id: string) => `/channels/tickets/${id}`
  const stateTag = (state: TicketListItem["state"]) => (
    <span className={`tag ${state === "sent" || state === "closed" ? "tag--published" : "tag--draft"}`}>{t.state[state]}</span>
  )
  return (
    <>
      <nav className="view-switch" aria-label={t.colState}>
        {TICKET_VIEWS.map(v => (
          <Link key={v} href={v === "open" ? base : `${base}?view=${v}`} className={`view-switch-item${v === view ? " is-on" : ""}`} aria-current={v === view ? "page" : undefined}>
            {viewLabel[v]}
          </Link>
        ))}
      </nav>

      {tickets.length === 0 && <p className="quiet" style={{ marginTop: 16 }}>{t.empty}</p>}

      <ul className="doc-cards doc-view-auto" style={{ marginTop: 16 }}>
        {tickets.map(x => (
          <li key={x.id} className="card" style={{ display: "grid", gap: 6 }}>
            <Link href={href(x.id)}><b>{x.subject || "—"}</b></Link>
            <span className="quiet">{x.askerName ?? x.askerEmail ?? "—"}{showChannel && <> · {channelName.get(x.channelKey) ?? x.channelKey}</>} · {t.source[x.source]}</span>
            <span className="quiet">
              {stateTag(x.state)}
              {" "}{formatDate(x.lastMessageAt, language)} · {x.messageCount}
              {x.assigneeId === personId && <> · {t.mine}</>}
            </span>
          </li>
        ))}
      </ul>

      {tickets.length > 0 && (
        <div className="doc-table-wrap doc-view-auto" style={{ marginTop: 16 }}>
          <table className="doc-table">
            <thead>
              <tr>
                <th className="doc-col-title">{t.colSubject}</th>
                <th>{t.colAsker}</th>
                {showChannel && <th>{t.colChannel}</th>}
                <th>{t.colState}</th>
                <th>{t.colMessages}</th>
                <th>{t.colUpdated}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(x => (
                <tr key={x.id}>
                  <td className="doc-col-title"><Link href={href(x.id)}>{x.subject || "—"}</Link>{x.assigneeId === personId && <span className="quiet"> · {t.mine}</span>}</td>
                  <td>{x.askerName ?? x.askerEmail ?? "—"}{!showChannel && <span className="quiet"> · {t.source[x.source]}</span>}</td>
                  {showChannel && <td>{channelName.get(x.channelKey) ?? x.channelKey} <span className="quiet">· {t.source[x.source]}</span></td>}
                  <td>{stateTag(x.state)}</td>
                  <td>{x.messageCount}</td>
                  <td>{formatDate(x.lastMessageAt, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
