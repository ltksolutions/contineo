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
 * správca organizácie vidí všetky kanály, vstavané rozhrania a nový kanál;
 * riešiteľ len kanály, kde je riešiteľom. Počty ticketov vidia obaja,
 * obsah ticketov len riešiteľ (`/channels/tickets`).
 *
 * Tvar podľa návrhu KANALY-prehlad (8. 10. 2026): kanály ako `List` —
 * celý riadok je odkaz na rozcestník kanála, kľúč (UUID) sa nekreslí;
 * vstavané rozhrania sú samostatná skupina bez odkazov; nový kanál je
 * úloha cez adresu `?new=1`, nie vždy otvorený formulár.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Icon from "@/components/Icon"
import SubmitButton from "@/components/SubmitButton"
import { channelsContext } from "@/lib/helpdeskAgents"
import { ChannelSectionTabs, channelHref } from "@/components/ChannelTabs"
import { channelView, channelAccessLevel, mailboxStalled, CHANNEL_KINDS, type ChannelKind } from "@/lib/channels"
import { ticketCounts } from "@/lib/tickets"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { saveChannelAction } from "./actions"

export const dynamic = "force-dynamic"

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await channelsContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { msg, error, name, kind, new: openNew } = normalizeQuery<{ msg?: string; error?: string; name?: string; kind?: string; new?: string }>(await searchParams)
  const language = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const channels = ctx.visible.map(channelView)
  const counts = new Map(await Promise.all(channels.map(async c => [c.key, await ticketCounts(ctx.tenant.companyCode, c.key)] as const)))
  const creating = ctx.isAdmin && openNew === "1"
  const pickedKind: ChannelKind = kind && (CHANNEL_KINDS as string[]).includes(kind) ? kind as ChannelKind : "widget"
  const now = new Date()

  return (
    <AppShell language={language}>
    <div className="page-narrow page-narrow--wide channels-page" style={tenantStyle(branding)}>
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
        <span className="page-head-spacer" />
        {/* Otvorená úloha prevezme plné tlačidlo (P10). */}
        {ctx.isAdmin && !creating && <Link className="button" href="/channels?new=1">{t.newChannel}</Link>}
      </div>
      <ChannelSectionTabs current="/channels" isAgent={ctx.agentChannels.length > 0} language={language} />
      <p className="quiet page-lead channels-lead">{ctx.isAdmin ? t.intro : t.introAgent}</p>
      {/* Chyba nového kanála sa ukáže v jeho karte; tu len ostatné správy. */}
      {!creating && <Notice message={error ?? msg} error={Boolean(error)} back="/channels" language={language} />}

      {creating && (
        <form action={saveChannelAction} className="card task-card">
          <input type="hidden" name="isNew" value="1" />
          <h2>{t.newChannel}</h2>
          <p className="quiet">{t.newIntro}</p>
          {error && (
            <div className="lnote lnote--bad" role="alert"><span className="lnote-mark" aria-hidden="true">!</span><span className="lnote-text">{error}</span></div>
          )}
          {/* Jedna z dvoch: Picker(.inline), riadky s fajkou a vysvetlením. */}
          <fieldset className="form-group">
            <legend className="form-group-head">{t.kind}</legend>
            <div className="card form-group-body form-group-body--rows">
              <div className="form-list">
                {CHANNEL_KINDS.map(k => (
                  <label key={k} className="form-row choice-row">
                    <input type="radio" name="kind" value={k} defaultChecked={k === pickedKind} />
                    <span className="form-row-main"><span>{t.kinds[k]}</span><span className="form-row-sub">{t.kindHints[k]}</span></span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
          <label className="field">
            <span className="field-label">{t.name}</span>
            <input className="field-input" name="name" required maxLength={120} defaultValue={name ?? ""} />
            <span className="quiet field-hint">{t.nameHint}</span>
          </label>
          <div className="task-acts">
            <SubmitButton className="button">{t.create}</SubmitButton>
            <Link className="button button--quiet" href="/channels">{t.cancelNew}</Link>
          </div>
        </form>
      )}

      <section className="form-group">
        <h2 className="form-group-head">{t.list}</h2>
        {channels.length === 0 ? (
          <div className="card empty">
            <div className="empty-title">{t.emptyTitle}</div>
            <div className="empty-text">{t.emptyText}</div>
          </div>
        ) : (
          <div className="card form-group-body form-group-body--rows">
            <div className="form-list">
              {channels.map(c => {
                const n = counts.get(c.key)
                const open = n ? n.new + n.drafted + n.reopened : 0
                const stalled = c.mailbox ? mailboxStalled(c.mailbox, now) : false
                const sub = [
                  t.kinds[c.kind],
                  c.mailbox?.address,
                  ctx.isAdmin ? t.levels[channelAccessLevel(c)] : null,
                ].filter(Boolean).join(" · ")
                const stalledTitle = c.mailbox?.lastSyncError
                  ? t.syncError(c.mailbox.lastSyncError)
                  : c.mailbox?.lastSyncAt ? t.syncLast(formatDate(c.mailbox.lastSyncAt, language)) : undefined
                const tags = (
                  <>
                    {/* Štítok o schránke vidí aj riešiteľ (Q3) — vie to nahlásiť. */}
                    {stalled && <span className="tag tag--expired" title={stalledTitle}>{t.mailboxStalled}</span>}
                    {ctx.isAdmin && c.tickets && open > 0 && <span className="tag tag--draft">{t.openCount(open)}</span>}
                  </>
                )
                return (
                  <Link key={c.key} className="form-row channel-row" href={channelHref(c.key)}>
                    <span className="channel-ico" aria-hidden="true"><Icon name={c.kind === "widget" ? "ask" : "library"} size={18} /></span>
                    <span className="form-row-main">
                      <b>{c.name}</b>
                      <span className="form-row-sub">{sub}</span>
                      <span className="channel-tags channel-tags--below">{tags}</span>
                    </span>
                    <span className="channel-tags channel-tags--end">{tags}</span>
                    {/* Riešiteľ: počet otvorených ticketov je hlavný údaj (Q5 návrhu). */}
                    {!ctx.isAdmin && (
                      <span className={`channel-count${open ? "" : " is-zero"}`}><b>{open}</b><span>{t.openLabel(open)}</span></span>
                    )}
                    <span className="channel-chev" aria-hidden="true">›</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Vstavané rozhrania — pevné riadky, aby bol obraz úplný (D169). */}
      {ctx.isAdmin && (
        <section className="form-group">
          <h2 className="form-group-head">{t.builtIn}</h2>
          <div className="card form-group-body form-group-body--rows">
            <div className="form-list">
              {([["widget", "ask", t.builtInAssistant, t.builtInAssistantSub], ["portal", "library", t.builtInPortal, t.builtInPortalSub]] as const).map(([k, icon, title, detail]) => (
                <div key={k} className="form-row channel-row channel-row--fixed">
                  <span className="channel-ico is-off" aria-hidden="true"><Icon name={icon} size={18} /></span>
                  <span className="form-row-main">
                    <b>{title}</b>
                    <span className="form-row-sub">{t.kinds[k]} · {detail}</span>
                  </span>
                  <span className="quiet channel-fixed">{t.builtInFixed}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
    </AppShell>
  )
}
