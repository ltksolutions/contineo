/**
 * /channels — kanály organizácie (ADR-028, D161, D169).
 *
 * Kanál je rozhranie, cez ktoré obsah ide k ľuďom — rovnaký pojem ako na
 * contineo.app/sk/technologia. Dva typy: **widget** (do cudzej stránky:
 * asistent, voliteľne tickety a schránka) a **portál** (články, knižnica,
 * formuláre — dnes len knižnica). Vstavané rozhrania intranetu (asistent,
 * knižnica) sú v zozname ako pevné riadky, aby bol obraz úplný.
 *
 * Jedna položka v menu pre správcu aj riešiteľa (D170, Ján 7. 10. 2026):
 * správca organizácie vidí všetky kanály, vstavané rozhrania a formulár
 * nového kanála; riešiteľ len kanály, kde je riešiteľom. Počty ticketov
 * vidia obaja, obsah ticketov len riešiteľ (`/channels/tickets`).
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import SubmitButton from "@/components/SubmitButton"
import { channelsContext } from "@/lib/helpdeskAgents"
import { ChannelSectionTabs, channelHref } from "@/components/ChannelTabs"
import { channelView, CHANNEL_KINDS } from "@/lib/channels"
import { ticketCounts } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { saveChannelAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await channelsContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { msg, error, name, kind } = normalizeQuery<{ msg?: string; error?: string; name?: string; kind?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const channels = ctx.visible.map(channelView)
  const counts = new Map(await Promise.all(channels.map(async c => [c.key, await ticketCounts(ctx.tenant.companyCode, c.key)] as const)))

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
        <span className="page-head-spacer" />
        {ctx.isAdmin && <a className="button" href="#new">{t.newChannel}</a>}
      </div>
      <ChannelSectionTabs current="/channels" isAgent={ctx.agentChannels.length > 0} language={language} />
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.intro}</p>
      <Notice message={error ?? msg} error={Boolean(error)} back="/channels" language={language} />

      <section className="card detail-block">
        <h2 className="detail-block-title">{t.list}</h2>
        {channels.length === 0 && <p className="quiet" style={{ margin: 0 }}>{t.empty}</p>}
        {channels.map(c => {
          const n = counts.get(c.key)
          const total = n ? Object.values(n).reduce((a, b) => a + b, 0) : 0
          const open = n ? n.new + n.drafted + n.reopened : 0
          return (
            <div key={c.key} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span className="tag">{t.kinds[c.kind]}</span>
              <Link href={channelHref(c.key)}><b>{c.name}</b></Link>
              {ctx.isAdmin && <code>{c.key}</code>}
              {c.mailbox && <span className="quiet">{c.mailbox.address}</span>}
              {c.tickets && <span className="quiet">{t.tickets(open, total)}</span>}
            </div>
          )
        })}
        {ctx.isAdmin && (
          <>
            <h3 className="detail-block-title" style={{ marginTop: 12 }}>{t.builtIn}</h3>
            <p className="quiet" style={{ margin: 0 }}><span className="tag">{t.kinds.widget}</span> {t.builtInAssistant}</p>
            <p className="quiet" style={{ margin: 0 }}><span className="tag">{t.kinds.portal}</span> {t.builtInPortal}</p>
          </>
        )}
      </section>

      {ctx.isAdmin && (
      <form action={saveChannelAction} className="card detail-block" id="new">
        <h2 className="detail-block-title">{t.newChannel}</h2>
        <input type="hidden" name="isNew" value="1" />
        <div className="field">
          <span className="field-label">{t.kind}</span>
          <Select language={language} name="kind" fieldLabel={t.kind} initial={kind && (CHANNEL_KINDS as string[]).includes(kind) ? kind : "widget"}
            options={CHANNEL_KINDS.map(k => ({ value: k, label: t.kinds[k] }))} />
          <span className="quiet field-hint">{t.kindHints.widget} · {t.kindHints.portal}</span>
        </div>
        <label className="field">
          <span className="field-label">{t.name}</span>
          <input className="field-input" name="name" required maxLength={120} defaultValue={name ?? ""} />
        </label>
        <div><SubmitButton className="button button--quiet">{t.save}</SubmitButton></div>
      </form>
      )}
    </div>
    </AppShell>
  )
}
