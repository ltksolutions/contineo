/**
 * /channels/[key]/proposals — fronta kurátora pre návrhy FAQ z histórie
 * schránky kanála (ADR-030, D185). Len správca obsahu (`libraryContext`).
 *
 * Návrh KANALY-navrhy-faq-kuracia (11. 10. 2026, Q1–Q7 A), vzor
 * KNIZ-kontrola-suladu-detail: od 1024 px témy vľavo (`NavigationSplitView`),
 * pod 1024 px riadok „Téma 1 z 17 ›" a zoznam cez `?topics=1`. Vpravo
 * návrhy jednej témy; otvorený je vždy len jeden (`?p=`). Stav je v adrese:
 * `topic`, `view` (Nerozhodnuté / Na rozhodnutie / Rozhodnuté / Všetky),
 * `review` (výsledok kontroly), `p`, `act` (zamietnuť / zlúčiť), `check`.
 *
 * Každý návrh je karta s vlastnými úkonmi, preto sú všetky tlačidlá tiché
 * (CLAUDE.md, R1); „Schváliť do FAQ a ďalší" otvorí ďalší nerozhodnutý.
 * Bez JavaScriptu funguje všetko.
 */

import { isPeopleAdmin } from "@/lib/people"
import { isHelpdeskAgent } from "@/lib/helpdeskAgents"
import { ChannelPartTabs, channelHref } from "@/components/ChannelTabs"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import MultiSelect from "@/components/MultiSelect"
import SubmitButton from "@/components/SubmitButton"
import { libraryContext } from "@/lib/library"
import { channelByKey, channelView } from "@/lib/channels"
import { channelProposals, originalOf, PROPOSAL_FILTERS, type FaqProposal, type ProposalFilter } from "@/lib/faqProposals"
import {
  defaultTopic, filterProposals, needsDecision, nextOpen, noteWithoutMark, periodMonths, topicStats, verdictCounts, viewCounts,
} from "@/lib/proposalView"
import { wordDiff, hasChanges, type WordDiffPart } from "@/lib/wordDiff"
import { reviewRunFor, proposalsScopeKey, REVIEW_VERDICTS, MAX_FAILURES as REVIEW_MAX_FAILURES, type ReviewVerdict, isRunning } from "@/lib/complianceCheck"
import { monthRange } from "@/lib/historyAnalysis"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, formatNumber, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { approveProposalAction, saveProposalAction, rejectProposalAction, mergeProposalAction, startReviewAction, applyReviewAction, dismissReviewAction } from "../../proposalActions"

export const dynamic = "force-dynamic"

/** Toľko variantov je vidieť hneď; ďalšie sú v rozbaľovačke. */
const VARIANTS_SHOWN = 4

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

const VERDICT_TAG: Record<ReviewVerdict, string> = { differs: "tag tag--warn", conflict: "tag tag--bad", agree: "tag tag--published", not_covered: "tag" }

export default async function ProposalsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { key } = await params
  const q = normalizeQuery<{ msg?: string; error?: string; view?: string; topic?: string; review?: string; p?: string; act?: string; topics?: string; check?: string }>(await searchParams)
  const raw = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!raw) notFound()
  const c = channelView(raw)
  const language: UiLanguage = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const view: ProposalFilter = (PROPOSAL_FILTERS as string[]).includes(q.view ?? "") ? (q.view as ProposalFilter) : "open"
  const review = (REVIEW_VERDICTS as string[]).includes(q.review ?? "") ? (q.review as ReviewVerdict) : null
  const checking = q.check === "1"
  const base = `${channelHref(c.key)}/proposals`

  const [all, faqDocs, run, libDocs] = await Promise.all([
    channelProposals(ctx.tenant.companyCode, c.key),
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, category: "faq" }, { projection: { documentId: 1, title: 1, folderPath: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string; folderPath?: string[] }[]>,
    reviewRunFor(ctx.tenant.companyCode, proposalsScopeKey(c.key)),
    // Verejné dokumenty okrem FAQ: referencie kontroly (ADR-032 D194) aj zdroje záznamu.
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, accessLevel: "public", category: { $ne: "faq" } }, { projection: { documentId: 1, title: 1, category: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string; category?: string }[]>,
  ])
  const stats = topicStats(all)
  const topic = stats.find(s => s.topicKey === q.topic) ?? defaultTopic(stats)
  const inTopic = topic ? all.filter(p => p.topicKey === topic.topicKey) : []
  const shown = filterProposals(inTopic, view, review)
  const counts = viewCounts(inTopic)
  const verdicts = verdictCounts(inTopic)
  const openAll = all.filter(p => p.status === "open")
  const decidedAll = all.length - openAll.length
  const months = periodMonths(all)
  const running = isRunning(run)

  // Odkaz so stavom obrazovky; `open` je predvolený pohľad a do adresy nejde.
  const href = (o: { topic?: string | null; view?: ProposalFilter; review?: ReviewVerdict | null; p?: string; act?: string; topics?: boolean; check?: boolean } = {}, anchor = "") => {
    const p = new URLSearchParams()
    const tp = o.topic === undefined ? topic?.topicKey : o.topic
    const v = o.view ?? view
    const rv = o.review === undefined ? review : o.review
    if (tp) p.set("topic", tp)
    if (v !== "open") p.set("view", v)
    if (rv) p.set("review", rv)
    if (o.p) p.set("p", o.p)
    if (o.act) p.set("act", o.act)
    if (o.topics) p.set("topics", "1")
    if (o.check) p.set("check", "1")
    const s = p.toString()
    return `${base}${s ? `?${s}` : ""}${anchor ? `#${anchor}` : ""}`
  }
  const backQuery = href({}).split("?")[1]?.split("#")[0] ?? ""

  // FAQ kanála (D201) prvé, potom FAQ v priečinkoch kanála — tam patria záznamy z jeho schránky.
  const inChannel = (d: { documentId: string; folderPath?: string[] }) => (d.documentId === raw.faqDocumentId ? 2 : 0) + ((d.folderPath ?? []).some(f => raw.folderIds.includes(f)) ? 1 : 0)
  const faqOptions = faqDocs
    .slice().sort((a, b) => inChannel(b) - inChannel(a))
    .map(d => ({ value: d.documentId, label: String(d.title ?? d.documentId) }))
  const n = (x: number) => formatNumber(x, language)
  const monthLabel = (k: string | null) => {
    if (!k) return "—"
    const d = monthRange(k).start
    return `${t.historyMonthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  }
  const docOptions = (current: { documentId: string; title: string }[]) => {
    const known = new Set(libDocs.map(d => d.documentId))
    return [
      { value: "", label: t.sourceDocPlaceholder },
      ...current.filter(s => !known.has(s.documentId)).map(s => ({ value: s.documentId, label: s.title })),
      ...libDocs.map(d => ({ value: d.documentId, label: String(d.title ?? d.documentId) })),
    ]
  }

  const topicRow = (s: (typeof stats)[number]) => {
    const on = s.topicKey === topic?.topicKey
    const sub = s.open > 0 && s.notCovered === s.open ? t.topicNotCovered : s.differs ? t.topicDiffers(s.differs) : ""
    return (
      <Link key={s.topicKey} className={`form-row cf-doc${on && q.topics !== "1" ? " is-on" : ""}`} href={href({ topic: s.topicKey, review: null })} aria-current={on ? "page" : undefined}>
        <span className="form-row-main">
          <b>{s.topicLabel}</b>
          {sub && <span className="form-row-sub">{sub}</span>}
        </span>
        {s.decision > 0 && <span className="tag tag--warn">{t.topicDecision(s.decision)}</span>}
        {s.open === 0 ? <span className="tag tag--published">{t.topicDone}</span> : <span className="cf-n">{n(s.open)}</span>}
      </Link>
    )
  }
  const topicList = (
    <div className="cf-side">
      <div className="cf-side-h">{t.topicsHeading(stats.filter(s => s.open > 0).length)}</div>
      <div className="card form-group-body form-group-body--rows"><div className="form-list">{stats.map(topicRow)}</div></div>
    </div>
  )

  const decidedRow = (p: FaqProposal) => {
    const target = p.mergedInto ? all.find(x => x.id === p.mergedInto) : null
    const who = [p.decidedBy, p.decidedAt ? formatDate(p.decidedAt, language) : null].filter(Boolean).join(" · ")
    return (
      <div key={p.id} id={p.id} className="card cf-row pq-row">
        <span className={p.status === "approved" ? "tag tag--published" : "tag"}>{t.proposalStatusTag[p.status as "approved" | "merged" | "rejected"]}</span>
        <span className="pq-q">
          <b>{p.question}</b>
          <span>
            {who}
            {p.status === "rejected" && p.rejectReason && <> · {p.rejectReason}</>}
            {p.status === "merged" && target && <> · {t.mergedIntoLabel} <Link href={href({ topic: target.topicKey, p: target.id }, target.id)}>{target.question}</Link></>}
          </span>
        </span>
        {p.status === "approved" && p.faqDocumentId && (
          <Link className="pq-faq" href={`/library/${encodeURIComponent(p.faqDocumentId)}/faq`} target="_blank" rel="noopener" aria-label={`${t.faqLink} (${t.opensNewWindow})`}>{t.faqLink} ↗</Link>
        )}
      </div>
    )
  }

  const collapsedRow = (p: FaqProposal) => {
    const v = p.review?.verdict ?? null
    return (
      <div key={p.id} id={p.id} className="card cf-row pq-row">
        <span className="pq-q"><b>{p.question}</b><span>{t.threadsCount(n(p.threads))}</span></span>
        <span className="pq-tags">
          {needsDecision(p) && <span className="tag tag--warn">{t.decisionNote}</span>}
          {v && <span className={VERDICT_TAG[v]}>{t.reviewVerdictsShort[v]}</span>}
          {p.sources.length === 0 && <span className="tag">{t.noSourceTag}</span>}
        </span>
        <Link className="button button--quiet button--sm" href={href({ p: p.id }, p.id)}>{t.decide}</Link>
      </div>
    )
  }

  const openCard = (p: FaqProposal) => {
    const original = originalOf(p)
    const qDiff = original ? wordDiff(original.question, p.question) : null
    const aDiff = original ? wordDiff(original.answer, p.answer) : null
    const vDiff = original ? wordDiff(original.variants.join("\n"), p.variants.join("\n")) : null
    const changed = Boolean(qDiff && aDiff && vDiff && (hasChanges(qDiff) || hasChanges(aDiff) || hasChanges(vDiff)))
    const next = nextOpen(all, stats, p.id)
    const siblings = inTopic.filter(x => x.status === "open" && x.id !== p.id)
    const note = needsDecision(p) ? noteWithoutMark(p.note) : p.note
    const rv = p.review
    const hidden = (
      <>
        <input type="hidden" name="key" value={c.key} />
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="back" value={backQuery} />
      </>
    )
    return (
      <article key={p.id} id={p.id} className="card cf is-open pq">
        <div className="cf-head">
          <b>{p.question}</b>
          <Link href={href({}, p.id)}>{t.collapse}</Link>
        </div>
        <p className="quiet pq-who">{t.proposalThreads(n(p.threads), monthLabel(p.firstMonth), monthLabel(p.lastMonth))}</p>

        {/* [NA ROZHODNUTIE] je prvé, čo kurátor vidí; iná poznámka (napr. zo zlúčenia) na tom istom mieste. */}
        {note && (
          <div className={needsDecision(p) ? "lnote lnote--warn pq-note" : "lnote lnote--info pq-note"}>
            <span className="lnote-mark" aria-hidden="true">{needsDecision(p) ? "?" : "i"}</span>
            <span className="lnote-text">{needsDecision(p) ? <b>{t.decisionNote}</b> : <b>{t.proposalNote}</b>}<span className="pq-note-text">{note}</span></span>
          </div>
        )}

        {rv && (
          <div className="pq-rv">
            <div className="pq-rv-head">
              <span className={VERDICT_TAG[rv.verdict]}>{t.reviewVerdictsShort[rv.verdict]}</span>
              <b>{t.reviewHeading}</b>
              <span className="quiet">{formatDate(rv.at, language)}</span>
              {rv.decision && rv.verdict !== "agree" && <span className="tag">{t.reviewDecision[rv.decision]}</span>}
            </div>
            {rv.note && <p className="pq-rv-note">{rv.note}</p>}
            {rv.citations.map((ci, i) => (
              <div key={i} className="cf-blk">
                <span className="cf-blk-l">{t.reviewNorm}</span>
                <p><a href={`/library/${encodeURIComponent(ci.documentId)}`} target="_blank" rel="noopener" aria-label={`${ci.title}${ci.articleRef ? `, ${ci.articleRef}` : ""} (${t.opensNewWindow})`}>
                  {ci.title}{ci.articleRef ? `, ${ci.articleRef}` : ""}<span className="pq-ext" aria-hidden="true">↗</span>
                </a></p>
                {ci.quote && <blockquote className="quote">{ci.quote}</blockquote>}
              </div>
            ))}
            {rv.verdict === "not_covered" && <p className="quiet pq-who">{t.reviewNotCoveredAgainst(rv.documents.map(d => d.title).join(", "))}</p>}
            {rv.proposed && !rv.decision && rv.verdict !== "agree" && rv.verdict !== "not_covered" && (
              <>
                {rv.proposed.question !== p.question && (
                  <div className="cf-blk"><span className="cf-blk-l">{t.reviewQuestionChange}</span><div className="cf-diff"><Diff parts={wordDiff(p.question, rv.proposed.question)} /></div></div>
                )}
                <div className="cf-blk"><span className="cf-blk-l">{t.reviewChange}</span><div className="cf-diff"><Diff parts={wordDiff(p.answer, rv.proposed.answer)} /></div></div>
                {/* Prevzatie prepíše polia Úpravy — kurátor ich potom doladí pred schválením (Q6). */}
                <div className="cf-acts">
                  <form action={applyReviewAction}>{hidden}<SubmitButton className="button button--quiet">{t.reviewApply}</SubmitButton></form>
                  <form action={dismissReviewAction}>{hidden}<SubmitButton className="button button--quiet">{t.reviewDismiss}</SubmitButton></form>
                </div>
              </>
            )}
          </div>
        )}

        <form action={approveProposalAction} className="pq-edit">
          {hidden}
          {next && <input type="hidden" name="next" value={`${next.topicKey}:${next.id}`} />}
          <input type="hidden" name="sourcesShown" value="1" />
          <h3 className="pq-edit-h">{t.editHeading}</h3>
          <p className="quiet field-hint pq-intro">{t.proposalsIntro}</p>
          <label className="field">
            <span className="field-label">{t.proposalQuestion}</span>
            <input className="field-input" name="question" required maxLength={300} defaultValue={p.question} />
          </label>
          {p.variants.length > 0 && (
            <div className="field">
              <span className="field-label" id={`${p.id}-variants`}>{t.variantsCount(p.variants.length)}</span>
              <div className="card form-group-body form-group-body--rows" role="group" aria-labelledby={`${p.id}-variants`}>
                <div className="form-list">
                  {p.variants.slice(0, VARIANTS_SHOWN).map(v => (
                    <label key={v} className="form-row select-row"><input type="checkbox" name="variants" value={v} defaultChecked /><span className="form-row-main"><span>{v}</span></span></label>
                  ))}
                </div>
                {p.variants.length > VARIANTS_SHOWN && (
                  <details className="pq-more">
                    <summary>{t.moreVariants(p.variants.length - VARIANTS_SHOWN)}</summary>
                    <div className="form-list">
                      {p.variants.slice(VARIANTS_SHOWN).map(v => (
                        <label key={v} className="form-row select-row"><input type="checkbox" name="variants" value={v} defaultChecked /><span className="form-row-main"><span>{v}</span></span></label>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <span className="quiet field-hint">{t.variantRemoveHint}</span>
            </div>
          )}
          <label className="field">
            <span className="field-label">{t.variantsAdd}</span>
            <textarea className="field-input" name="variantsNew" rows={2} placeholder={t.variantsAddHint} />
          </label>
          <label className="field">
            <span className="field-label">{t.proposalAnswer}</span>
            <textarea className="field-input" name="answer" required rows={10} defaultValue={p.answer} />
            <span className="quiet field-hint">{t.markdownHint}</span>
          </label>
          <label className="field">
            <span className="field-label">{t.proposalAudience}</span>
            <input className="field-input" name="audience" defaultValue={p.audience.join(", ")} />
            <span className="quiet field-hint">{t.proposalAudienceHint}</span>
          </label>
          <div className="field">
            <span className="field-label">{t.sourcesLabel}</span>
            {[...p.sources, null].map((s, i) => (
              <div key={s ? `${s.documentId}|${s.articleRef ?? ""}` : "new"} className="pq-src">
                <Select language={language} name="sourceDoc" fieldLabel={t.sourcesLabel} options={docOptions(p.sources)} initial={s?.documentId ?? ""} />
                <input className="field-input pq-src-ref" name="sourceRef" defaultValue={s?.articleRef ?? ""} placeholder={t.sourceRef} aria-label={t.sourceRef} />
                {s ? (
                  <label className="pq-src-x" title={t.sourceRemove(s.title)}>
                    <input type="checkbox" name="sourceRemove" value={String(i)} aria-label={t.sourceRemove(s.title)} />
                    <span aria-hidden="true">✕</span>
                  </label>
                ) : <span />}
              </div>
            ))}
            <span className="quiet field-hint">{t.sourcesHint}</span>
          </div>
          {faqOptions.length > 0 ? (
            <div className="field">
              <span className="field-label">{t.proposalDocument}</span>
              <Select language={language} name="documentId" fieldLabel={t.proposalDocument} options={faqOptions} initial={faqOptions[0].value} />
            </div>
          ) : <p className="tag tag--warn pq-nofaq">{t.proposalsNoFaq}</p>}

          {original && qDiff && aDiff && vDiff && (
            <details className="pr-original">
              <summary>{t.proposalOriginal}{p.editedAt && <span className="quiet"> · {t.proposalEdited(p.editedBy ?? "", formatDate(p.editedAt, language))}</span>}</summary>
              {changed ? (
                <div className="pr-original-body">
                  <p className="quiet" style={{ margin: 0 }}>{t.proposalOriginalIntro}</p>
                  <p style={{ margin: 0 }}><b>{t.proposalQuestion}:</b> <Diff parts={qDiff} /></p>
                  {(original.variants.length > 0 || p.variants.length > 0) && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.proposalVariants}:</b>{"\n"}<Diff parts={vDiff} /></p>}
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}><b>{t.proposalAnswer}:</b>{"\n"}<Diff parts={aDiff} /></p>
                </div>
              ) : <p className="quiet" style={{ margin: 0 }}>{t.proposalNoChanges}</p>}
            </details>
          )}

          <div className="cf-acts">
            {faqOptions.length > 0 && <SubmitButton className="button button--quiet">{next ? t.approveNext : t.approveOnly}</SubmitButton>}
            <SubmitButton className="button button--quiet" formAction={saveProposalAction}>{t.saveShort}</SubmitButton>
            {faqOptions.length > 0 && <span className="quiet">{next ? t.nextIs(next.question) : t.lastOpen}</span>}
          </div>
        </form>

        {q.act === "reject" ? (
          <form action={rejectProposalAction} className="pq-sub">
            {hidden}
            <input type="hidden" name="act" value="reject" />
            {next && <input type="hidden" name="next" value={`${next.topicKey}:${next.id}`} />}
            <b>{t.rejectTitle}</b>
            <label className="field">
              <span className="field-label">{t.rejectReason}</span>
              <textarea className="field-input" name="reason" rows={3} required maxLength={500} />
              <span className="quiet field-hint">{t.rejectReasonHint}</span>
            </label>
            <div className="cf-acts">
              <SubmitButton className="button button--quiet">{t.proposalReject}</SubmitButton>
              <Link className="pq-cancel" href={href({ p: p.id }, p.id)}>{t.proposalCancel}</Link>
            </div>
          </form>
        ) : q.act === "merge" && siblings.length > 0 ? (
          <form action={mergeProposalAction} className="pq-sub">
            {hidden}
            <input type="hidden" name="act" value="merge" />
            {next && <input type="hidden" name="next" value={`${next.topicKey}:${next.id}`} />}
            <b>{t.mergeTitle}</b>
            <div className="card form-group-body form-group-body--rows" role="radiogroup" aria-label={t.mergeTitle}>
              <div className="form-list">
                {siblings.map((o, i) => (
                  <label key={o.id} className="form-row choice-row">
                    <span className="form-row-main"><span>{o.question}</span><span className="form-row-sub">{t.threadsCount(n(o.threads))}</span></span>
                    <input type="radio" name="into" value={o.id} defaultChecked={i === 0} required />
                  </label>
                ))}
              </div>
            </div>
            <p className="quiet field-hint">{t.mergeExplain}</p>
            <div className="cf-acts">
              <SubmitButton className="button button--quiet">{t.proposalMerge}</SubmitButton>
              <Link className="pq-cancel" href={href({ p: p.id }, p.id)}>{t.proposalCancel}</Link>
            </div>
          </form>
        ) : (
          <div className="pq-acts2">
            <Link className="button button--quiet button--sm" href={href({ p: p.id, act: "reject" }, p.id)}>{t.rejectOpen}</Link>
            {siblings.length > 0 && <Link className="button button--quiet button--sm" href={href({ p: p.id, act: "merge" }, p.id)}>{t.mergeOpen}</Link>}
          </div>
        )}
      </article>
    )
  }

  const nextTopicWithOpen = topic ? stats.find(s => s.topicKey !== topic.topicKey && s.open > 0) : null
  const topicMain = topic && (
    <div className="cf-main">
      <div className="pq-topic-h">
        <div className="pq-topic-t"><h2>{topic.topicLabel}</h2><span className="quiet">{t.openInTopic(topic.open)}</span></div>
        <nav className="view-switch cf-filter pq-filter" aria-label={t.proposals}>
          {([["open", t.proposalsViewOpen], ["decision", t.proposalsViewDecision], ["decided", t.proposalsViewDecided], ["all", t.proposalsViewAll]] as const).map(([k, label]) => (
            <Link key={k} className={`view-switch-item${view === k ? " is-on" : ""}`} href={href({ view: k })} aria-current={view === k ? "page" : undefined}>
              {label}<span className="view-switch-count">{n(counts[k])}</span>
            </Link>
          ))}
        </nav>
        {run && (
          <div className="pq-chips">
            <span className="quiet">{t.reviewLabel}</span>
            {REVIEW_VERDICTS.map(v => verdicts[v] ? (
              <Link key={v} className={`pq-chip${review === v ? " is-on" : ""}`} href={href({ review: review === v ? null : v })} aria-current={review === v ? "true" : undefined}>
                {t.reviewVerdictsChip[v]}<span className="pq-chip-n">{n(verdicts[v])}</span>
              </Link>
            ) : (
              <span key={v} className="pq-chip is-off">{t.reviewVerdictsChip[v]}<span className="pq-chip-n">0</span></span>
            ))}
          </div>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="card empty">
          <div className="empty-title">{view === "decided" ? t.decidedNone : view === "open" && topic.open === 0 ? t.topicAllDecided : t.proposalsEmpty}</div>
          {view === "open" && topic.open === 0 && (
            <div className="empty-text">{t.topicSummary(inTopic.filter(x => x.status === "approved").length, inTopic.filter(x => x.status === "rejected").length, inTopic.filter(x => x.status === "merged").length)}</div>
          )}
          {view === "open" && nextTopicWithOpen && (
            <div className="empty-action"><Link href={href({ topic: nextTopicWithOpen.topicKey, review: null })}>{t.nextTopic(nextTopicWithOpen.topicLabel)}</Link></div>
          )}
        </div>
      ) : (
        <div className="cf-list">
          {shown.map(p => p.status !== "open" ? decidedRow(p) : q.p === p.id ? openCard(p) : collapsedRow(p))}
        </div>
      )}
    </div>
  )

  return (
    <AppShell language={language} title={t.proposals} trail={{ "/channels": t.heading, [channelHref(c.key)]: c.name }}>
    <div className="cf-page pq-page" style={tenantStyle(branding)}>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{t.proposals}</h1>
          <p className="quiet page-lead">{t.proposalsLead(c.name, openAll.length, months ? t.periodLabel(months) : null)}</p>
        </div>
        {/* Kým kontrola beží, nový štart sa neponúka — prepísal by rozbehnutý beh (Ján 11. 10. 2026). */}
        <div className="page-tools">
          {running ? (
            <span className="pq-run"><i aria-hidden="true" />{t.reviewRunningShort(run!.total - run!.pending.length, run!.total)}</span>
          ) : !checking && openAll.length > 0 && (
            <Link className="button button--quiet" href={href({ check: true }, "check")}>{t.reviewStart}</Link>
          )}
        </div>
      </div>
      <ChannelPartTabs channelKey={c.key} current={channelHref(c.key, "proposals")}
        canTickets={c.kind === "widget" && raw.tickets && isHelpdeskAgent(ctx.person) && raw.assigneeIds.includes(ctx.person.id)}
        canSettings={isPeopleAdmin(ctx.person)} canContent hasFaq={Boolean(raw.faqDocumentId)} language={language} />
      <Notice message={q.msg} error={q.error === "1"} back={href({ p: q.p }, q.p ?? "")} language={language} />

      {/* Kontrola proti dokumentom knižnice (ADR-032) — úloha cez adresu `?check=1`. */}
      {checking && !running && (
        <form action={startReviewAction} className="card task-card" id="check">
          <input type="hidden" name="key" value={c.key} />
          <input type="hidden" name="back" value={backQuery} />
          <input type="hidden" name="act" value="check" />
          <h2>{t.review}</h2>
          <p className="quiet">{t.reviewIntro}</p>
          <div className="field">
            <span className="field-label">{t.reviewDocuments}</span>
            <MultiSelect name="documentIds" options={libDocs.map(d => ({ value: d.documentId, label: String(d.title ?? d.documentId) }))}
              selected={run?.documentIds ?? []} emit="repeat" caseSensitive noscript="checkboxes" language={language} />
          </div>
          {stats.length > 1 && (
            <label className="field">
              <span className="field-label">{t.reviewScope}</span>
              <select className="field-input" name="topic" defaultValue={topic?.topicKey ?? ""}>
                <option value="">{t.reviewScopeAll}</option>
                {stats.filter(s => s.open > 0).map(x => <option key={x.topicKey} value={x.topicKey}>{x.topicLabel} ({x.open})</option>)}
              </select>
            </label>
          )}
          <div className="task-acts">
            <SubmitButton className="button button--quiet">{t.reviewStart}</SubmitButton>
            <Link className="button button--quiet" href={href({})}>{t.proposalCancel}</Link>
          </div>
        </form>
      )}

      {all.length === 0 ? (
        <div className="card empty"><div className="empty-title">{t.proposalsEmpty}</div></div>
      ) : (
        <>
          <section className="card cf-prog">
            <div className="cf-prog-body">
              <div className="cf-prog-top"><b>{t.decidedOf(decidedAll, all.length)}</b>{openAll.length > 0 && <span className="quiet">{t.remaining(openAll.length)}</span>}</div>
              <div className="cf-bar" role="progressbar" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={decidedAll}>
                <i style={{ width: `${(decidedAll / all.length) * 100}%` }} />
              </div>
              {run && (
                <div className="cf-kinds">
                  <span className="quiet">{t.reviewLabel}</span>
                  {(["agree", "differs", "not_covered", "conflict"] as const).map(v => <span key={v} className="tag">{t.reviewVerdictsShort[v]} {n(run.counts[v])}</span>)}
                  {openAll.some(needsDecision) && <span className="tag tag--warn">{t.decisionCount(openAll.filter(needsDecision).length)}</span>}
                </div>
              )}
            </div>
            {run && (
              <details className="cf-meta">
                <summary>
                  <span className="quiet">{t.reviewLast}</span>
                  <span>{running ? t.reviewRunningSince(formatDate(run.startedAt, language)) : t.reviewLastSummary(formatDate(run.finishedAt ?? run.updatedAt, language), run.documents.length)}</span>
                </summary>
                <div className="pq-meta-body">
                  {run.failures >= REVIEW_MAX_FAILURES && <p className="bad-fg">{t.reviewStopped}</p>}
                  <p className="quiet">{t.reviewAgainst(run.documents.map(d => `${d.title}${d.state === "draft" ? ` (${t.reviewDraftMark})` : d.label ? ` (${d.label})` : ""}`).join(", "))}</p>
                </div>
              </details>
            )}
          </section>

          <div className="cf-split">
            <div className="cf-split-side">{topicList}</div>
            {/* `?topics=1` platí len pod 1024 px; od 1024 px sú témy v paneli a obsah ostáva. */}
            <div className={q.topics === "1" ? "cf-split-main is-docs" : "cf-split-main"}>
              {q.topics === "1" && <div className="cf-docs-full">{topicList}</div>}
              {topic && (
                <Link className="card form-row cf-pick" href={href({ topics: true })}>
                  <span className="form-row-main">
                    <span className="cf-pick-k">{t.topicPosition(stats.indexOf(topic) + 1, stats.length)}</span>
                    <b>{topic.topicLabel}</b>
                  </span>
                  <span className="cf-n">{n(topic.open)}</span>
                  <span className="cf-pick-chev" aria-hidden="true">›</span>
                </Link>
              )}
              {topicMain}
            </div>
          </div>
        </>
      )}
    </div>
    </AppShell>
  )
}
