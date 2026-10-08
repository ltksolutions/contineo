/**
 * /channels/[key]/history — analýza histórie schránky kanála (ADR-030, D180).
 * Len správca organizácie, rovnako ako nastavenie kanála, pod ktoré patrí.
 *
 * Krok 1 ťažby histórie: objem, odpovedanosť, čas do odpovede a časté slová
 * z predmetov po mesiacoch. Nič z toho nie je obsah správ — stránka ukazuje
 * len mesačný súhrn z `mailbox_analyses`.
 */

import { notFound, redirect } from "next/navigation"
import AppShell from "@/components/AppShell"
import Notice from "@/components/Notice"
import Select from "@/components/Select"
import SubmitButton from "@/components/SubmitButton"
import { orgContext } from "@/lib/orgSettings"
import { ChannelPartTabs, channelHref } from "@/components/ChannelTabs"
import { channelByKey, channelView } from "@/lib/channels"
import { isHelpdeskAgent } from "@/lib/helpdeskAgents"
import { analysisFor, summarizeAnalysis, monthRange, ANALYSIS_PERIODS, DEFAULT_ANALYSIS_MONTHS, MAX_FAILURES } from "@/lib/historyAnalysis"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary, formatDate, formatNumber, type UiLanguage } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import Link from "next/link"
import { harvestFor, exclusionCount, MIN_THREADS } from "@/lib/faqHarvest"
import { proposalCounts } from "@/lib/faqProposals"
import { startHistoryAnalysisAction, startHarvestAction, addHarvestExclusionsAction } from "../../actions"

export const dynamic = "force-dynamic"
// Akcia „Spustiť analýzu" číta prvý mesiac zo schránky (do 90 s, viď akciu).
export const maxDuration = 120

function percent(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0
}

/** Pribúda / ubúda: novšia polovica obdobia oproti staršej, s rezervou na šum. */
function trend(older: number, newer: number): "up" | "down" | null {
  if (newer >= Math.max(5, older * 1.5)) return "up"
  if (older >= Math.max(5, newer * 1.5)) return "down"
  return null
}

export default async function ChannelHistoryPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await orgContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const { key } = await params
  const { msg, error } = normalizeQuery<{ msg?: string; error?: string }>(await searchParams)
  const raw = await channelByKey(ctx.tenant.companyCode, decodeURIComponent(key))
  if (!raw || !raw.mailbox) notFound()
  const c = channelView(raw)
  const language: UiLanguage = ctx.person.language
  const t = dictionary(language).channels
  const branding = brandingView(ctx.tenant)
  const base = `${channelHref(c.key)}/history`
  const canTickets = c.kind === "widget" && c.tickets && isHelpdeskAgent(ctx.person) && raw.assigneeIds.includes(ctx.person.id)

  const [analysis, harvest, excluded, pCounts] = await Promise.all([
    analysisFor(ctx.tenant.companyCode, c.key),
    harvestFor(ctx.tenant.companyCode, c.key),
    exclusionCount(ctx.tenant.companyCode, c.key),
    proposalCounts(ctx.tenant.companyCode, c.key),
  ])
  const summary = analysis ? summarizeAnalysis(analysis) : null
  const doneMonths = analysis ? analysis.months.length - analysis.pending.length : 0
  const n = (x: number) => formatNumber(x, language)
  const hours = (x: number | null) => (x === null ? "—" : t.historyHours(formatNumber(Math.round(x * 10) / 10, language)))
  const monthLabel = (k: string) => {
    const d = monthRange(k).start
    return `${t.historyMonthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}`
  }
  const periodOptions = ANALYSIS_PERIODS.map(m => ({ value: String(m), label: t.historyPeriodOption(m) }))
  const bigTopics = harvest ? harvest.topics.filter(x => x.threads >= MIN_THREADS) : []
  const smallTopics = harvest ? harvest.topics.filter(x => x.threads > 0 && x.threads < MIN_THREADS) : []
  const draftTotal = bigTopics.length
  const draftDone = harvest ? draftTotal - harvest.draftPending.length : 0

  return (
    <AppShell language={language} title={t.history} trail={{ [channelHref(c.key)]: c.name, [channelHref(c.key, "settings")]: t.tabSettings }}>
    <div className="detail-page" style={{ maxWidth: 880, ...tenantStyle(branding) }}>
      <div className="page-head">
        <h1 className="page-title">{t.history}</h1>
        <span className="page-head-spacer" />
        <span className="tag">{c.name}</span>
      </div>
      <ChannelPartTabs channelKey={c.key} current={channelHref(c.key, "settings")} canTickets={canTickets} canSettings language={language} />
      <p className="quiet page-lead" style={{ margin: "0 0 16px" }}>{t.historyIntro}</p>
      <Notice message={msg} error={error === "1"} back={base} language={language} />

      <section className="card detail-block">
        {analysis ? (
          <>
            <p style={{ margin: 0 }}>
              {analysis.pending.length === 0
                ? t.historyDone(formatDate(analysis.finishedAt ?? analysis.updatedAt, language))
                : analysis.failures >= MAX_FAILURES
                  ? <span className="bad-fg">{t.historyStopped}</span>
                  : t.historyProgress(doneMonths, analysis.months.length)}
            </p>
            <p className="quiet" style={{ margin: 0 }}>{t.historyStartedBy(analysis.startedBy, formatDate(analysis.startedAt, language))}</p>
          </>
        ) : (
          <p className="quiet" style={{ margin: 0 }}>{t.historyNone}</p>
        )}
        <form action={startHistoryAnalysisAction} className="mg-inline" style={{ alignItems: "flex-end" }}>
          <input type="hidden" name="key" value={c.key} />
          <div className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.historyPeriod}</span>
            <Select language={language} name="months" fieldLabel={t.historyPeriod} options={periodOptions}
              initial={String(analysis?.months.length ?? DEFAULT_ANALYSIS_MONTHS)} />
          </div>
          <div><SubmitButton className={analysis ? "button button--quiet" : "button"}>{analysis ? t.historyRestart : t.historyStart}</SubmitButton></div>
        </form>
      </section>

      {summary && summary.months.length > 0 && (
        <>
          <div className="kpi" style={{ marginTop: 16 }}>
            <div className="card kpi-tile">
              <span className="kpi-label">{t.historyThreads}</span>
              <span className="kpi-value">{n(summary.threads)}</span>
              <span className="quiet kpi-note">{t.historyThreadsNote(n(summary.internalThreads))}</span>
            </div>
            <div className="card kpi-tile">
              <span className="kpi-label">{t.historyAnswered}</span>
              <span className="kpi-value">{n(summary.answered)}</span>
              <span className="quiet kpi-note">{t.historyAnsweredNote(percent(summary.answered, summary.threads))}</span>
            </div>
            <div className="card kpi-tile">
              <span className="kpi-label">{t.historyWithin24h}</span>
              <span className="kpi-value">{n(summary.answeredWithin24h)}</span>
              <span className="quiet kpi-note">{t.historyAnsweredNote(percent(summary.answeredWithin24h, summary.threads))}</span>
            </div>
            <div className="card kpi-tile">
              <span className="kpi-label">{t.historyMedianReply}</span>
              <span className="kpi-value">{hours(summary.medianReplyHours)}</span>
              <span className="quiet kpi-note">{t.historyMedianNote}</span>
            </div>
          </div>

          <section className="card detail-block" style={{ marginTop: 16 }}>
            <h2 className="detail-block-title">{t.historyTerms}</h2>
            <p className="detail-block-note" style={{ margin: 0 }}>{t.historyTermsIntro}</p>
            {summary.terms.length === 0 ? (
              <p className="quiet" style={{ margin: 0 }}>{t.historyTermsNone}</p>
            ) : (
              <div className="mg-list" style={{ margin: "0 -18px -18px", borderTop: "1px solid var(--line)" }}>
                {summary.terms.map(x => {
                  const dir = summary.trendReady ? trend(x.older, x.newer) : null
                  return (
                    <p key={x.term} className="mg-row">
                      <span className="mg-row-main"><b>{x.term}</b></span>
                      <span className="mg-sub">{t.historyTermMeta(n(x.threads), x.months)}</span>
                      {dir && <span className={`tag${dir === "up" ? " tag--warn" : ""}`}>{dir === "up" ? t.historyTrendUp : t.historyTrendDown}</span>}
                    </p>
                  )
                })}
              </div>
            )}
          </section>

          <h2 className="detail-block-title" style={{ margin: "24px 0 10px" }}>{t.historyMonths}</h2>
          <div className="doc-table-wrap mg-table">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>{t.historyColMonth}</th>
                  <th className="doc-col-right">{t.historyColIncoming}</th>
                  <th className="doc-col-right">{t.historyColThreads}</th>
                  <th className="doc-col-right">{t.historyColAnswered}</th>
                  <th className="doc-col-right">{t.historyColMedian}</th>
                  <th className="doc-col-right">{t.historyColBounces}</th>
                  <th className="doc-col-right">{t.historyColJunk}</th>
                </tr>
              </thead>
              <tbody>
                {summary.months.map(s => (
                  <tr key={s.month}>
                    <td>{monthLabel(s.month)}</td>
                    <td className="doc-col-right">{n(s.incoming)}</td>
                    <td className="doc-col-right">{n(s.threads)}</td>
                    <td className="doc-col-right">{n(s.answered)} <span className="quiet">({percent(s.answered, s.threads)} %)</span></td>
                    <td className="doc-col-right">{hours(s.medianReplyHours)}</td>
                    <td className="doc-col-right">{n(s.bounces)}</td>
                    <td className="doc-col-right">{n(s.junk)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mg-cards">
            {summary.months.map(s => (
              <div key={s.month} className="card mg-card">
                <span className="mg-title">{monthLabel(s.month)}</span>
                <span className="mg-sub">{t.historyMonthCard(n(s.incoming), n(s.threads), `${n(s.answered)} (${percent(s.answered, s.threads)} %)`)}</span>
                <span className="mg-sub">{t.historyMedianReply}: {hours(s.medianReplyHours)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Ťažba FAQ nad zvoleným obdobím (ADR-030, D183–D186). */}
      <section className="card detail-block" id="harvest" style={{ marginTop: 24 }}>
        <h2 className="detail-block-title">{t.harvest}</h2>
        <p className="detail-block-note" style={{ margin: 0 }}>{t.harvestIntro}</p>
        {harvest ? (
          <>
            <p style={{ margin: 0 }}>
              <b>{t.harvestStages[harvest.stage]}</b>{" · "}
              {harvest.failures >= MAX_FAILURES
                ? <span className="bad-fg">{t.harvestStopped}</span>
                : harvest.stage === "collect"
                  ? t.harvestCollectProgress(harvest.months.length - harvest.pending.length, harvest.months.length)
                  : harvest.stage === "draft"
                    ? t.harvestDraftProgress(draftDone, draftTotal)
                    : harvest.stage === "done" ? t.historyDone(formatDate(harvest.finishedAt ?? harvest.updatedAt, language)) : ""}
            </p>
            <p className="quiet" style={{ margin: 0 }}>
              {t.harvestCounts(n(harvest.counts.threads), n(harvest.counts.colleague), n(harvest.counts.unanswered), n(harvest.counts.excluded), n(harvest.counts.noTopic))}
            </p>
            <p className="quiet" style={{ margin: 0 }}>{t.historyStartedBy(harvest.startedBy, formatDate(harvest.startedAt, language))} · {t.historyPeriodOption(harvest.months.length)}</p>
          </>
        ) : (
          <p className="quiet" style={{ margin: 0 }}>{t.harvestNone}</p>
        )}
        <form action={startHarvestAction} className="mg-inline" style={{ alignItems: "flex-end" }}>
          <input type="hidden" name="key" value={c.key} />
          <div className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.historyPeriod}</span>
            <Select language={language} name="months" fieldLabel={t.historyPeriod} options={periodOptions}
              initial={String(harvest?.months.length ?? analysis?.months.length ?? DEFAULT_ANALYSIS_MONTHS)} />
          </div>
          <div><SubmitButton className={analysis || harvest ? "button button--quiet" : "button"}>{harvest ? t.harvestRestart : t.harvestStart}</SubmitButton></div>
        </form>
        {pCounts.open + pCounts.approved + pCounts.merged + pCounts.rejected > 0 && (
          <div><Link className="button button--quiet" href={`${channelHref(c.key)}/proposals`}>{t.harvestOpenProposals(pCounts.open)}</Link></div>
        )}
      </section>

      {harvest && bigTopics.length > 0 && (
        <section className="card detail-block" style={{ marginTop: 16 }}>
          <h2 className="detail-block-title">{t.harvestTopics}</h2>
          <p className="detail-block-note" style={{ margin: 0 }}>{t.harvestTopicsIntro(MIN_THREADS)}</p>
          <div className="mg-list" style={{ margin: "0 -18px", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
            {bigTopics.map(x => (
              <div key={x.key} className="mg-row">
                <span className="mg-row-main"><b>{x.label}</b></span>
                <span className="mg-sub">{t.harvestTopicMeta(n(x.threads), x.firstMonth ? monthLabel(x.firstMonth) : "—", x.lastMonth ? monthLabel(x.lastMonth) : "—")}</span>
                {x.proposals !== null && <span className="tag">{t.harvestTopicProposals(x.proposals)}</span>}
              </div>
            ))}
          </div>
          {smallTopics.length > 0 && (
            <p className="quiet" style={{ margin: 0 }}>{t.harvestTopicsSmall(smallTopics.length, n(smallTopics.reduce((a, x) => a + x.threads, 0)))}</p>
          )}
        </section>
      )}

      <section className="card detail-block" style={{ marginTop: 16 }}>
        <h2 className="detail-block-title">{t.harvestExclusions}</h2>
        <p className="detail-block-note" style={{ margin: 0 }}>{t.harvestExclusionsIntro}</p>
        <p className="quiet" style={{ margin: 0 }}>{t.harvestExclusionsCount(excluded)}</p>
        <form action={addHarvestExclusionsAction} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="key" value={c.key} />
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">{t.harvestExclusionsField}</span>
            <textarea className="field-input" name="addresses" rows={3} autoComplete="off" />
          </label>
          <div><SubmitButton className="button button--quiet">{t.harvestExclusionsSave}</SubmitButton></div>
        </form>
      </section>
    </div>
    </AppShell>
  )
}
