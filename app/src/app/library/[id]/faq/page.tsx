/**
 * Editor záznamov FAQ (ADR-028, D164).
 *
 * Každý záznam je jeden formulár — bez klientskeho stavu, funguje bez
 * JavaScriptu. Uloženie prepíše koncept (Markdown, PDF, zoznam záznamov);
 * zverejnenie ide postupom znenia na detaile dokumentu (ADR-014), lebo FAQ
 * je dokument ako každý iný.
 *
 * Stav záznamu sa **odvodzuje** (D27): porovnaním s platným znením („nový",
 * „zmenený", „zverejnený") a z úsekov v indexe („zdroj dostal nové znenie" =
 * úsek platného znenia je neaktívny, lebo ho `expireCurationFor()` vypol).
 */

import { notFound, redirect } from "next/navigation"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import AppShell from "@/components/AppShell"
import { libraryContext } from "@/lib/library"
import { libraryDetail } from "@/lib/libraryRead"
import { faqDraft, faqEntryStates, MAX_QUESTION, MAX_ANSWER, MAX_SOURCES, type FaqEntry } from "@/lib/faq"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { saveFaqEntryAction, removeFaqEntryAction } from "../../actions"
import type { UiLanguage } from "@/lib/i18n"
import type { ReactNode } from "react"
import { errorText } from "@/lib/i18n"
import { AppError } from "@/lib/appError"
import { listConnectors } from "@/lib/connectors"
import Link from "next/link"
import { openProposalsByChannel } from "@/lib/faqProposals"
import { channelByKey } from "@/lib/channels"
import { profileFor } from "@/lib/mcp/profiles"
import {
  parseAssist, parseConnectorSource, connectorSource, filterEntries, LIBRARY_SOURCE, type AssistDraft,
} from "@/lib/faqAssist"
import {
  searchLibraryForFaq, searchConnectorForFaq, type LibraryHit, type ConnectorHit,
} from "@/lib/faqAssistSearch"

export const dynamic = "force-dynamic"

type EntryState = "new" | "changed" | "published"

function stateOf(entry: FaqEntry, published: FaqEntry[]): EntryState {
  const was = published.find(p => p.id === entry.id)
  if (!was) return "new"
  const same = was.question === entry.question && was.answer === entry.answer
    && JSON.stringify(was.variants) === JSON.stringify(entry.variants)
    && JSON.stringify(was.sources) === JSON.stringify(entry.sources)
    && JSON.stringify(was.audience) === JSON.stringify(entry.audience)
  return same ? "published" : "changed"
}

function EntryForm({ entry, documentId, documents, language, initial, assist }: {
  entry: FaqEntry | null
  documentId: string
  documents: { value: string; label: string }[]
  language: UiLanguage
  /** Rozpísaný nový záznam z adresy — pomocník ho prenáša cez hľadanie. */
  initial?: AssistDraft
  /** Pomocník pri hľadaní podkladu — len pri novom zázname. */
  assist?: ReactNode
}) {
  const t = dictionary(language).library.faq
  const rows = entry ? [...entry.sources] : (initial?.sources.map(s => ({ documentId: s.documentId, articleRef: s.articleRef || null })) ?? [])
  while (rows.length < Math.min(MAX_SOURCES, Math.max(2, rows.length + 1))) rows.push({ documentId: "", articleRef: null })
  const idSuffix = entry?.id ?? "new"
  return (
    <form action={saveFaqEntryAction} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="documentId" value={documentId} />
      {entry && <input type="hidden" name="entryId" value={entry.id} />}
      {assist}
      <label className="field">
        <span className="field-label">{t.question}</span>
        <input className="field-input" name="question" required maxLength={MAX_QUESTION} defaultValue={entry?.question ?? initial?.question ?? ""} />
        <span className="quiet field-hint">{t.questionHint}</span>
      </label>
      <label className="field">
        <span className="field-label">{t.variants}</span>
        <textarea className="field-input" name="variants" rows={2} defaultValue={entry?.variants.join("\n") ?? initial?.variants ?? ""} />
        <span className="quiet field-hint">{t.variantsHint}</span>
      </label>
      <label className="field">
        <span className="field-label">{t.answer}</span>
        <textarea className="field-input" name="answer" rows={6} required maxLength={MAX_ANSWER} defaultValue={entry?.answer ?? initial?.answer ?? ""} />
        <span className="quiet field-hint">{t.answerHint}</span>
      </label>
      <div className="field">
        <span className="field-label">{t.sources}</span>
        {rows.map((s, i) => (
          <div key={`${idSuffix}-${i}`} className="field-row faq-source-row">
            <Select language={language} name="sourceDocument" initial={s.documentId} searchable fieldLabel={t.sourceDocument}
              options={[{ value: "", label: t.sourceNone }, ...documents]} />
            <input className="field-input" name="sourceArticle" defaultValue={s.articleRef ?? ""} placeholder={t.sourceArticlePlaceholder} aria-label={t.sourceArticle} />
          </div>
        ))}
        <span className="quiet field-hint">{t.sourcesHint}</span>
      </div>
      <label className="field">
        <span className="field-label">{t.audience}</span>
        <input className="field-input" name="audience" defaultValue={entry?.audience.join(", ") ?? initial?.audience ?? ""} />
        <span className="quiet field-hint">{t.audienceHint}</span>
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className={entry ? "button button--quiet" : "button"} type="submit">{entry ? t.save : t.add}</button>
        {entry && (
          <button className="button button--danger" type="submit" formAction={removeFaqEntryAction} name="entryId" value={entry.id}>
            {t.remove}
          </button>
        )}
      </div>
    </form>
  )
}

export default async function FaqEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { id } = await params
  const raw = await searchParams
  const { msg, error } = normalizeQuery<{ msg?: string; error?: string }>(raw)
  const assist = parseAssist(raw)
  const find = (Array.isArray(raw.find) ? raw.find[0] : raw.find ?? "").trim().slice(0, 200)
  const documentId = decodeURIComponent(id)
  const d = await libraryDetail(ctx.tenant.companyCode, documentId)
  if (!d) notFound()
  const draft = await faqDraft(ctx.tenant.companyCode, documentId)
  if (!draft) notFound()

  const language = ctx.person.language
  const t = dictionary(language).library.faq
  const branding = brandingView(ctx.tenant)
  const base = `/library/${encodeURIComponent(documentId)}`

  // Dokumenty organizácie ako možné zdroje — okrem tohto FAQ.
  const col = await getCollection(DOCUMENTS_COLLECTION)
  const documents = (await col
    .find({ companyCode: ctx.tenant.companyCode, documentId: { $ne: documentId } }, { projection: { documentId: 1, title: 1 } })
    .sort({ title: 1 })
    .toArray() as unknown as { documentId: string; title?: string }[])
    .map(x => ({ value: x.documentId, label: String(x.title ?? x.documentId) }))

  const states = d.effectiveVersionId ? await faqEntryStates(ctx.tenant.companyCode, documentId, d.effectiveVersionId) : new Map()

  // Pomocník (faqAssist.ts): konektory, z ktorých sa dá importovať — tie isté
  // ako na stránke Import zo servera, každý rozsah ako vlastný prepínač.
  const ta = t.assist
  const connectors = (await listConnectors(ctx.tenant.companyCode).catch(() => []))
    .filter(c => c.uses.ingest.enabled && c.status === "connected" && profileFor(c.profile).fetch)
  const sourceOptions = [
    { value: LIBRARY_SOURCE, label: ta.library },
    ...connectors.flatMap(c => c.scopes.map(s => ({ value: connectorSource(c.id, s.key), label: c.scopes.length > 1 ? `${c.name} · ${s.label}` : c.name }))),
  ]
  const labelOf = (v: string) => sourceOptions.find(o => o.value === v)?.label ?? v
  type Found =
    | { kind: "library"; hits: LibraryHit[] }
    | { kind: "connector"; source: string; connectorId: string; scopeKey: string; hits: ConnectorHit[] }
    | { kind: "failed"; message: string }
  const actor = { personId: ctx.person.id, personName: ctx.person.fullName }
  // Zdroje súbežne; poradie výsledkov ostáva poradím prepínačov.
  const found: Found[] = assist.query
    ? (await Promise.all(sourceOptions.filter(o => assist.sources.includes(o.value)).map(async ({ value: src }): Promise<Found | null> => {
        try {
          if (src === LIBRARY_SOURCE) return { kind: "library", hits: await searchLibraryForFaq(ctx.tenant.companyCode, assist.query, documentId) }
          const c = parseConnectorSource(src)
          if (!c) return null
          return { kind: "connector", source: src, ...c, hits: await searchConnectorForFaq(ctx.tenant.companyCode, c.connectorId, c.scopeKey, assist.query, actor) }
        } catch (e) {
          if (!(e instanceof AppError)) console.error("[faq-assist] hľadanie zlyhalo:", e)
          return { kind: "failed", message: `${ta.failed(labelOf(src))} ${errorText(e, language)}` }
        }
      }))).filter((f): f is Found => f !== null)
    : []
  const libraryResult = found.find((f): f is Extract<Found, { kind: "library" }> => f.kind === "library")
  const libraryHits = libraryResult?.hits ?? []
  const connectorHits = found.filter((f): f is Extract<Found, { kind: "connector" }> => f.kind === "connector")
  const failures = found.filter((f): f is Extract<Found, { kind: "failed" }> => f.kind === "failed").map(f => f.message)
  const shown = filterEntries(draft.entries, find)
  const here = `${base}/faq#new`
  // Tlačidlá pomocníka idú cez GET na túto stránku — prenesú rozpísaný záznam
  // v adrese a prehliadač ich odošle sám (string `formAction` React nezachytí).
  const getButton = (label: string, name?: string, value?: string, quiet = true) => (
    <button className={quiet ? "button button--quiet" : "button"} type="submit" formMethod="get" formAction={here} formNoValidate name={name} value={value}>
      {label}
    </button>
  )
  const assistPanel = (
    <fieldset className="faq-assist">
      <legend className="field-label">{ta.heading}</legend>
      <p className="quiet field-hint" style={{ margin: 0 }}>{ta.hint}</p>
      <label className="field">
        <span className="field-label">{ta.query}</span>
        <input className="field-input" type="search" name="q" defaultValue={assist.query} maxLength={300} />
      </label>
      <div className="field">
        <span className="field-label">{ta.sources}</span>
        <div className="faq-assist-sources">
          {sourceOptions.map(o => (
            <label key={o.value} className="faq-assist-pill">
              <input type="checkbox" name="src" value={o.value} defaultChecked={assist.sources.includes(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>{getButton(ta.search)}</div>
      {assist.query && !assist.sources.length && <p className="quiet" style={{ margin: 0 }}>{ta.noSource}</p>}
      {failures.map(f => <p key={f} className="tag tag--warn" style={{ margin: 0, justifySelf: "start" }}>{f}</p>)}
      {libraryResult && (
        <section className="faq-assist-group">
          <h3 className="faq-assist-group-title">{ta.library}</h3>
          {libraryHits.length === 0 ? <p className="quiet" style={{ margin: 0 }}>{ta.none}</p> : (
            <ol className="faq-assist-hits">
              {libraryHits.map((h, i) => (
                <li key={`${h.documentId}-${i}`} className="faq-assist-hit">
                  <div className="faq-assist-hit-head">
                    <strong>{h.title}</strong>
                    {/* articleRef už nesie predponu z chunkera (čl. 18a) */}
                    {h.articleRef && <span className="quiet">{h.articleRef}</span>}
                    {h.accessLevel !== "public" && <span className="tag">{ta.internal}</span>}
                  </div>
                  <p className="faq-assist-excerpt">{h.excerpt}</p>
                  <div className="faq-assist-actions">
                    {getButton(ta.useSource, "use", `${h.documentId}|${h.articleRef ?? ""}`)}
                    {getButton(ta.insert, "insert", h.excerpt)}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {connectorHits.map(g => (
        <section key={g.source} className="faq-assist-group">
          <h3 className="faq-assist-group-title">{labelOf(g.source)}</h3>
          {g.hits.length === 0 ? <p className="quiet" style={{ margin: 0 }}>{ta.none}</p> : (
            <ol className="faq-assist-hits">
              {g.hits.map(h => (
                <li key={h.externalId} className="faq-assist-hit">
                  <div className="faq-assist-hit-head">
                    <strong>{h.title}</strong>
                    {h.existingDocumentId && <span className="tag">{ta.imported}</span>}
                  </div>
                  <p className="faq-assist-excerpt">{h.excerpt}</p>
                  <div className="faq-assist-actions">
                    {getButton(ta.insert, "insert", h.excerpt)}
                    {h.existingDocumentId
                      ? getButton(ta.useSource, "use", `${h.existingDocumentId}|`)
                      : <a className="button button--quiet" href={`/library/new/connector?${new URLSearchParams({ connector: g.connectorId, scope: g.scopeKey, q: h.title })}`}>{ta.import}</a>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </fieldset>
  )

  // Návrhy z histórie helpdesku čakajú na kurátora (ADR-030, D185) — on sa
  // k nim inak nedostane, nastavenie kanála vidí len správca organizácie.
  const proposalLinks = (await Promise.all((await openProposalsByChannel(ctx.tenant.companyCode).catch(() => []))
    .map(async r => ({ ...r, name: (await channelByKey(ctx.tenant.companyCode, r.channelKey))?.name ?? r.channelKey }))))
  const tc = dictionary(language).channels

  return (
    <AppShell language={language} title={`${t.heading} · ${d.title}`}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{d.title}</h1>
        <span className="page-head-spacer" />
        <a className="button button--quiet" href={`${base}#flow`}>{dictionary(language).library.flow.steps[0]} →</a>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 12px" }}>{t.intro}</p>
      <p className="quiet field-hint" style={{ margin: "0 0 20px" }}>{t.publishNote} {t.pdfNote}</p>
      {proposalLinks.length > 0 && (
        <div className="mg-actions" style={{ margin: "0 0 20px" }}>
          {proposalLinks.map(r => (
            <Link key={r.channelKey} className="button button--quiet" href={`/channels/${encodeURIComponent(r.channelKey)}/proposals`}>{r.name}: {tc.harvestOpenProposals(r.open)}</Link>
          ))}
        </div>
      )}
      <Notice message={msg} back={`${base}/faq`} language={language} />
      <Notice message={error} error back={`${base}/faq`} language={language} />

      <section className="card detail-block" id="new">
        <h2 className="detail-block-title">{t.addHeading}</h2>
        <EntryForm entry={null} documentId={documentId} documents={documents} language={language} initial={assist.draft} assist={assistPanel} />
      </section>

      <h2 className="detail-block-title" style={{ margin: "24px 0 8px" }}>{t.heading} · {t.count(draft.entries.length)}</h2>
      {draft.entries.length === 0 && <p className="quiet">{t.empty}</p>}
      {/* Hľadanie v záznamoch — GET, stav v adrese, bez JavaScriptu (8. 10. 2026). */}
      {draft.entries.length > 0 && (
        <form method="get" action={`${base}/faq#entries`} className="faq-find" role="search" id="entries">
          <label className="field">
            <span className="field-label">{t.find}</span>
            <input className="field-input" type="search" name="find" defaultValue={find} maxLength={200} />
          </label>
          <div className="faq-find-actions">
            <button className="button button--quiet" type="submit">{t.findButton}</button>
            {find && <a className="button button--quiet" href={`${base}/faq#entries`}>{t.findClear}</a>}
          </div>
          {find && <p className="quiet" style={{ margin: 0 }}>{t.findCount(shown.length, draft.entries.length)}</p>}
        </form>
      )}
      {find && shown.length === 0 && <p className="quiet">{t.findNone}</p>}
      {shown.map(({ entry: e, index: i }) => {
        const state = stateOf(e, draft.published)
        const indexed = states.get(e.id)
        const sourceChanged = Boolean(indexed && !indexed.isActive && state !== "new")
        return (
          <section className="card detail-block" id={e.id} key={e.id}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <h3 className="detail-block-title" style={{ margin: 0 }}>{t.editHeading(i + 1)}</h3>
              <span className={`tag ${state === "published" ? "tag--published" : "tag--draft"}`}>
                {state === "new" ? t.stateNew : state === "changed" ? t.stateChanged : t.statePublished}
              </span>
              {indexed && <span className="tag">{t.access(indexed.accessLevel)}</span>}
              {sourceChanged && <span className="tag tag--expired">{t.stateSourceChanged}</span>}
            </div>
            <EntryForm entry={e} documentId={documentId} documents={documents} language={language} />
          </section>
        )
      })}
    </div>
    </AppShell>
  )
}
