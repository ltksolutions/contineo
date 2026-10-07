/**
 * /channels/[key] — nastavenie jedného kanála (ADR-028, D161, D169).
 *
 * Formulár podľa typu: **widget** má obsah, riešiteľov, tickety, schránku
 * a vloženie (pôvody, strop, tajomstvo); **portál** má obsah, publikum
 * a jazyky — články a formuláre sa pripravujú. Tajomstvá sa na obrazovku
 * nedostanú (`channelView`); nové tajomstvo widgetu sa ukáže raz zo servera.
 */

import { notFound, redirect } from "next/navigation"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import MultiSelect from "@/components/MultiSelect"
import SubmitButton from "@/components/SubmitButton"
import { orgContext } from "@/lib/orgSettings"
import { channelByKey, channelView, takeRevealedWidgetSecret, HELPDESK_ROLE, DEFAULT_RATE_LIMIT } from "@/lib/channels"
import { allFolders, flattenTree } from "@/lib/folders"
import { listPeople } from "@/lib/people"
import { treeOptions } from "@/lib/treeOptions"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { DEFAULT_HISTORY_LIMIT } from "@/lib/faqMining"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { UI_LANGUAGES, dictionary, formatDate } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { saveChannelAction, removeChannelAction, verifyMailboxAction, syncChannelAction, rotateWidgetSecretAction, mineFaqAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function ChannelPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await orgContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { key } = await params
  const { msg, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const raw = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!raw) notFound()
  const c = channelView(raw)
  const language = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const base = `/channels/${encodeURIComponent(c.key)}`
  const isWidget = c.kind === "widget"

  const [folders, people, faqDocs, revealed] = await Promise.all([
    allFolders(ctx.tenant.companyCode),
    listPeople(ctx.tenant.companyCode),
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, category: "faq" }, { projection: { documentId: 1, title: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string }[]>,
    isWidget && c.widget.revealOnce ? takeRevealedWidgetSecret(ctx.tenant.companyCode, c.key) : Promise.resolve(null),
  ])
  const folderOptions = treeOptions(flattenTree(folders).map(r => ({ id: r.folder.id, name: r.folder.name, level: r.level })))
  const agentOptions = people.filter(p => p.roles.includes(HELPDESK_ROLE)).map(p => ({ value: p.id, label: `${p.fullName} (${p.email})` }))
  const faqOptions = faqDocs.map(x => ({ value: x.documentId, label: String(x.title ?? x.documentId) }))

  return (
    <AppShell language={language} title={c.name} trail={{ "/channels": t.heading }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{c.name}</h1>
        <span className="page-head-spacer" />
        <span className="tag">{t.kinds[c.kind]}</span>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.kindHints[c.kind]}</p>
      <Notice message={msg} error={error === "1"} back={base} language={language} />

      <form action={saveChannelAction} className="card set-form" id="channel">
        <input type="hidden" name="isNew" value="0" />
        <input type="hidden" name="key" value={c.key} />
        <section className="set-sec">
          <div className="set-sec-head"><h2>{c.name}</h2><p><code>{c.key}</code></p><p className="quiet">{t.keyHint}</p></div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.name}</span>
              <input className="field-input" name="name" required maxLength={120} defaultValue={c.name} />
            </label>
            <label className="field">
              <span className="field-label">{t.audience}</span>
              <input className="field-input" name="audience" maxLength={300} defaultValue={c.audience} />
              <span className="quiet field-hint">{t.audienceHint}</span>
            </label>
            <div className="field">
              <span className="field-label">{t.folders}</span>
              <MultiSelect name="folderIds" options={folderOptions} selected={c.folderIds} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
              <span className="quiet field-hint">{t.foldersHint}</span>
            </div>
            <div className="field">
              <span className="field-label">{t.languages}</span>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {UI_LANGUAGES.map(l => (
                  <label key={l} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" name="languages" value={l} defaultChecked={(c.languages.length ? c.languages : ctx.tenant.languages).includes(l)} /> {l}
                  </label>
                ))}
              </div>
            </div>
            {!isWidget && <p className="quiet field-hint" style={{ margin: 0 }}>{t.portalNote}</p>}
          </div>
        </section>

        {isWidget && (
        <>
        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.ticketsOn}</h2><p>{t.ticketsHint}</p></div>
          <div className="set-sec-body">
            <label className="form-row form-row--bare">
              <input type="checkbox" className="toggle" role="switch" name="tickets" defaultChecked={c.tickets} />
              <span>{t.ticketsOn}</span>
            </label>
            <div className="field">
              <span className="field-label">{t.assignees}</span>
              <MultiSelect name="assigneeIds" options={agentOptions} selected={c.assigneeIds} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
              <span className="quiet field-hint">{t.assigneesHint} {t.agentsNote}</span>
            </div>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.mailbox}</h2><p>{t.mailboxIntro}</p></div>
          <div className="set-sec-body">
            <div className="field">
              <span className="field-label">{t.mailboxKind}</span>
              <Select language={language} name="mailboxKind" fieldLabel={t.mailboxKind} initial={c.mailbox?.kind ?? ""}
                options={[{ value: "", label: t.mailboxNone }, { value: "graph", label: t.kindGraph }, { value: "imap", label: t.kindImap }]} />
            </div>
            <label className="field">
              <span className="field-label">{t.address}</span>
              <input className="field-input" name="address" type="email" defaultValue={c.mailbox?.address ?? ""} autoCapitalize="none" />
              <span className="quiet field-hint">{t.addressHint}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.tenantId}</span>
              <input className="field-input" name="tenantId" defaultValue={c.mailbox?.graph?.tenantId ?? ""} autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="field">
              <span className="field-label">{t.clientId}</span>
              <input className="field-input" name="clientId" defaultValue={c.mailbox?.graph?.clientId ?? ""} autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="field">
              <span className="field-label">{t.clientSecret}</span>
              <input className="field-input" name="clientSecret" type="password" autoComplete="off" spellCheck={false} />
              <span className="quiet field-hint">
                {c.mailbox?.graph?.hasSecret
                  ? t.secretSet(c.mailbox.graph.clientSecretHint ?? "", c.mailbox.graph.secretSetAt ? formatDate(c.mailbox.graph.secretSetAt, language) : "", c.mailbox.graph.secretSetBy ?? "")
                  : t.secretNone}
                {" "}{t.clientSecretHint}
              </span>
            </label>
            <p className="quiet field-hint" style={{ margin: 0 }}>{t.deployNote}</p>
          </div>
        </section>

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.widget}</h2><p>{t.widgetIntro}</p></div>
          <div className="set-sec-body">
            <label className="field">
              <span className="field-label">{t.widgetOrigins}</span>
              <textarea className="field-input" name="widgetOrigins" rows={2} defaultValue={c.widget.origins.join("\n")} />
              <span className="quiet field-hint">{t.widgetOriginsHint}</span>
            </label>
            <label className="field">
              <span className="field-label">{t.rateLimit}</span>
              <input className="field-input" name="rateLimitPerHour" type="number" min={1} max={10000} defaultValue={c.widget.rateLimitPerHour ?? DEFAULT_RATE_LIMIT} style={{ maxWidth: 160 }} />
              <span className="quiet field-hint">{t.rateLimitHint}</span>
            </label>
          </div>
        </section>
        </>
        )}

        <div className="set-savebar"><SubmitButton className="button">{t.save}</SubmitButton></div>
      </form>

      <section className="card set-form">
        {isWidget && c.mailbox && (
        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.sync}</h2><p>{t.syncSinceHint}</p></div>
          <div className="set-sec-body" style={{ display: "grid", gap: 10 }}>
            <p className="quiet" style={{ margin: 0 }}>
              {c.mailbox.lastSyncAt ? t.syncLast(formatDate(c.mailbox.lastSyncAt, language)) : t.syncNever}
              {c.mailbox.lastSyncCounts && ` · ${t.syncCounts(c.mailbox.lastSyncCounts.created, c.mailbox.lastSyncCounts.appended, c.mailbox.lastSyncCounts.skipped)}`}
              {c.mailbox.lastSyncError && ` · ${t.syncError(c.mailbox.lastSyncError)}`}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <form action={verifyMailboxAction}><input type="hidden" name="key" value={c.key} /><SubmitButton className="button button--quiet">{t.verify}</SubmitButton></form>
              <form action={syncChannelAction}><input type="hidden" name="key" value={c.key} /><SubmitButton className="button button--quiet">{t.syncNow}</SubmitButton></form>
            </div>
          </div>
        </section>
        )}

        {isWidget && (
        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.widgetSecret}</h2></div>
          <div className="set-sec-body" style={{ display: "grid", gap: 10 }}>
            {revealed ? (
              <p style={{ margin: 0 }}>{t.widgetSecretShown} <code style={{ userSelect: "all", wordBreak: "break-all" }}>{revealed}</code></p>
            ) : (
              <p className="quiet" style={{ margin: 0 }}>
                {c.widget.hasSecret ? t.widgetSecretSet(c.widget.secretHint ?? "", c.widget.secretSetAt ? formatDate(c.widget.secretSetAt, language) : "") : t.widgetSecretNone}
              </p>
            )}
            <form action={rotateWidgetSecretAction}><input type="hidden" name="key" value={c.key} /><SubmitButton className="button button--quiet">{t.widgetSecretRotate}</SubmitButton></form>
          </div>
        </section>
        )}

        {isWidget && c.mailbox && (
        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.mining}</h2><p>{t.miningIntro}</p></div>
          <div className="set-sec-body">
            {faqOptions.length === 0 ? (
              <p className="quiet" style={{ margin: 0 }}>{t.noFaqDocuments}</p>
            ) : (
              <form action={mineFaqAction} style={{ display: "grid", gap: 12 }}>
                <input type="hidden" name="key" value={c.key} />
                <div className="field">
                  <span className="field-label">{t.miningDocument}</span>
                  <Select language={language} name="documentId" fieldLabel={t.miningDocument} options={faqOptions} initial={faqOptions[0].value} />
                </div>
                <label className="field">
                  <span className="field-label">{t.miningLimit}</span>
                  <input className="field-input" name="limit" type="number" min={10} max={2000} defaultValue={DEFAULT_HISTORY_LIMIT} style={{ maxWidth: 160 }} />
                </label>
                <div><SubmitButton className="button button--quiet">{t.miningRun}</SubmitButton></div>
              </form>
            )}
          </div>
        </section>
        )}

        <section className="set-sec">
          <div className="set-sec-head"><h2>{t.remove}</h2></div>
          <div className="set-sec-body">
            <form action={removeChannelAction}><input type="hidden" name="key" value={c.key} /><SubmitButton className="button button--danger">{t.remove}</SubmitButton></form>
          </div>
        </section>
      </section>
    </div>
    </AppShell>
  )
}
