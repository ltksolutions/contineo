/**
 * /channels/[key]/proposals — fronta kurátora pre návrhy FAQ z histórie
 * schránky kanála (ADR-030, D185). Len správca obsahu (`libraryContext`).
 *
 * Každý návrh je karta s vlastnými úkonmi, preto sú všetky tlačidlá tiché
 * (CLAUDE.md, R1). Pohľad (otvorené / treba rozhodnúť / bez zdroja /
 * rozhodnuté) je prepínač `.view-switch`, téma a strana sú v adrese.
 *
 * Od 10. 10. 2026 (Ján: „smart formulár, kde budem vidieť pôvodné znenie
 * a navrhované znenie, ktoré môžem upraviť“): pri návrhu je porovnanie
 * s pôvodným návrhom modelu po slovách a úpravu možno uložiť bez schválenia.
 */

import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import SubmitButton from "@/components/SubmitButton"
import { libraryContext } from "@/lib/library"
import { channelHref } from "@/components/ChannelTabs"
import { channelByKey, channelView } from "@/lib/channels"
import {
  listProposals, proposalFilterCounts, proposalTopics, originalOf,
  PROPOSAL_FILTERS, type FaqProposal, type ProposalFilter,
} from "@/lib/faqProposals"
import { wordDiff, hasChanges, type WordDiffPart } from "@/lib/wordDiff"
import { monthRange } from "@/lib/historyAnalysis"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, formatNumber, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { approveProposalAction, saveProposalAction, rejectProposalAction, mergeProposalAction } from "../../proposalActions"

export const dynamic = "force-dynamic"

/** Toľko kariet na stranu — každá má formulár s dlhou odpoveďou. */
const PAGE = 20

function Diff({ parts }: { parts: WordDiffPart[] }) {
  return (
    <span className="pr-diff">
      {parts.map((p, i) =>
        p.kind === "added" ? <ins key={i}>{p.text}</ins>
        : p.kind === "removed" ? <del key={i}>{p.text}</del>
        : <span key={i}>{p.text}</span>)}
    </span>
  )
}

export default async function ProposalsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { key } = await params
  const q = normalizeQuery<{ msg?: string; error?: string; view?: string; topic?: string; page?: string }>(await searchParams)
  const raw = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!raw) notFound()
  const c = channelView(raw)
  const language: UiLanguage = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const view: ProposalFilter = (PROPOSAL_FILTERS as string[]).includes(q.view ?? "") ? (q.view as ProposalFilter) : "open"
  const decided = view === "decided"
  const topic = q.topic || null
  const base = `${channelHref(c.key)}/proposals`

  const [list, counts, topics, faqDocs] = await Promise.all([
    listProposals(ctx.tenant.companyCode, c.key, view, topic),
    proposalFilterCounts(ctx.tenant.companyCode, c.key, topic),
    proposalTopics(ctx.tenant.companyCode, c.key),
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, category: "faq" }, { projection: { documentId: 1, title: 1, folderPath: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string; folderPath?: string[] }[]>,
  ])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const page = Math.min(pages, Math.max(1, Number(q.page) || 1))
  const shown = list.slice((page - 1) * PAGE, page * PAGE)

  const href = (over: { view?: ProposalFilter; topic?: string | null; page?: number }) => {
    const p = new URLSearchParams()
    const v = over.view ?? view
    const tp = over.topic === undefined ? topic : over.topic
    if (v !== "open") p.set("view", v)
    if (tp) p.set("topic", tp)
    if (over.page && over.page > 1) p.set("page", String(over.page))
    const s = p.toString()
    return s ? `${base}?${s}` : base
  }
  const backQuery = href({ page }).split("?")[1] ?? ""

  // FAQ dokumenty v priečinkoch kanála prvé — tam patria záznamy z jeho schránky.
  const inChannel = (d: { folderPath?: string[] }) => (d.folderPath ?? []).some(f => raw.folderIds.includes(f))
  const faqOptions = faqDocs
    .slice().sort((a, b) => Number(inChannel(b)) - Number(inChannel(a)))
    .map(d => ({ value: d.documentId, label: String(d.title ?? d.documentId) }))
  const n = (x: number) => formatNumber(x, language)
  const monthLabel = (k: string | null) => {
    if (!k) return "—"
    const d = monthRange(k).start
    return `${t.historyMonthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  }
  const byTopic = new Map<string, FaqProposal[]>()
  for (const p of list) byTopic.set(p.topicKey, [...(byTopic.get(p.topicKey) ?? []), p])
  const viewLabel: Record<ProposalFilter, string> = {
    open: t.proposalsViewOpen, decision: t.proposalsViewDecision, nosource: t.proposalsViewNoSource, decided: t.proposalsViewDecided,
  }

  return (
    <AppShell language={language} title={t.proposals} trail={{ [channelHref(c.key)]: c.name }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.proposals}</h1>
        <span className="page-head-spacer" />
        <span className="tag">{c.name}</span>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.proposalsIntro}</p>
      <Notice message={q.msg} error={q.error === "1"} back={href({ page })} language={language} />

      <nav className="view-switch view-switch--fit" aria-label={t.proposals} style={{ marginBottom: 12 }}>
        {PROPOSAL_FILTERS.map(f => (
          <Link key={f} className={`view-switch-item${f === view ? " is-on" : ""}`} aria-current={f === view ? "true" : undefined} href={href({ view: f, page: 1 })}>
            {viewLabel[f]} <span className="view-switch-count">{n(counts[f])}</span>
          </Link>
        ))}
      </nav>

      {topics.length > 1 && (
        <form method="get" action={base} className="mg-inline" style={{ alignItems: "flex-end", marginBottom: 16 }}>
          {view !== "open" && <input type="hidden" name="view" value={view} />}
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.proposalTopicFilter}</span>
            <select className="field-input" name="topic" defaultValue={topic ?? ""}>
              <option value="">{t.proposalTopicAll}</option>
              {topics.map(x => <option key={x.topicKey} value={x.topicKey}>{x.topicLabel} ({x.open})</option>)}
            </select>
          </label>
          <div><button type="submit" className="button button--quiet">{t.proposalTopicApply}</button></div>
        </form>
      )}

      {!decided && faqOptions.length === 0 && <p className="tag tag--warn" style={{ justifySelf: "start" }}>{t.proposalsNoFaq}</p>}
      {shown.length === 0 && <p className="quiet">{t.proposalsEmpty}</p>}

      <div style={{ display: "grid", gap: 16 }}>
        {shown.map(p => {
          const original = originalOf(p)
          const qDiff = original ? wordDiff(original.question, p.question) : null
          const aDiff = original ? wordDiff(original.answer, p.answer) : null
          const vDiff = original ? wordDiff(original.variants.join("\n"), p.variants.join("\n")) : null
          const changed = Boolean(qDiff && aDiff && vDiff && (hasChanges(qDiff) || hasChanges(aDiff) || hasChanges(vDiff)))
          return (
          <section key={p.id} className="card detail-block" id={p.id}>
            <div className="mg-pills">
              <span className="tag">{t.proposalTopic}: {p.topicLabel}</span>
              {p.flags.changedOverTime && <span className="tag tag--warn">{t.proposalChanged}</span>}
              {p.flags.normConflict && <span className="tag tag--warn">{t.proposalNormConflict}</span>}
              {decided && p.status !== "open" && <span className="tag">{t.proposalStatus[p.status]}</span>}
            </div>
            <p className="quiet" style={{ margin: 0 }}>{t.proposalThreads(n(p.threads), monthLabel(p.firstMonth), monthLabel(p.lastMonth))}</p>
            {p.note && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.proposalNote}:</b> {p.note}</p>}
            {p.sources.length > 0 && (
              <p className="quiet" style={{ margin: 0 }}>
                {t.proposalSources}: {p.sources.map((s, i) => (
                  <span key={`${s.documentId}|${s.articleRef ?? ""}`}>{i > 0 && " · "}<Link href={`/library/${encodeURIComponent(s.documentId)}`}>{s.title}{s.articleRef ? `, ${s.articleRef}` : ""}</Link></span>
                ))}
              </p>
            )}
            {p.editedAt && <p className="quiet" style={{ margin: 0 }}>{t.proposalEdited(p.editedBy ?? "", formatDate(p.editedAt, language))}</p>}

            {original && qDiff && aDiff && vDiff && (
              <details className="pr-original">
                <summary>{t.proposalOriginal}</summary>
                {changed ? (
                  <div className="pr-original-body">
                    <p className="quiet" style={{ margin: 0 }}>{t.proposalOriginalIntro}</p>
                    <p style={{ margin: 0 }}><b>{t.proposalQuestion}:</b> <Diff parts={qDiff} /></p>
                    {(original.variants.length > 0 || p.variants.length > 0) && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.proposalVariants}:</b>{"\n"}<Diff parts={vDiff} /></p>}
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.proposalAnswer}:</b>{"\n"}<Diff parts={aDiff} /></p>
                  </div>
                ) : (
                  <p className="quiet" style={{ margin: 0 }}>{t.proposalNoChanges}</p>
                )}
              </details>
            )}

            {decided ? (
              <>
                <h3 style={{ margin: 0, fontSize: 16 }}>{p.question}</h3>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.answer}</p>
                <p className="quiet" style={{ margin: 0 }}>
                  {t.proposalDecidedBy(p.decidedBy ?? "", p.decidedAt ? formatDate(p.decidedAt, language) : "")}
                  {p.faqDocumentId && <> · <Link href={`/library/${encodeURIComponent(p.faqDocumentId)}/faq`}>FAQ</Link></>}
                </p>
              </>
            ) : (
              <>
                <form action={approveProposalAction} style={{ display: "grid", gap: 12 }}>
                  <input type="hidden" name="key" value={c.key} />
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="back" value={backQuery} />
                  <input type="hidden" name="anchor" value={p.id} />
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t.proposalQuestion}</span>
                    <input className="field-input" name="question" required maxLength={300} defaultValue={p.question} />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t.proposalVariants}</span>
                    <textarea className="field-input" name="variants" rows={3} defaultValue={p.variants.join("\n")} />
                    <span className="quiet field-hint">{t.proposalVariantsHint}</span>
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t.proposalAnswer}</span>
                    <textarea className="field-input" name="answer" required rows={10} defaultValue={p.answer} />
                  </label>
                  <label className="field" style={{ margin: 0 }}>
                    <span className="field-label">{t.proposalAudience}</span>
                    <input className="field-input" name="audience" defaultValue={p.audience.join(", ")} />
                    <span className="quiet field-hint">{t.proposalAudienceHint}</span>
                  </label>
                  {faqOptions.length > 0 && (
                    <div className="field" style={{ margin: 0 }}>
                      <span className="field-label">{t.proposalDocument}</span>
                      <Select language={language} name="documentId" fieldLabel={t.proposalDocument} options={faqOptions} initial={faqOptions[0].value} />
                    </div>
                  )}
                  <div className="mg-actions">
                    <SubmitButton className="button button--quiet" formAction={saveProposalAction}>{t.proposalSave}</SubmitButton>
                    {faqOptions.length > 0 && <SubmitButton className="button button--quiet">{t.proposalApprove}</SubmitButton>}
                  </div>
                </form>
                <div className="mg-actions">
                  <form action={rejectProposalAction}>
                    <input type="hidden" name="key" value={c.key} />
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="back" value={backQuery} />
                    <SubmitButton className="button button--quiet">{t.proposalReject}</SubmitButton>
                  </form>
                  {(byTopic.get(p.topicKey) ?? []).length > 1 && (
                    <form action={mergeProposalAction} className="mg-inline" style={{ alignItems: "flex-end" }}>
                      <input type="hidden" name="key" value={c.key} />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="back" value={backQuery} />
                      <div className="field" style={{ margin: 0 }}>
                        <span className="field-label">{t.proposalMergeInto}</span>
                        <Select language={language} name="into" fieldLabel={t.proposalMergeInto}
                          options={(byTopic.get(p.topicKey) ?? []).filter(o => o.id !== p.id).map(o => ({ value: o.id, label: o.question }))}
                          initial={(byTopic.get(p.topicKey) ?? []).find(o => o.id !== p.id)?.id ?? ""} />
                      </div>
                      <div><SubmitButton className="button button--quiet">{t.proposalMerge}</SubmitButton></div>
                    </form>
                  )}
                </div>
              </>
            )}
          </section>
          )
        })}
      </div>

      {pages > 1 && (
        <nav className="mg-actions" aria-label={t.proposalsPage(page, pages)} style={{ marginTop: 16, alignItems: "center" }}>
          {page > 1 && <Link className="button button--quiet" href={href({ page: page - 1 })}>{t.proposalsPrev}</Link>}
          <span className="quiet">{t.proposalsPage(page, pages)}</span>
          {page < pages && <Link className="button button--quiet" href={href({ page: page + 1 })}>{t.proposalsNext}</Link>}
        </nav>
      )}
    </div>
    </AppShell>
  )
}
