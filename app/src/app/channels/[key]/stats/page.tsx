/**
 * /channels/[key]/stats — štatistika kanála za deň, týždeň, mesiac alebo
 * rok (KANAL-statistika, 30. 10. 2026; návrh `docs/design/KANAL-statistika.html`).
 *
 * Pre board: koľko otázok prišlo, koľko Contineo zodpovedal z prameňov,
 * ako sú ľudia spokojní, ako presne odpovedá, tickety a čo to stojí.
 *
 * Vidí ju riešiteľ kanála aj správca organizácie; **cenu len správca**
 * (Q3) — rovnako ako Prehľad spotreby AI. Obdobie je kalendárne a celé
 * v adrese (`?period=week&at=2026-10-26`), šípky sú odkazy (Q2). Čísla
 * vedú na zoznam, z ktorého sú (Q4).
 */

import type { CSSProperties } from "react"
import { notFound, redirect } from "next/navigation"
import AppShell from "@/components/AppShell"
import { ChannelPartTabs, channelHref } from "@/components/ChannelTabs"
import { tenantStyle } from "@/components/TenantHeader"
import { channelsContext } from "@/lib/helpdeskAgents"
import { isEvaluator } from "@/lib/evaluation"
import { brandingView } from "@/lib/tenants"
import { dictionary } from "@/lib/i18n"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { niceMax } from "@/lib/chartScale"
import { formatUsd } from "@/lib/pricing"
import {
  COST_GROUPS, STAT_PERIODS, STATS_SINCE, loadChannelStats, shiftRange, statPeriod, statRange, summarize,
  type CostGroup, type PeriodSummary, type StatRange,
} from "@/lib/channelStats"
import {
  bucketLabel, bucketTitle, delta, formatDuration, formatPct, rangeShort, rangeTitle, statsLocale, summaryRatios, type Delta,
} from "@/lib/channelStatsView"

export const dynamic = "force-dynamic"

interface Tile { key: string; label: string; value: string; sub?: string; delta: Delta; href?: string }

function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="stat-tiles">
      {tiles.map(t => {
        const body = (
          <>
            <span className="stat-tile-label">{t.label}</span>
            <span className="stat-tile-value">{t.value}</span>
            {t.sub && <span className="stat-tile-sub">{t.sub}</span>}
            <span className={`stat-tile-delta ${t.delta.tone}`}>{t.delta.text}</span>
          </>
        )
        return t.href
          ? <a key={t.key} className="card stat-tile" href={t.href}>{body}</a>
          : <div key={t.key} className="card stat-tile">{body}</div>
      })}
    </div>
  )
}

function Rank({ rows }: { rows: { key: string; name: string; n: number; cls: string; href?: string }[] }) {
  const max = Math.max(1, ...rows.map(r => r.n))
  return (
    <div className="chart-rank">
      {rows.map(r => {
        const body = (
          <>
            <span className="chart-rank-name"><span className={`chart-swatch ${r.cls}`} aria-hidden="true" /><b>{r.name}</b></span>
            <span className="chart-rank-track"><span className={`chart-rank-fill ${r.cls}`} style={{ width: `${(r.n / max) * 100}%` }} /></span>
            <span className="chart-rank-val">{r.n}</span>
          </>
        )
        return r.href
          ? <a key={r.key} className="chart-rank-row" href={r.href}>{body}</a>
          : <div key={r.key} className="chart-rank-row">{body}</div>
      })}
    </div>
  )
}

export default async function ChannelStatsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<RawQuery> }) {
  const ctx = await channelsContext()
  if (ctx.state !== "ready") {
    if (ctx.state === "not-signed-in") redirect("/sign-in")
    notFound()
  }
  const key = decodeURIComponent((await params).key)
  const channel = ctx.visible.find(c => c.key === key)
  if (!channel || channel.kind !== "widget") notFound()

  const language = ctx.person.language
  const tc = dictionary(language).channels
  const ts = tc.stats
  const locale = statsLocale(language)
  const branding = brandingView(ctx.tenant)
  const isAgent = ctx.agentChannels.some(c => c.key === key)
  const withCost = ctx.isAdmin
  const evaluator = isEvaluator(ctx.person)
  const query = normalizeQuery<{ period?: string; at?: string }>(await searchParams)
  const now = new Date()
  const range = statRange(statPeriod(query.period), query.at, now)
  const prevRange = shiftRange(range, -1)
  const nextRange = shiftRange(range, 1)

  const data = await loadChannelStats(ctx.tenant.companyCode, key, prevRange.start, range.end, { withCost })
  const cur = summarize(data, range.start, range.end)
  const prev = summarize(data, prevRange.start, prevRange.end)
  const buckets = range.buckets.map(b => ({ b, future: b.start > now, s: summarize(data, b.start, b.end) }))
  const cr = summaryRatios(cur)
  const pr = summaryRatios(prev)

  const base = channelHref(key, "stats")
  const hrefFor = (r: StatRange) => `${base}?${new URLSearchParams({ period: r.period, at: r.at })}`
  const exportHref = `/api/channels/${encodeURIComponent(key)}/stats?${new URLSearchParams({ period: range.period, at: range.at })}`
  const num = (n: number) => new Intl.NumberFormat(locale).format(n)
  const millions = (n: number) => ts.million(new Intl.NumberFormat(locale, { maximumFractionDigits: n >= 10_000_000 ? 0 : 1 }).format(n / 1_000_000))
  const lastDay = `${range.last.year}-${String(range.last.month + 1).padStart(2, "0")}-${String(range.last.day).padStart(2, "0")}`
  const usageHref = `/organisation/ai/usage?${new URLSearchParams({ from: range.at, to: lastDay })}`
  const ticketsHref = isAgent ? channelHref(key, "tickets") : undefined
  const evalHref = (view?: "assessed" | "dismissed") => (evaluator ? (view ? `/evaluation?view=${view}` : "/evaluation") : undefined)

  const block: CSSProperties = { display: "flex", flexDirection: "column", gap: 8 }
  const empty = cur.questions === 0 && cur.tickets.received === 0 && cur.tickets.answered === 0 && cur.cost.calls === 0

  const tiles: Tile[] = [
    { key: "questions", label: ts.tileQuestions, value: num(cur.questions), sub: ts.tileQuestionsSub, delta: delta(cur.questions, prev.questions, "share", null, language) },
    { key: "answered", label: ts.tileAnswered, value: formatPct(cr.answered, language), sub: ts.tileAnsweredSub(num(cur.answered), num(cur.questions)), delta: delta(cr.answered, pr.answered, "points", "up", language) },
    {
      key: "satisfaction", label: ts.tileSatisfaction, value: formatPct(cr.satisfaction, language),
      sub: ts.tileSatisfactionSub(num(cur.reader.fits), num(cur.reader.fits + cur.reader.doesNotFit)),
      delta: delta(cr.satisfaction, pr.satisfaction, "points", "up", language), href: evalHref(),
    },
    {
      key: "accuracy", label: ts.tileAccuracy, value: formatPct(cr.accuracy, language),
      sub: ts.tileAccuracySub(num(cur.verdicts.correct), num(cur.verdicts.correct + cur.verdicts.wrong)),
      delta: delta(cr.accuracy, pr.accuracy, "points", "up", language), href: evalHref("assessed"),
    },
    {
      key: "tickets", label: ts.tileTickets, value: num(cur.tickets.received),
      sub: ts.tileTicketsSub(num(cur.tickets.answered), formatDuration(cur.tickets.medianMs, language)),
      delta: delta(cur.tickets.medianMs, prev.tickets.medianMs, "duration", "down", language), href: ticketsHref,
    },
    ...(withCost ? [{
      key: "cost", label: ts.tileCost, value: formatUsd(cur.cost.usd),
      sub: cr.perAnswer === null ? undefined : ts.tileCostSub(formatUsd(cr.perAnswer)),
      delta: delta(cur.cost.usd, prev.cost.usd, "usd", "down", language), href: usageHref,
    }] : []),
  ]

  const tt = ts.ticketTiles
  const ticketTiles: Tile[] = [
    { key: "received", label: tt.received, value: num(cur.tickets.received), delta: delta(cur.tickets.received, prev.tickets.received, "count", null, language), href: ticketsHref },
    { key: "answered", label: tt.answered, value: num(cur.tickets.answered), delta: delta(cur.tickets.answered, prev.tickets.answered, "count", "up", language), href: ticketsHref },
    { key: "closed", label: tt.closed, value: num(cur.tickets.closed), delta: delta(cur.tickets.closed, prev.tickets.closed, "count", "up", language), href: ticketsHref },
    { key: "reopened", label: tt.reopened, value: num(cur.tickets.reopened), delta: delta(cur.tickets.reopened, prev.tickets.reopened, "count", "down", language), href: ticketsHref },
    { key: "median", label: tt.median, value: formatDuration(cur.tickets.medianMs, language), delta: delta(cur.tickets.medianMs, prev.tickets.medianMs, "duration", "down", language) },
    { key: "p90", label: tt.p90, value: formatDuration(cur.tickets.p90Ms, language), delta: delta(cur.tickets.p90Ms, prev.tickets.p90Ms, "duration", "down", language) },
  ]

  const chartMax = niceMax(Math.max(0, ...buckets.map(x => x.s.questions)))
  const cols = buckets.length
  const labelFor = (i: number) => {
    const l = bucketLabel(range, buckets[i].b, language)
    // 24 hodín a 31 dní sa na telefón nezmestí — popis má každý tretí / piaty stĺpec.
    if (range.period === "day") return i % 3 === 0 ? l : ""
    if (range.period === "month") return i === 0 || (i + 1) % 5 === 0 ? l : ""
    return l
  }

  // Matica ceny: po stĺpcoch len týždeň (7) a rok (12); deň a mesiac majú
  // príliš veľa stĺpcov, tam ostáva súčet za obdobie.
  const matrixCols = range.period === "week" || range.period === "year"
  const groups = COST_GROUPS.filter(g => cur.cost.byGroup[g].usd > 0 || cur.cost.byGroup[g].tokens > 0)
  const share = (usd: number) => ts.share(`${cur.cost.usd ? Math.round((usd / cur.cost.usd) * 100) : 0} %`)
  const groupCell = (s: PeriodSummary, g: CostGroup) => (s.cost.byGroup[g].usd ? formatUsd(s.cost.byGroup[g].usd) : "")
  const matrixTemplate = matrixCols
    ? `minmax(180px, 1.6fr) repeat(${cols}, minmax(0, 1fr)) 84px 120px`
    : "minmax(180px, 1fr) 96px 120px 120px"
  const lastPast = buckets.reduce((last, x, i) => (x.future ? last : i), 0)
  const spark = (values: number[]) => {
    const max = Math.max(0.000001, ...values)
    return (
      <span className="spark" aria-hidden="true" style={{ "--chart-cols": values.length } as CSSProperties}>
        {values.map((v, i) => buckets[i].future
          ? <span key={i} className="is-future" />
          : <span key={i} style={{ height: `${Math.max(5, (v / max) * 100)}%` }} />)}
      </span>
    )
  }

  return (
    <AppShell language={language} title={tc.tabStats} trail={{ [channelHref(key)]: channel.name }}>
    <div style={{ maxWidth: 1240, display: "flex", flexDirection: "column", gap: 14, ...tenantStyle(branding) }}>
      <div className="page-head">
        <div className="page-head-main">
          <h1 className="page-title">{channel.name}</h1>
          <p className="page-lead quiet">{withCost ? ts.lead : ts.leadAgent}</p>
        </div>
        {!empty && (
          <div className="page-tools">
            <a className="button button--quiet button--sm" href={exportHref}>{ts.exportXlsx}</a>
          </div>
        )}
      </div>
      <ChannelPartTabs channelKey={key} current={base} canTickets={isAgent} canStats canSettings={ctx.isAdmin} language={language} />

      <div>
        <nav className="view-switch" aria-label={ts.periodLabel}>
          {STAT_PERIODS.map(p => (
            <a key={p} className={`view-switch-item${range.period === p ? " is-on" : ""}`} aria-current={range.period === p ? "page" : undefined}
               href={`${base}?period=${p}`}>
              {ts.periods[p]}
            </a>
          ))}
        </nav>
        <p className="period-nav">
          <a className="button button--quiet button--sm" href={hrefFor(prevRange)} aria-label={ts.prev[range.period]} title={ts.prev[range.period]}>‹</a>
          <b>{rangeTitle(range, language)}</b>
          {nextRange.start > now
            ? <span className="button button--quiet button--sm is-disabled" aria-hidden="true">›</span>
            : <a className="button button--quiet button--sm" href={hrefFor(nextRange)} aria-label={ts.next[range.period]} title={ts.next[range.period]}>›</a>}
          <span className="quiet period-nav-compare">{ts.compare(rangeShort(prevRange, language))}</span>
        </p>
      </div>

      {range.start < new Date(STATS_SINCE.getTime() + 86_400_000) && (
        <div className="lnote lnote--warn">
          <span className="lnote-mark" aria-hidden="true">!</span>
          <span className="lnote-text">{ts.noteSince}</span>
        </div>
      )}

      {empty ? (
        <div className="empty">
          <div className="empty-title">{ts.empty}</div>
          <div className="empty-text">{ts.emptyText}</div>
        </div>
      ) : (
        <>
          <section aria-labelledby="sum-h" style={block}>
            <h2 id="sum-h" className="sr-only">{ts.summary}</h2>
            <StatTiles tiles={tiles} />
          </section>

          <section className="card chart-card" aria-labelledby="chart-h">
            <h2 id="chart-h">{ts.chartTitle[range.period]}</h2>
            <p className="sr-only">
              {ts.chartAlt(buckets.filter(x => !x.future && x.s.questions > 0)
                .map(x => ts.chartItem(bucketTitle(range, x.b, language), num(x.s.answered), num(x.s.unanswered))).join(", "))}
            </p>
            <div className="chart-plot" aria-hidden="true" style={{ "--chart-cols": cols } as CSSProperties}>
              <div className="chart-gridline" style={{ top: 0 }}><span>{num(chartMax)}</span></div>
              <div className="chart-gridline" style={{ top: "50%" }}><span>{num(chartMax / 2)}</span></div>
              <div className="chart-cols">
                {buckets.map((x, i) => x.future ? (
                  <div key={i} className="chart-col is-future" />
                ) : (
                  <div key={i} className="chart-col" title={`${bucketTitle(range, x.b, language)}: ${ts.chartItem("", num(x.s.answered), num(x.s.unanswered)).trim()}`}>
                    <span className="chart-seg series-1" style={{ height: `${(x.s.answered / chartMax) * 100}%` }} />
                    <span className="chart-seg series-6" style={{ height: `${(x.s.unanswered / chartMax) * 100}%` }} />
                    {x.s.questions > 0 && cols <= 12 && <small className="chart-col-total">{num(x.s.questions)}</small>}
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-labels" aria-hidden="true" style={{ "--chart-cols": cols } as CSSProperties}>
              {buckets.map((x, i) => <span key={i} className={x.future ? "is-future" : undefined}>{labelFor(i)}</span>)}
            </div>
            <ul className="chart-legend">
              <li><span className="chart-swatch series-1" aria-hidden="true" /><span>{ts.seriesAnswered}</span></li>
              <li><span className="chart-swatch series-6" aria-hidden="true" /><span>{ts.seriesUnanswered}</span></li>
            </ul>
          </section>

          <section className="card chart-card" aria-labelledby="reader-h">
            <h2 id="reader-h">{ts.readerTitle}</h2>
            <Rank rows={[
              { key: "fits", name: ts.reader.fits, n: cur.reader.fits, cls: "series-1" },
              { key: "doesNotFit", name: ts.reader.doesNotFit, n: cur.reader.doesNotFit, cls: "series-3", href: evalHref() },
              { key: "none", name: ts.reader.none, n: cur.reader.none, cls: "series-6" },
            ]} />
          </section>

          <section className="card chart-card" aria-labelledby="eval-h">
            <h2 id="eval-h">{ts.verdictTitle}</h2>
            <Rank rows={[
              { key: "correct", name: ts.verdicts.correct, n: cur.verdicts.correct, cls: "series-1", href: evalHref("assessed") },
              { key: "wrong", name: ts.verdicts.wrong, n: cur.verdicts.wrong, cls: "series-3", href: evalHref("assessed") },
              { key: "hallucination", name: ts.verdicts.hallucination, n: cur.verdicts.hallucination, cls: "series-4", href: evalHref("assessed") },
              { key: "dismissed", name: ts.verdicts.dismissed, n: cur.verdicts.dismissed, cls: "series-6", href: evalHref("dismissed") },
              { key: "pending", name: ts.verdicts.pending, n: cur.verdicts.pending, cls: "series-5", href: evalHref() },
            ]} />
          </section>

          <section aria-labelledby="tick-h" style={block}>
            <div className="page-head page-head--section"><h2 id="tick-h">{ts.ticketsTitle}</h2></div>
            <StatTiles tiles={ticketTiles} />
          </section>

          {withCost && (
            <section aria-labelledby="ai-h" style={block}>
              <div className="page-head page-head--section"><h2 id="ai-h">{ts.aiTitle}</h2></div>
              <div className="usage-summary card">
                <div><span className="quiet">{ts.aiTotal}</span><strong>{formatUsd(cur.cost.usd)}</strong></div>
                <div><span className="quiet">{ts.aiPerAnswer}</span><strong>{cr.perAnswer === null ? "—" : formatUsd(cr.perAnswer)}</strong></div>
                <div><span className="quiet">{ts.aiCalls}</span><strong>{num(cur.cost.calls)}</strong></div>
                <div><span className="quiet">{ts.aiTokens}</span><strong>{millions(cur.cost.tokens)}</strong></div>
              </div>
              {groups.length > 0 && (
                <>
                  <section className="card matrix-wrap" aria-labelledby="mx-h">
                    <h3 id="mx-h" className="sr-only">{ts.aiTitle}</h3>
                    <div className="matrix" role="table" aria-labelledby="mx-h" style={{ "--matrix-cols": matrixTemplate } as CSSProperties}>
                      <div className="matrix-row matrix-head" role="row">
                        <span className="matrix-name" role="columnheader">{ts.colPurpose}</span>
                        {matrixCols && buckets.map((x, i) => (
                          <span key={i} className={`matrix-cell${x.future ? " is-future" : ""}`} role="columnheader">{bucketLabel(range, x.b, language)}</span>
                        ))}
                        <span className="matrix-total" role="columnheader">{ts.colTotal}</span>
                        {!matrixCols && <span className="matrix-meta" role="columnheader">%</span>}
                        <span className="matrix-meta" role="columnheader">{ts.colTokens}</span>
                      </div>
                      {groups.map(g => (
                        <div key={g} className="matrix-row" role="row">
                          <span className="matrix-name" role="rowheader">{ts.groups[g]}</span>
                          {matrixCols && buckets.map((x, i) => (
                            <span key={i} className={`matrix-cell${x.future ? " is-future" : ""}`} role="cell">{x.future ? "" : groupCell(x.s, g)}</span>
                          ))}
                          <span className="matrix-cell matrix-total" role="cell"><a href={usageHref}>{formatUsd(cur.cost.byGroup[g].usd)}</a></span>
                          {!matrixCols && <span className="matrix-meta" role="cell">{share(cur.cost.byGroup[g].usd)}</span>}
                          <span className="matrix-meta" role="cell">{millions(cur.cost.byGroup[g].tokens)}</span>
                        </div>
                      ))}
                      <div className="matrix-row matrix-foot" role="row">
                        <span className="matrix-name" role="rowheader">{ts.colTotal}</span>
                        {matrixCols && buckets.map((x, i) => (
                          <span key={i} className={`matrix-cell${x.future ? " is-future" : ""}`} role="cell">{x.future || !x.s.cost.usd ? "" : formatUsd(x.s.cost.usd)}</span>
                        ))}
                        <span className="matrix-cell matrix-total" role="cell">{formatUsd(cur.cost.usd)}</span>
                        {!matrixCols && <span className="matrix-meta" role="cell" />}
                        <span className="matrix-meta" role="cell">{millions(cur.cost.tokens)}</span>
                      </div>
                    </div>
                  </section>
                  <div className="matrix-cards" role="list">
                    {groups.map(g => (
                      <div key={g} className="card matrix-card" role="listitem">
                        <span className="matrix-card-name">{ts.groups[g]}</span>
                        <span className="matrix-card-sum">{formatUsd(cur.cost.byGroup[g].usd)}</span>
                        <span className="matrix-card-meta">{share(cur.cost.byGroup[g].usd)} · {millions(cur.cost.byGroup[g].tokens)}</span>
                        <span className="matrix-card-last">
                          {ts.cardLast(bucketTitle(range, buckets[lastPast].b, language), formatUsd(buckets[lastPast].s.cost.byGroup[g].usd))}
                        </span>
                        {buckets.length > 1 && spark(buckets.map(x => x.s.cost.byGroup[g].usd))}
                      </div>
                    ))}
                    <div className="card matrix-cards-foot"><span>{ts.colTotal}</span><span>{formatUsd(cur.cost.usd)}</span></div>
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
    </AppShell>
  )
}
