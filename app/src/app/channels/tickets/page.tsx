/**
 * /channels/tickets — moje tickety zo všetkých kanálov, kde som riešiteľ
 * (ADR-028 krok 4, D163, D167; pod Kanálmi od D170 — predtým `/helpdesk`).
 *
 * Vidí len tickety kanálov, ktorých je riešiteľom (`helpdeskContext()`).
 * Správca organizácie bez riešiteľstva sem nesmie (D170).
 */

import { notFound, redirect } from "next/navigation"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import TicketList, { ticketView } from "@/components/TicketList"
import { ChannelSectionTabs } from "@/components/ChannelTabs"
import { helpdeskContext } from "@/lib/helpdeskAgents"
import { listTickets } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function MyTicketsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await helpdeskContext()
  if (ctx.state !== "ready" || !ctx.channels.length) {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { msg, error, view: viewParam } = normalizeQuery<{ msg?: string; error?: string; view?: string }>(await searchParams)
  const view = ticketView(viewParam)
  const language = ctx.person.language
  const t = dictionary(language).helpdesk
  const tc = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const tickets = await listTickets(ctx.tenant.companyCode, ctx.channels.map(c => c.key), view)

  return (
    <AppShell language={language} title={tc.tabMyTickets}>
    <div style={{ maxWidth: 1100, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{tc.heading}</h1>
      </div>
      <ChannelSectionTabs current="/channels/tickets" isAgent language={language} />
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.intro}</p>
      <Notice message={msg} error={error === "1"} back="/channels/tickets" language={language} />
      <TicketList tickets={tickets} view={view} base="/channels/tickets" channelName={new Map(ctx.channels.map(c => [c.key, c.name]))}
        showChannel={ctx.channels.length > 1} personId={ctx.person.id} language={language} />
    </div>
    </AppShell>
  )
}
