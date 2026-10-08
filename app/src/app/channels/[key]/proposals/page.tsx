/**
 * /channels/[key]/proposals — fronta kurátora pre návrhy FAQ z histórie
 * schránky kanála (ADR-030, D185). Len správca obsahu (`libraryContext`).
 *
 * Každý návrh je karta s vlastnými úkonmi, preto sú všetky tlačidlá tiché
 * (CLAUDE.md, R1). Pohľad „Na rozhodnutie / Rozhodnuté" je prepínač
 * `.view-switch` so stavom v adrese (`?view=decided`).
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
import { listProposals, proposalCounts, type FaqProposal } from "@/lib/faqProposals"
import { monthRange } from "@/lib/historyAnalysis"
import { getCollection } from "@/lib/mongodb"
import { DOCUMENTS_COLLECTION } from "@/lib/documents"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, formatNumber, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { approveProposalAction, rejectProposalAction, mergeProposalAction } from "../../proposalActions"

export const dynamic = "force-dynamic"

/** Toľko kariet naraz — každá má formulár s dlhou odpoveďou. */
const PAGE = 30

export default async function ProposalsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await libraryContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { key } = await params
  const { msg, error, view } = normalizeQuery<{ msg?: string; error?: string; view?: string }>(await searchParams)
  const raw = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!raw) notFound()
  const c = channelView(raw)
  const language: UiLanguage = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const decided = view === "decided"
  const base = `${channelHref(c.key)}/proposals`

  const [list, counts, faqDocs] = await Promise.all([
    listProposals(ctx.tenant.companyCode, c.key, decided ? "decided" : "open"),
    proposalCounts(ctx.tenant.companyCode, c.key),
    (await getCollection(DOCUMENTS_COLLECTION))
      .find({ companyCode: ctx.tenant.companyCode, category: "faq" }, { projection: { documentId: 1, title: 1, folderPath: 1 } })
      .sort({ title: 1 }).toArray() as unknown as Promise<{ documentId: string; title?: string; folderPath?: string[] }[]>,
  ])
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
  const shown = list.slice(0, PAGE)
  const byTopic = new Map<string, FaqProposal[]>()
  for (const p of list) byTopic.set(p.topicKey, [...(byTopic.get(p.topicKey) ?? []), p])
  const decidedCount = counts.approved + counts.merged + counts.rejected

  return (
    <AppShell language={language} title={t.proposals} trail={{ [channelHref(c.key)]: c.name }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.proposals}</h1>
        <span className="page-head-spacer" />
        <span className="tag">{c.name}</span>
      </div>
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.proposalsIntro}</p>
      <Notice message={msg} error={error === "1"} back={decided ? `${base}?view=decided` : base} language={language} />

      <nav className="view-switch view-switch--fit" aria-label={t.proposals} style={{ marginBottom: 16 }}>
        <Link className={`view-switch-item${decided ? "" : " is-on"}`} aria-current={decided ? undefined : "true"} href={base}>
          {t.proposalsViewOpen} <span className="view-switch-count">{n(counts.open)}</span>
        </Link>
        <Link className={`view-switch-item${decided ? " is-on" : ""}`} aria-current={decided ? "true" : undefined} href={`${base}?view=decided`}>
          {t.proposalsViewDecided} <span className="view-switch-count">{n(decidedCount)}</span>
        </Link>
      </nav>

      {!decided && faqOptions.length === 0 && <p className="tag tag--warn" style={{ justifySelf: "start" }}>{t.proposalsNoFaq}</p>}
      {shown.length === 0 && <p className="quiet">{t.proposalsEmpty}</p>}

      <div style={{ display: "grid", gap: 16 }}>
        {shown.map(p => (
          <section key={p.id} className="card detail-block" id={p.id}>
            <div className="mg-pills">
              <span className="tag">{t.proposalTopic}: {p.topicLabel}</span>
              {p.flags.changedOverTime && <span className="tag tag--warn">{t.proposalChanged}</span>}
              {p.flags.normConflict && <span className="tag tag--warn">{t.proposalNormConflict}</span>}
              {decided && p.status !== "open" && <span className="tag">{t.proposalStatus[p.status]}</span>}
            </div>
            <p className="quiet" style={{ margin: 0 }}>{t.proposalThreads(n(p.threads), monthLabel(p.firstMonth), monthLabel(p.lastMonth))}</p>
            {p.note && <p style={{ margin: 0 }}><b>{t.proposalNote}:</b> {p.note}</p>}
            {p.sources.length > 0 && (
              <p className="quiet" style={{ margin: 0 }}>
                {t.proposalSources}: {p.sources.map((s, i) => (
                  <span key={`${s.documentId}|${s.articleRef ?? ""}`}>{i > 0 && " · "}<Link href={`/library/${encodeURIComponent(s.documentId)}`}>{s.title}{s.articleRef ? `, ${s.articleRef}` : ""}</Link></span>
                ))}
              </p>
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
                    <textarea className="field-input" name="answer" required rows={8} defaultValue={p.answer} />
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
                  {faqOptions.length > 0 && <div><SubmitButton className="button button--quiet">{t.proposalApprove}</SubmitButton></div>}
                </form>
                <div className="mg-actions">
                  <form action={rejectProposalAction}>
                    <input type="hidden" name="key" value={c.key} />
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton className="button button--quiet">{t.proposalReject}</SubmitButton>
                  </form>
                  {(byTopic.get(p.topicKey) ?? []).length > 1 && (
                    <form action={mergeProposalAction} className="mg-inline" style={{ alignItems: "flex-end" }}>
                      <input type="hidden" name="key" value={c.key} />
                      <input type="hidden" name="id" value={p.id} />
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
        ))}
      </div>
      {list.length > PAGE && <p className="quiet" style={{ marginTop: 16 }}>{t.proposalsMore(list.length - PAGE)}</p>}
    </div>
    </AppShell>
  )
}
