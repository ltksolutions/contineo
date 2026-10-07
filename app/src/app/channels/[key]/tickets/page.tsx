/**
 * /channels/[key]/tickets — tickety jedného kanála (D170).
 *
 * Len riešiteľ tohto kanála. Správca organizácie obsah ticketov nevidí,
 * ani keď kanál spravuje — dostane 404, nie prázdny zoznam (D170).
 */

import { notFound, redirect } from "next/navigation"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import TicketList, { ticketView } from "@/components/TicketList"
import { ChannelPartTabs, channelHref } from "@/components/ChannelTabs"
import { channelsContext } from "@/lib/helpdeskAgents"
import { listTickets } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"

export const dynamic = "force-dynamic"

export default async function ChannelTicketsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await channelsContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const key = decodeURIComponent((await params).key)
  const channel = ctx.agentChannels.find(c => c.key === key)
  if (!channel) notFound()
  const { msg, error, view: viewParam } = normalizeQuery<{ msg?: string; error?: string; view?: string }>(await searchParams)
  const view = ticketView(viewParam)
  const language = ctx.person.language
  const t = dictionary(language).helpdesk
  const tc = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const base = channelHref(key, "tickets")
  const tickets = await listTickets(ctx.tenant.companyCode, [key], view)

  return (
    <AppShell language={language} title={tc.tabTickets} trail={{ [channelHref(key)]: channel.name }}>
    <div style={{ maxWidth: 1100, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{channel.name}</h1>
        <span className="page-head-spacer" />
        <span className="tag">{tc.kinds[channel.kind]}</span>
      </div>
      <ChannelPartTabs channelKey={key} current={base} canTickets canSettings={ctx.isAdmin} language={language} />
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.intro}</p>
      <Notice message={msg} error={error === "1"} back={base} language={language} />
      <TicketList tickets={tickets} view={view} base={base} channelName={new Map([[key, channel.name]])}
        showChannel={false} personId={ctx.person.id} language={language} />
    </div>
    </AppShell>
  )
}
