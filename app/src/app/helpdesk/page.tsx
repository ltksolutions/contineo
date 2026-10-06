/**
 * /helpdesk — fronta ticketov riešiteľa (ADR-028 krok 4, D163, D167).
 *
 * Vidí len tickety kanálov, ktorých je riešiteľom (`helpdeskContext()`).
 * Prepínač pohľadu (`?view=`) je sivý `.view-switch`: to isté zoznam, iné
 * zoskupenie (CLAUDE.md). Karty pod 1024 px, tabuľka od 1024 px — oboje sa
 * vykreslí, vyberá CSS (`.doc-view-auto`).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import { helpdeskContext } from "@/lib/helpdeskAgents"
import { listTickets } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

const VIEWS = ["open", "sent", "closed", "all"] as const
type View = (typeof VIEWS)[number]

export default async function HelpdeskPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await helpdeskContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { msg, error, view: viewParam } = normalizeQuery<{ msg?: string; error?: string; view?: string }>(await searchParams)
  const view: View = (VIEWS as readonly string[]).includes(viewParam ?? "") ? (viewParam as View) : "open"
  const language = ctx.person.language
  const t = dictionary(language).helpdesk
  const branding = brandingView(ctx.tenant)
  const keys = ctx.channels.map(c => c.key)
  const channelName = new Map(ctx.channels.map(c => [c.key, c.name]))
  const tickets = await listTickets(ctx.tenant.companyCode, keys, view)
  const viewLabel: Record<View, string> = { open: t.viewOpen, sent: t.viewSent, closed: t.viewClosed, all: t.viewAll }

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 1100, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.intro}</p>
      <Notice message={msg} error={error === "1"} back="/helpdesk" />

      {ctx.channels.length === 0 ? (
        <div className="empty"><p className="empty-text">{t.noChannels}</p></div>
      ) : (
        <>
          <nav className="view-switch" aria-label={t.colState}>
            {VIEWS.map(v => (
              <Link key={v} href={v === "open" ? "/helpdesk" : `/helpdesk?view=${v}`} className={`view-switch-item${v === view ? " is-on" : ""}`} aria-current={v === view ? "page" : undefined}>
                {viewLabel[v]}
              </Link>
            ))}
          </nav>

          {tickets.length === 0 && <p className="quiet" style={{ marginTop: 16 }}>{t.empty}</p>}

          <ul className="doc-cards doc-view-auto" style={{ marginTop: 16 }}>
            {tickets.map(x => (
              <li key={x.id} className="card" style={{ display: "grid", gap: 6 }}>
                <Link href={`/helpdesk/${x.id}`}><b>{x.subject || "—"}</b></Link>
                <span className="quiet">{x.askerName ?? x.askerEmail ?? "—"} · {channelName.get(x.channelKey) ?? x.channelKey} · {t.source[x.source]}</span>
                <span className="quiet">
                  <span className={`tag ${x.state === "sent" || x.state === "closed" ? "tag--published" : "tag--draft"}`}>{t.state[x.state]}</span>
                  {" "}{formatDate(x.lastMessageAt, language)} · {x.messageCount}
                  {x.assigneeId === ctx.person.id && <> · {t.mine}</>}
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
                  <th>{t.colChannel}</th>
                  <th>{t.colState}</th>
                  <th>{t.colMessages}</th>
                  <th>{t.colUpdated}</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(x => (
                  <tr key={x.id}>
                    <td className="doc-col-title"><Link href={`/helpdesk/${x.id}`}>{x.subject || "—"}</Link>{x.assigneeId === ctx.person.id && <span className="quiet"> · {t.mine}</span>}</td>
                    <td>{x.askerName ?? x.askerEmail ?? "—"}</td>
                    <td>{channelName.get(x.channelKey) ?? x.channelKey} <span className="quiet">· {t.source[x.source]}</span></td>
                    <td><span className={`tag ${x.state === "sent" || x.state === "closed" ? "tag--published" : "tag--draft"}`}>{t.state[x.state]}</span></td>
                    <td>{x.messageCount}</td>
                    <td>{formatDate(x.lastMessageAt, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}
    </div>
    </AppShell>
  )
}
