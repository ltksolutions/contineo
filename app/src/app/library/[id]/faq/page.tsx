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

function EntryForm({ entry, documentId, documents, language }: {
  entry: FaqEntry | null
  documentId: string
  documents: { value: string; label: string }[]
  language: UiLanguage
}) {
  const t = dictionary(language).library.faq
  const rows = entry ? [...entry.sources] : []
  while (rows.length < Math.min(MAX_SOURCES, Math.max(2, rows.length + 1))) rows.push({ documentId: "", articleRef: null })
  const idSuffix = entry?.id ?? "new"
  return (
    <form action={saveFaqEntryAction} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="documentId" value={documentId} />
      {entry && <input type="hidden" name="entryId" value={entry.id} />}
      <label className="field">
        <span className="field-label">{t.question}</span>
        <input className="field-input" name="question" required maxLength={MAX_QUESTION} defaultValue={entry?.question ?? ""} />
        <span className="quiet field-hint">{t.questionHint}</span>
      </label>
      <label className="field">
        <span className="field-label">{t.variants}</span>
        <textarea className="field-input" name="variants" rows={2} defaultValue={entry?.variants.join("\n") ?? ""} />
        <span className="quiet field-hint">{t.variantsHint}</span>
      </label>
      <label className="field">
        <span className="field-label">{t.answer}</span>
        <textarea className="field-input" name="answer" rows={6} required maxLength={MAX_ANSWER} defaultValue={entry?.answer ?? ""} />
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
        <input className="field-input" name="audience" defaultValue={entry?.audience.join(", ") ?? ""} />
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
  const { msg, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
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
      <Notice message={msg} back={`${base}/faq`} language={language} />
      <Notice message={error} error back={`${base}/faq`} language={language} />

      <section className="card detail-block" id="new">
        <h2 className="detail-block-title">{t.addHeading}</h2>
        <EntryForm entry={null} documentId={documentId} documents={documents} language={language} />
      </section>

      <h2 className="detail-block-title" style={{ margin: "24px 0 8px" }}>{t.heading} · {t.count(draft.entries.length)}</h2>
      {draft.entries.length === 0 && <p className="quiet">{t.empty}</p>}
      {draft.entries.map((e, i) => {
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
