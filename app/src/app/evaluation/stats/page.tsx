/**
 * Štatistika posudkov — po mesiacoch a podľa zdroja (Ján 30. 10. 2026:
 * „chýbajú mi prehľady, prípadne nejaká štatistika").
 *
 * Vlastná adresa, nie `?tab=` — cesta ju má pomenovať (CLAUDE.md). Po
 * mesiacoch / podľa zdroja je to isté inak zoskupené, preto sivý
 * `.view-switch` a `?by=`. Graf a matica sú prvky design systému z Prehľadu
 * spotreby AI („Grafy a matice"), nič vlastné.
 *
 * Mesiace pred prvou odpoveďou sa nekreslia — stĺpce plné núl by len
 * odsunuli to podstatné doprava.
 */

import type { CSSProperties } from "react"
import { notFound, redirect } from "next/navigation"
import { evaluationContext, loadEvaluationStats, type StatsCounts, type StatsSource } from "@/lib/evaluation"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { brandingView } from "@/lib/tenants"
import { tenantStyle } from "@/components/TenantHeader"
import { dictionary } from "@/lib/i18n"
import { niceMax } from "@/lib/chartScale"
import AppShell from "@/components/AppShell"
import EvaluationTabs from "@/components/EvaluationTabs"

export const dynamic = "force-dynamic"

const METRICS = ["answers", "doesNotFit", "share", "correct", "wrong", "hallucination", "dismissed", "pending"] as const
type Metric = (typeof METRICS)[number]

export default async function EvaluationStatsPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const ctx = await evaluationContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }

  const language = ctx.person.language
  const t = dictionary(language).evaluation
  const ts = t.stats
  const heads = dictionary(language).org.aiUsage.monthHeads
  const locale = language === "en" ? "en-GB" : language === "cs" ? "cs-CZ" : "sk-SK"
  const branding = brandingView(ctx.tenant)
  const query = normalizeQuery<{ by?: string }>(await searchParams)
  const by = query.by === "sources" ? "sources" : "months"
  const stats = await loadEvaluationStats(ctx.person.companyCode)

  const first = stats.byMonth.findIndex(c => c.answers > 0)
  const months = first < 0 ? [] : stats.months.slice(first)
  const byMonth = first < 0 ? [] : stats.byMonth.slice(first)
  const num = (n: number) => new Intl.NumberFormat(locale).format(n)
  const pct = (part: number, whole: number) => `${whole ? Math.round((part / whole) * 100) : 0} %`
  const value = (c: StatsCounts, m: Metric) => (m === "share" ? pct(c.doesNotFit, c.answers) : num(c[m]))
  const monthName = (y: number, m: number) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m, 1)))
  const crossYear = months.some(m => m.year !== months[0].year)
  const monthHeads = months.map((m, i) => (crossYear && (i === 0 || m.month === 0) ? `${heads[m.month]} ${String(m.year).slice(2)}` : heads[m.month]))
  const sourceName = (s: StatsSource) =>
    s.origin ? [t.origin[s.origin.kind], s.origin.label].filter(Boolean).join(" · ") : ts.noSource
  const chartMax = niceMax(Math.max(0, ...byMonth.map(c => c.answers)))
  const lastIdx = months.length - 1
  const series = [
    { cls: "series-1", name: ts.seriesDoesNotFit, of: (c: StatsCounts) => c.doesNotFit },
    { cls: "series-3", name: ts.seriesFits, of: (c: StatsCounts) => c.answers - c.doesNotFit },
  ]
  const spark = (values: number[]) => {
    const max = Math.max(1, ...values)
    return (
      <span className="spark" aria-hidden="true" style={{ "--chart-cols": values.length } as CSSProperties}>
        {values.map((v, i) => <span key={months[i]?.key ?? i} style={{ height: `${Math.max(5, (v / max) * 100)}%` }} />)}
      </span>
    )
  }
  const monthCols = `minmax(150px, 1.5fr) repeat(${months.length}, minmax(0, 1fr)) 72px`
  const sourceCols = `minmax(170px, 1.6fr) repeat(${METRICS.length}, minmax(0, 1fr))`

  return (
    <AppShell language={language} title={t.tabs.stats}>
    <div className="page-narrow page-narrow--wide" style={tenantStyle(branding)}>
      <div className="page-head">
        <h1 className="page-title">{t.heading}</h1>
      </div>
      <EvaluationTabs current="/evaluation/stats" language={language} />
      <p className="quiet page-lead eval-lead">{ts.lead}</p>

      {months.length === 0 ? (
        <div className="empty"><div className="empty-title">{ts.empty}</div></div>
      ) : (
        <>
          <p className="quiet">{ts.summary(stats.total.answers, stats.total.doesNotFit, pct(stats.total.doesNotFit, stats.total.answers))}</p>

          <nav className="view-switch view-switch--fit" aria-label={ts.byLabel}>
            {(["months", "sources"] as const).map(b => (
              <a key={b} className={`view-switch-item${by === b ? " is-on" : ""}`} aria-current={by === b ? "page" : undefined}
                 href={b === "months" ? "/evaluation/stats" : "/evaluation/stats?by=sources"}>
                {b === "months" ? ts.byMonths : ts.bySources}
              </a>
            ))}
          </nav>

          {by === "months" ? (
            <>
              <section className="card chart-card" aria-labelledby="chart-h">
                <h2 id="chart-h">{ts.chartTitle}</h2>
                <p className="sr-only">
                  {ts.chartAlt(months.map((m, i) => `${monthName(m.year, m.month)} ${byMonth[i].answers} / ${byMonth[i].doesNotFit}`).join(", "))}
                </p>
                <div className="chart-plot" aria-hidden="true" style={{ "--chart-cols": months.length } as CSSProperties}>
                  <div className="chart-gridline" style={{ top: 0 }}><span>{num(chartMax)}</span></div>
                  <div className="chart-gridline" style={{ top: "50%" }}><span>{num(chartMax / 2)}</span></div>
                  <div className="chart-cols">
                    {months.map((m, i) => (
                      <div key={m.key} className="chart-col" title={`${monthName(m.year, m.month)}: ${byMonth[i].answers}`}>
                        {series.map(s => (
                          <span key={s.cls} className={`chart-seg ${s.cls}`} style={{ height: `${(s.of(byMonth[i]) / chartMax) * 100}%` }} />
                        ))}
                        <small className="chart-col-total">{num(byMonth[i].answers)}</small>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chart-labels" aria-hidden="true" style={{ "--chart-cols": months.length } as CSSProperties}>
                  {monthHeads.map((h, i) => <span key={months[i].key}>{h}</span>)}
                </div>
                <ul className="chart-legend">
                  {series.map(s => <li key={s.cls}><span className={`chart-swatch ${s.cls}`} aria-hidden="true" /><span>{s.name}</span></li>)}
                </ul>
              </section>

              <section className="card matrix-wrap" aria-labelledby="matrix-h">
                <h2 id="matrix-h" className="sr-only">{ts.byMonths}</h2>
                <div className="matrix" role="table" aria-labelledby="matrix-h" style={{ "--matrix-cols": monthCols } as CSSProperties}>
                  <div className="matrix-row matrix-head" role="row">
                    <span className="matrix-name" role="columnheader">{ts.colMetric}</span>
                    {monthHeads.map((h, i) => <span key={months[i].key} role="columnheader">{h}</span>)}
                    <span className="matrix-total" role="columnheader">{ts.total}</span>
                  </div>
                  {METRICS.map(m => (
                    <div key={m} className={`matrix-row${m === "share" ? " matrix-sub" : ""}`} role="row">
                      <span className="matrix-name" role="rowheader">{ts.metrics[m]}</span>
                      {months.map((mo, i) => <span key={mo.key} className="matrix-cell" role="cell">{value(byMonth[i], m)}</span>)}
                      <span className="matrix-cell matrix-total" role="cell">{value(stats.total, m)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="matrix-cards" role="list">
                {METRICS.filter(m => m !== "share").map(m => (
                  <div key={m} className="card matrix-card" role="listitem">
                    <span className="matrix-card-name">{ts.metrics[m]}</span>
                    <span className="matrix-card-sum">{num(stats.total[m])}</span>
                    <span className="matrix-card-meta">
                      {m === "doesNotFit" ? `${ts.metrics.share} ${pct(stats.total.doesNotFit, stats.total.answers)}` : ""}
                    </span>
                    <span className="matrix-card-last">{monthName(months[lastIdx].year, months[lastIdx].month)}: {num(byMonth[lastIdx][m])}</span>
                    {months.length > 1 && spark(byMonth.map(c => c[m]))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <section className="card matrix-wrap" aria-labelledby="matrix-h">
                <h2 id="matrix-h" className="sr-only">{ts.bySources}</h2>
                <div className="matrix" role="table" aria-labelledby="matrix-h" style={{ "--matrix-cols": sourceCols } as CSSProperties}>
                  <div className="matrix-row matrix-head" role="row">
                    <span className="matrix-name" role="columnheader">{ts.colSource}</span>
                    {METRICS.map(m => <span key={m} role="columnheader" title={ts.metrics[m]}>{ts.metrics[m]}</span>)}
                  </div>
                  {stats.sources.map(s => (
                    <div key={s.key} className="matrix-row" role="row">
                      <span className="matrix-name" role="rowheader">{sourceName(s)}</span>
                      {METRICS.map(m => <span key={m} className="matrix-cell" role="cell">{value(s.counts, m)}</span>)}
                    </div>
                  ))}
                  <div className="matrix-row matrix-foot" role="row">
                    <span className="matrix-name" role="rowheader">{ts.total}</span>
                    {METRICS.map(m => <span key={m} className="matrix-cell" role="cell">{value(stats.total, m)}</span>)}
                  </div>
                </div>
              </section>

              <div className="matrix-cards" role="list">
                {stats.sources.map(s => (
                  <div key={s.key} className="card matrix-card" role="listitem">
                    <span className="matrix-card-name">{sourceName(s)}</span>
                    <span className="matrix-card-sum">{num(s.counts.answers)}</span>
                    <span className="matrix-card-meta">
                      {ts.metrics.doesNotFit} {num(s.counts.doesNotFit)} ({pct(s.counts.doesNotFit, s.counts.answers)}) · {ts.metrics.pending} {num(s.counts.pending)}
                    </span>
                    <span className="matrix-card-wide">
                      {(["correct", "wrong", "hallucination", "dismissed"] as const).map(m => `${ts.metrics[m]} ${num(s.counts[m])}`).join(" · ")}
                    </span>
                    {months.length > 1 && spark(s.answersByMonth.slice(first))}
                  </div>
                ))}
                <div className="card matrix-cards-foot"><span>{ts.total}</span><span>{num(stats.total.answers)}</span></div>
              </div>
            </>
          )}

          <p className="quiet field-hint">{ts.note}</p>
        </>
      )}
    </div>
    </AppShell>
  )
}
