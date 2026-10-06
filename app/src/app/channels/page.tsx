/**
 * /channels — kanály organizácie (ADR-028, D161, D169).
 *
 * Kanál je rozhranie, cez ktoré obsah ide k ľuďom — rovnaký pojem ako na
 * contineo.app/sk/technologia. Dva typy: **widget** (do cudzej stránky:
 * asistent, voliteľne tickety a schránka) a **portál** (články, knižnica,
 * formuláre — dnes len knižnica). Vstavané rozhrania intranetu (asistent,
 * knižnica) sú v zozname ako pevné riadky, aby bol obraz úplný.
 *
 * Spravuje správca organizácie (`orgContext()`), rovnako ako nastavenia.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import SubmitButton from "@/components/SubmitButton"
import { orgContext } from "@/lib/orgSettings"
import { listChannels, channelView, CHANNEL_KINDS } from "@/lib/channels"
import { ticketCounts } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { saveChannelAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await orgContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { msg, error, key, name, kind } = normalizeQuery<{ msg?: string; error?: string; key?: string; name?: string; kind?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const channels = (await listChannels(ctx.tenant.companyCode)).map(channelView)
  const counts = new Map(await Promise.all(channels.map(async c => [c.key, await ticketCounts(ctx.tenant.companyCode, c.key)] as const)))

  return (
    <AppShell language={language}>
    <div style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
        <span className="page-head-spacer" />
        <a className="button" href="#new">{t.newChannel}</a>
      </div>
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
              <Link href={`/channels/${encodeURIComponent(c.key)}`}><b>{c.name}</b></Link>
              <code>{c.key}</code>
              {c.mailbox && <span className="quiet">{c.mailbox.address}</span>}
              {c.tickets && <span className="quiet">{t.tickets(open, total)}</span>}
            </div>
          )
        })}
        <h3 className="detail-block-title" style={{ marginTop: 12 }}>{t.builtIn}</h3>
        <p className="quiet" style={{ margin: 0 }}><span className="tag">{t.kinds.widget}</span> {t.builtInAssistant}</p>
        <p className="quiet" style={{ margin: 0 }}><span className="tag">{t.kinds.portal}</span> {t.builtInPortal}</p>
      </section>

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
          <span className="field-label">{t.key}</span>
          <input className="field-input" name="key" required pattern="[a-z0-9][a-z0-9_]{1,60}" autoCapitalize="none" autoCorrect="off" defaultValue={key ?? ""} />
          <span className="quiet field-hint">{t.keyHint}</span>
        </label>
        <label className="field">
          <span className="field-label">{t.name}</span>
          <input className="field-input" name="name" required maxLength={120} defaultValue={name ?? ""} />
        </label>
        <div><SubmitButton className="button button--quiet">{t.save}</SubmitButton></div>
      </form>
    </div>
    </AppShell>
  )
}
