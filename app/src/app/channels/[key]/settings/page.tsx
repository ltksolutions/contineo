/**
 * /channels/[key]/settings — nastavenie jedného kanála (ADR-028, D161, D169;
 * vlastná adresa od D170, predtým `/channels/[key]`). Len správca organizácie.
 *
 * Formulár podľa typu: **widget** má obsah, riešiteľov, tickety, schránku
 * a vloženie (pôvody, strop, tajomstvo); **portál** má obsah, publikum
 * a jazyky — články a formuláre sa pripravujú. Tajomstvá sa na obrazovku
 * nedostanú (`channelView`); nové tajomstvo widgetu sa ukáže raz zo servera.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import MultiSelect from "@/components/MultiSelect"
import SubmitButton from "@/components/SubmitButton"
import { orgContext } from "@/lib/orgSettings"
import { isHelpdeskAgent } from "@/lib/helpdeskAgents"
import { ChannelPartTabs, channelHref } from "@/components/ChannelTabs"
import { widgetFallbackContact, channelAccessLevel, channelByKey, channelView, takeRevealedWidgetSecret, HELPDESK_ROLE, DEFAULT_RATE_LIMIT, SYNC_INTERVALS, DEFAULT_SYNC_INTERVAL } from "@/lib/channels"
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
import { channelContentPreview } from "@/lib/channelContent"
import { widgetEmbedCode } from "@/lib/widgetEmbed"
import { requestHostname } from "@/lib/session"
import CopyLink from "@/components/CopyLink"
import { codelistOptions } from "@/lib/codelists"
import { tenantExtras } from "@/lib/codelistsTenant"
import { listConnectors, scopeRef, connectorAllowed } from "@/lib/connectors"
import { saveChannelAction, removeChannelAction, verifyMailboxAction, syncChannelAction, rotateWidgetSecretAction, mineFaqAction } from "../../actions"

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
  const base = channelHref(c.key, "settings")
  const isWidget = c.kind === "widget"
  // Podmenu Tickety len riešiteľovi tohto kanála — správca ich nevidí (D170).
  const canTickets = isWidget && c.tickets && isHelpdeskAgent(ctx.person) && raw.assigneeIds.includes(ctx.person.id)

  const [folders, people, faqDocs, revealed, connectors, preview] = await Promise.all([
    allFolders(ctx.tenant.companyCode),
    listPeople(ctx.tenant.companyCode),
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, category: "faq" }, { projection: { documentId: 1, title: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string }[]>,
    isWidget && c.widget.revealOnce ? takeRevealedWidgetSecret(ctx.tenant.companyCode, c.key) : Promise.resolve(null),
    listConnectors(ctx.tenant.companyCode),
    channelContentPreview(ctx.tenant.companyCode, raw),
  ])
  // Rozsahy živých zdrojov (ADR-029, D175): len konektory so zapnutým živým
  // zdrojom; konektor bez rozsahov ponúka jeden celý. Widget je verejný,
  // preto vidí len verejné konektory — interný by sa aj tak nevolal.
  // Konektor, ktorý režim organizácie nepripúšťa, sa neponúka (ADR-002).
  const allowedIds = new Set((await Promise.all(connectors.map(async k =>
    (await connectorAllowed(ctx.tenant.companyCode, k.endpoint)) ? k.id : null))).filter(Boolean))
  const scopeOptions = connectors
    .filter(k => allowedIds.has(k.id) && k.uses.retrieval.enabled && (!isWidget || k.uses.retrieval.accessLevel === "public"))
    .flatMap(k => (k.scopes.length ? k.scopes : [{ key: "", label: "" }]).map(s => ({
      value: scopeRef(k.id, s.key), label: s.key ? `${k.name} — ${s.label}` : k.name,
    })))
  // Druh dokumentu v náhľade názvom z číselníka, nie kľúčom.
  const categoryLabel = new Map(codelistOptions("category", tenantExtras(ctx.tenant)).map(o => [o.value, o.label]))
  const folderOptions = treeOptions(flattenTree(folders).map(r => ({ id: r.folder.id, name: r.folder.name, level: r.level })))
  const agentOptions = people.filter(p => p.roles.includes(HELPDESK_ROLE)).map(p => ({ value: p.id, label: `${p.fullName} (${p.email})` }))
  const faqOptions = faqDocs.map(x => ({ value: x.documentId, label: String(x.title ?? x.documentId) }))

  // Kód na vloženie (Ján 8. 10. 2026) — len widget; hostiteľ je doména,
  // na ktorej je nastavenie otvorené, teda doména organizácie.
  const fallbackContact = isWidget ? widgetFallbackContact(raw, ctx.tenant.branding?.supportEmail) : null
  const embedCode = isWidget
    ? widgetEmbedCode({ host: await requestHostname(), channelKey: c.key, fallbackText: t.embedFallbackText, contact: fallbackContact })
    : ""

  return (
    <AppShell language={language} title={t.tabSettings} trail={{ [channelHref(c.key)]: c.name }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{c.name}</h1>
        <span className="page-head-spacer" />
        <span className="tag">{t.kinds[c.kind]}</span>
      </div>
      <ChannelPartTabs channelKey={c.key} current={base} canTickets={canTickets} canSettings language={language} />
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
            {/* Úroveň je vlastnosť typu kanála (Ján 8. 10. 2026): widget je
                verejný vždy, portál pre prihlásených smie aj interný. */}
            {isWidget ? (
              <p className="quiet field-hint" style={{ margin: 0 }}>{t.accessWidgetFact}</p>
            ) : (
              <div className="field">
                <span className="field-label">{t.accessLevel}</span>
                <Select language={language} name="accessLevel" fieldLabel={t.accessLevel} initial={channelAccessLevel(raw)}
                  options={[{ value: "public", label: t.accessPublic }, { value: "internal", label: t.accessInternal }]} />
                <span className="quiet field-hint">{t.accessPortalHint}</span>
              </div>
            )}
            <div className="field">
              <span className="field-label">{t.connectorScopes}</span>
              {scopeOptions.length ? (
                <>
                  <MultiSelect name="connectorScopes" options={scopeOptions} selected={c.connectorScopes ?? []} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
                  <span className="quiet field-hint">{t.connectorScopesHint}</span>
                </>
              ) : (
                // Konektor so živým zdrojom môže existovať, len interný — verejný
                // widget ho nedostane (D174); veta to má povedať, nie tvrdiť, že nie je.
                <span className="quiet field-hint">
                  {isWidget && connectors.some(k => k.uses.retrieval.enabled) ? t.connectorScopesInternalOnly : t.connectorScopesNone}
                </span>
              )}
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
            <label className="form-row form-row--bare">
              <input type="checkbox" className="toggle" role="switch" name="skipBounces" defaultChecked={c.mailbox?.skipBounces !== false} />
              <span>{t.skipBounces}</span>
            </label>
            <span className="quiet field-hint">{t.skipBouncesHint}</span>
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
            <div className="field">
              <span className="field-label">{t.syncInterval}</span>
              <Select language={language} name="syncInterval" fieldLabel={t.syncInterval} initial={String(raw.mailbox?.syncIntervalMinutes ?? DEFAULT_SYNC_INTERVAL)}
                options={SYNC_INTERVALS.map(m => ({ value: String(m), label: t.syncIntervalOption(m) }))} />
              <span className="quiet field-hint">{t.syncIntervalHint}</span>
            </div>
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
            <label className="field">
              <span className="field-label">{t.widgetFallback}</span>
              <input className="field-input" name="widgetFallbackEmail" type="email" autoCapitalize="none" spellCheck={false}
                     defaultValue={c.widget.fallbackEmail ?? ""} placeholder={ctx.tenant.branding?.supportEmail ?? ""} />
              <span className="quiet field-hint">{t.widgetFallbackHint(ctx.tenant.branding?.supportEmail ?? null)}</span>
            </label>
          </div>
        </section>
        </>
        )}

        <div className="set-savebar"><SubmitButton className="button">{t.save}</SubmitButton></div>
      </form>

      {/* Čo asistent kanála vidí (Ján 8. 10. 2026) — tá istá podmienka ako
          hľadanie: priečinky, platné znenie, úroveň kanála. Podľa uloženého
          nastavenia; po zmene priečinkov treba najprv uložiť. */}
      <section className="card detail-block" id="content-preview" style={{ marginTop: 16 }}>
        <h2 className="detail-block-title">{t.previewHeading}</h2>
        <p className="detail-block-note" style={{ margin: 0 }}>
          {preview.accessLevel === "public" ? t.previewLevelPublic : t.previewLevelInternal}
          {" "}{t.previewSaved}
        </p>
        <p style={{ margin: 0 }}><b>{t.previewIncluded(preview.includedTotal)}</b>{preview.verifiedAnswers > 0 && <span className="quiet"> · {t.previewVerified(preview.verifiedAnswers)}</span>}</p>
        {preview.included.length > 0 ? (
          <ul className="preview-list">
            {preview.included.map(r => (
              <li key={r.documentId}>
                <Link href={`/library/${encodeURIComponent(r.documentId)}`}>{r.title}</Link>
                <span className="quiet">{[r.category && (categoryLabel.get(r.category) ?? r.category), r.versionLabel && t.previewVersion(r.versionLabel)].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
        ) : <p className="quiet" style={{ margin: 0 }}>{t.previewNone}</p>}
        {preview.includedTotal > preview.included.length && <p className="quiet" style={{ margin: 0 }}>{t.previewMore(preview.includedTotal - preview.included.length)}</p>}
        {preview.excludedTotal > 0 && (
          <details>
            <summary>{t.previewExcluded(preview.excludedTotal)}</summary>
            <ul className="preview-list">
              {preview.excluded.map(r => (
                <li key={r.documentId}>
                  <Link href={`/library/${encodeURIComponent(r.documentId)}`}>{r.title}</Link>
                  <span className="tag">{t.previewReason[r.reason!]}</span>
                </li>
              ))}
            </ul>
            {preview.excludedTotal > preview.excluded.length && <p className="quiet" style={{ margin: 0 }}>{t.previewMore(preview.excludedTotal - preview.excluded.length)}</p>}
          </details>
        )}
      </section>

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

      {/* Kód na vloženie do cudzej stránky s popisom parametrov (Ján 8. 10. 2026). */}
      {isWidget && (
        <section className="card detail-block" id="embed" style={{ marginTop: 16 }}>
          <h2 className="detail-block-title">{t.embedHeading}</h2>
          <p className="detail-block-note" style={{ margin: 0 }}>{t.embedIntro}</p>
          {c.widget.origins.length === 0 && <p className="tag tag--warn" style={{ margin: 0, justifySelf: "start" }}>{t.embedNoOrigins}</p>}
          {!fallbackContact && <p className="quiet" style={{ margin: 0 }}>{t.embedNoContact}</p>}
          <pre className="embed-code"><code>{embedCode}</code></pre>
          <div><CopyLink value={embedCode} label={t.embedCopy} done={t.embedCopied} /></div>
          <h3 className="embed-sub">{t.embedParamsHeading}</h3>
          <dl className="embed-params">
            {t.embedParams.map(p => (
              <div key={p.name}><dt><code>{p.name}</code></dt><dd>{p.text}</dd></div>
            ))}
          </dl>
          <h3 className="embed-sub">{t.embedTokenHeading}</h3>
          <p className="quiet" style={{ margin: 0 }}>{t.embedToken}</p>
        </section>
      )}
    </div>
    </AppShell>
  )
}
