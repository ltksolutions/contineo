/**
 * Organizácia → Umelá inteligencia → Prehľad (návrh ORG-ai-prehlad,
 * 24. 10. 2026). Spotreba sčítaná podľa osoby, účelu alebo modelu a mesiaca.
 *
 * Všetko sú odkazy a GET formulár — stav je v adrese, stránka funguje bez
 * JavaScriptu. Graf kreslí server z tried `.chart-*` design systému. Každé
 * číslo vedie do Spotreby s vyplneným filtrom, aby sa dalo overiť, z čoho je.
 */

import type { CSSProperties } from "react"
import Link from "next/link"
import type { dictionary } from "@/lib/i18n"
import type { Overview, OverviewGroup, OverviewItem } from "@/lib/aiOverview"
import { topWithRest } from "@/lib/aiOverview"
import { formatUsd, type TokenCounts } from "@/lib/pricing"

type Strings = ReturnType<typeof dictionary>["org"]["aiUsage"]

const FILTER_KEY: Record<OverviewGroup, string> = { people: "person", purposes: "purpose", models: "model" }

/** Horná hranica osi: okrúhle číslo tesne nad maximom, nech graf nie je prázdny. */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * p).find(x => x >= v) ?? 10 * p
}

export default function AiOverview({
  tu, locale, overview, by, fromInput, toInput, fromText, toText, previousUsd, unpriced, now,
  itemName,
}: {
  tu: Strings
  locale: string
  overview: Overview
  by: OverviewGroup
  /** Čo je v adrese — prázdne pole znamená aktuálny mesiac. */
  fromInput: string
  toInput: string
  fromText: string
  toText: string
  previousUsd: number | null
  unpriced: number
  now: Date
  itemName: (it: OverviewItem) => string
}) {
  const { months, items, totals } = overview
  const num = (n: number) => new Intl.NumberFormat(locale).format(n)
  const compact = (n: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(n)
  const tokens = (t: TokenCounts) => `${compact(t.input)} / ${compact(t.output)} / ${compact(t.cacheRead + t.cacheWrite)}`
  const day = (text: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${text}T00:00:00Z`))
  const monthName = (y: number, m: number) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m, 1)))

  // Pomenovanie obdobia: celý rok, celý mesiac, inak dátumy.
  const [fy, fm, fd] = fromText.split("-").map(Number)
  const [ty, tm, td] = toText.split("-").map(Number)
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate()
  const period = fy === ty && fm === 1 && fd === 1 && tm === 12 && td === 31
    ? tu.year(fy)
    : fy === ty && fm === tm && fd === 1 && td === lastDay
    ? monthName(fy, fm - 1)
    : `${day(fromText)} – ${day(toText)}`

  const single = months.length === 1
  const base = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries(extra).filter((e): e is [string, string] => !!e[1]))
    return q.toString() ? `?${q}` : ""
  }
  const rangeQuery = fromInput || toInput ? { from: fromText, to: toText } : {}
  const selfHref = (g: OverviewGroup) => `/organisation/ai/overview${base({ ...rangeQuery, ...(g === "people" ? {} : { by: g }) })}`
  const usageHref = (from: string, to: string, it?: OverviewItem) => {
    const q = new URLSearchParams({ from, to })
    if (it) q.set(FILTER_KEY[by], it.key)
    return `/organisation/ai/usage?${q}`
  }

  // Rýchly výber obdobia — odkazy, pohľad sa zachová.
  const y = now.getUTCFullYear(), mo = now.getUTCMonth()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const byPart = by === "people" ? {} : { by }
  const quick = [
    { label: tu.quickMonth, from: "", to: "" },
    { label: tu.quickYear(y), from: `${y}-01-01`, to: `${y}-12-31` },
    { label: tu.quick12, from: iso(new Date(Date.UTC(y, mo - 11, 1))), to: iso(new Date(Date.UTC(y, mo + 1, 0))) },
    { label: tu.quickYear(y - 1), from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ].map(r => ({
    ...r,
    href: `/organisation/ai/overview${base({ ...(r.from ? { from: r.from, to: r.to } : {}), ...byPart })}`,
    on: r.from ? r.from === fromText && r.to === toText : !fromInput && !toInput,
  }))

  const exportHref = `/api/ai-overview?${new URLSearchParams({ format: "xlsx", from: fromText, to: toText, by })}`
  const empty = totals.calls === 0
  const pastMonths = months.filter(m => !m.blank).length
  const pct = previousUsd ? (totals.usd - previousUsd) / previousUsd : null

  // Séria grafu: 5 najväčších a Ostatné.
  const { top, rest } = topWithRest(items)
  const series = [
    ...top.map((it, i) => ({ name: itemName(it), cls: `series-${i + 1}`, byMonth: it.byMonth, usd: it.usd, item: it as OverviewItem | undefined })),
    ...(rest.length ? [{
      name: tu.others(rest.length), cls: "series-6", item: undefined,
      byMonth: months.map((m, i) => (m.blank ? null : rest.reduce((s, it) => s + (it.byMonth[i] ?? 0), 0))),
      usd: rest.reduce((s, it) => s + it.usd, 0),
    }] : []),
  ]
  const chartMax = niceMax(Math.max(0, ...totals.byMonth.map(v => v ?? 0)))
  const rankMax = Math.max(0.0001, ...series.map(s => s.usd))
  const chartAlt = single
    ? series.map(s => `${s.name} ${formatUsd(s.usd)}`).join(", ")
    : months.filter(m => !m.blank).map((m, i) => `${monthName(m.year, m.month)} ${formatUsd(totals.byMonth[i] ?? 0)}`).join(", ")

  const cols = single
    ? "minmax(150px, 1fr) 96px 72px 84px 220px"
    : `minmax(150px, 1.5fr) repeat(${months.length}, minmax(0, 1fr)) 84px 200px`
  // Cez prelom roka nesie rok len prvý mesiac a január — inak by sa hlavička nezmestila.
  const crossYear = months.some(o => o.year !== months[0].year)
  const heads = months.map((m, i) => (crossYear && (i === 0 || m.month === 0) ? `${tu.monthHeads[m.month]} ${String(m.year).slice(2)}` : tu.monthHeads[m.month]))
  // Tokeny po mesiacoch v miliónoch bez jednotky — jednotka je v názve riadku.
  const millions = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: n >= 10_000_000 ? 0 : 1 }).format(n / 1_000_000)
  const lastIdx = months.reduce((last, m, i) => (m.blank ? last : i), 0)
  const share = (usd: number) => `${totals.usd ? Math.round((usd / totals.usd) * 100) : 0} %`
  const nameCell = (it: OverviewItem) => <a href={usageHref(fromText, toText, it)}>{itemName(it)}</a>

  return (
    <>
      <div className="page-head page-head--section">
        <div className="page-head-main">
          <h2>{tu.overviewTitle(period)}</h2>
          <p className="page-lead quiet">{tu.overviewLead}</p>
        </div>
        {!empty && (
          <div className="page-tools">
            <a className="button button--quiet button--sm" href={exportHref}>{tu.exportXlsx}</a>
          </div>
        )}
      </div>

      <form action="/organisation/ai/overview" method="get" className="card usage-filter usage-filter--period">
        <label className="field">
          <span className="field-label">{tu.from}</span>
          <input className="field-input" type="date" name="from" defaultValue={fromInput} />
          <span className="field-hint">{tu.fromHint}</span>
        </label>
        <label className="field">
          <span className="field-label">{tu.to}</span>
          <input className="field-input" type="date" name="to" defaultValue={toInput} />
          <span className="field-hint">{tu.toHint}</span>
        </label>
        {by !== "people" && <input type="hidden" name="by" value={by} />}
        <div><button className="button button--quiet" type="submit">{tu.apply}</button></div>
        <p className="quiet quick-ranges">
          {tu.quick}:{" "}
          {quick.map((r, i) => (
            <span key={r.label}>
              {i > 0 && " · "}
              <a className={r.on ? "is-on" : undefined} aria-current={r.on ? "true" : undefined} href={r.href}>{r.label}</a>
            </span>
          ))}
        </p>
      </form>

      {empty ? (
        <div className="empty">
          <div className="empty-title">{tu.overviewEmpty(period)}</div>
          <div className="empty-text">{tu.overviewEmptyText}</div>
          <div className="empty-action"><Link className="button button--quiet" href="/organisation/ai">{tu.emptyAction}</Link></div>
        </div>
      ) : (
        <>
          <div className="usage-summary card">
            <div>
              <span className="quiet">{tu.total}</span><strong>{formatUsd(totals.usd)}</strong>
              {pct !== null && (
                <span className="quiet" style={{ fontSize: "var(--fs-micro)" }}>
                  {tu.delta(new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(pct))}
                </span>
              )}
            </div>
            {!single && pastMonths > 0 && (
              <div><span className="quiet">{tu.avgMonth}</span><strong>{formatUsd(totals.usd / pastMonths)}</strong></div>
            )}
            <div><span className="quiet">{tu.calls}</span><strong>{num(totals.calls)}</strong></div>
            <div><span className="quiet">{tu.tokensAll}</span><strong>{tokens(totals.tokens)}</strong></div>
          </div>

          {unpriced > 0 && (
            <div className="lnote lnote--warn">
              <span className="lnote-mark" aria-hidden="true">!</span>
              <span className="lnote-text">
                {tu.unpriced(unpriced)}{" "}
                <a href={`/organisation/ai/usage?${new URLSearchParams({ from: fromText, to: toText, unpriced: "1" })}`}>{tu.unpricedLink}</a>
              </span>
            </div>
          )}

          <nav className="view-switch view-switch--full" aria-label={tu.byLabel}>
            {(["people", "purposes", "models"] as const).map(g => (
              <a key={g} className={`view-switch-item${by === g ? " is-on" : ""}`} aria-current={by === g ? "page" : undefined} href={selfHref(g)}>
                {g === "people" ? tu.byPeople : g === "purposes" ? tu.byPurposes : tu.byModels}
              </a>
            ))}
          </nav>

          <section className="card chart-card" aria-labelledby="chart-h">
            <h2 id="chart-h">{single ? tu.chartRank[by](period) : tu.chartMonths}</h2>
            <p className="sr-only">{tu.chartAlt(chartAlt)}</p>
            {single ? (
              <div className="chart-rank" aria-hidden="true">
                {series.map(s => (
                  <a key={s.cls} className="chart-rank-row" tabIndex={-1}
                     href={s.item ? usageHref(fromText, toText, s.item) : usageHref(fromText, toText)}>
                    <span className="chart-rank-name"><span className={`chart-swatch ${s.cls}`} /><b>{s.name}</b></span>
                    <span className="chart-rank-track"><span className={`chart-rank-fill ${s.cls}`} style={{ width: `${(s.usd / rankMax) * 100}%` }} /></span>
                    <span className="chart-rank-val">{formatUsd(s.usd)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <>
                <div className="chart-plot" aria-hidden="true" style={{ "--chart-cols": months.length } as CSSProperties}>
                  <div className="chart-gridline" style={{ top: 0 }}><span>{formatUsd(chartMax)}</span></div>
                  <div className="chart-gridline" style={{ top: "50%" }}><span>{formatUsd(chartMax / 2)}</span></div>
                  <div className="chart-cols">
                    {months.map((m, i) => m.blank ? (
                      <div key={m.key} className="chart-col is-future" />
                    ) : (
                      <a key={m.key} className="chart-col" tabIndex={-1} href={usageHref(m.fromText, m.toText)}
                         title={`${monthName(m.year, m.month)}: ${formatUsd(totals.byMonth[i] ?? 0)}`}>
                        {series.map(s => (
                          <span key={s.cls} className={`chart-seg ${s.cls}`}
                                style={{ height: `${((s.byMonth[i] ?? 0) / chartMax) * 100}%` }} />
                        ))}
                        <small className="chart-col-total">{formatUsd(totals.byMonth[i] ?? 0)}</small>
                      </a>
                    ))}
                  </div>
                </div>
                <div className="chart-labels" aria-hidden="true" style={{ "--chart-cols": months.length } as CSSProperties}>
                  {months.map((m, i) => <span key={m.key} className={m.blank ? "is-future" : undefined}>{heads[i]}</span>)}
                </div>
                <ul className="chart-legend">
                  {series.map(s => <li key={s.cls}><span className={`chart-swatch ${s.cls}`} aria-hidden="true" /><span>{s.name}</span></li>)}
                </ul>
              </>
            )}
          </section>

          <section className="card matrix-wrap" aria-labelledby="matrix-h">
            <h2 id="matrix-h" className="sr-only">{tu.matrixTitle(period)}</h2>
            <div className="matrix" role="table" aria-labelledby="matrix-h" style={{ "--matrix-cols": cols } as CSSProperties}>
              <div className="matrix-row matrix-head" role="row">
                <span className="matrix-name" role="columnheader">{by === "people" ? tu.person : by === "purposes" ? tu.purpose : tu.colModel}</span>
                {!single && months.map((m, i) => <span key={m.key} role="columnheader">{heads[i]}</span>)}
                <span className="matrix-total" role="columnheader">{tu.colTotal}</span>
                {single && <><span role="columnheader">{tu.share}</span><span role="columnheader">{tu.calls}</span></>}
                {/* Celý popis sa do stĺpca nezmestí — je v súčtoch nad maticou a v `title`. */}
                <span role="columnheader" title={tu.tokensAll}>{tu.colTokens}</span>
              </div>
              {items.map(it => (
                <div key={it.key} role="rowgroup">
                  <div className="matrix-row" role="row">
                    <span className="matrix-name" role="rowheader">{nameCell(it)}</span>
                    {!single && months.map((m, i) => (
                      <span key={m.key} className={`matrix-cell${m.blank ? " is-future" : ""}`} role="cell">
                        {m.blank ? "" : <a href={usageHref(m.fromText, m.toText, it)}>{formatUsd(it.byMonth[i] ?? 0)}</a>}
                      </span>
                    ))}
                    <span className="matrix-cell matrix-total" role="cell"><a href={usageHref(fromText, toText, it)}>{formatUsd(it.usd)}</a></span>
                    {single && <><span className="matrix-meta" role="cell">{share(it.usd)}</span><span className="matrix-meta" role="cell">{num(it.calls)}</span></>}
                    <span className="matrix-meta" role="cell">{tokens(it.tokens)}</span>
                  </div>
                  {/* Pohľad Modely: tokeny po mesiacoch pod sumou (Q3). */}
                  {by === "models" && !single && ([["input", tu.tokIn], ["output", tu.tokOut], ["cache", tu.tokCache]] as const).map(([k, label]) => {
                    const pick = (t: TokenCounts) => (k === "cache" ? t.cacheRead + t.cacheWrite : t[k])
                    return (
                      <div key={k} className="matrix-row matrix-sub" role="row">
                        <span className="matrix-name" role="rowheader">{label} ({tu.tokMillions})</span>
                        {months.map((m, i) => (
                          <span key={m.key} className="matrix-cell" role="cell">{it.tokensByMonth[i] ? millions(pick(it.tokensByMonth[i]!)) : ""}</span>
                        ))}
                        <span className="matrix-cell matrix-total" role="cell">{compact(pick(it.tokens))}</span>
                        <span className="matrix-meta" role="cell" />
                      </div>
                    )
                  })}
                </div>
              ))}
              <div className="matrix-row matrix-foot" role="row">
                <span className="matrix-name" role="rowheader">{tu.colTotal}</span>
                {!single && months.map((m, i) => (
                  <span key={m.key} className={`matrix-cell${m.blank ? " is-future" : ""}`} role="cell">
                    {m.blank ? "" : formatUsd(totals.byMonth[i] ?? 0)}
                  </span>
                ))}
                <span className="matrix-cell matrix-total" role="cell">{formatUsd(totals.usd)}</span>
                {single && <><span className="matrix-meta" role="cell">100 %</span><span className="matrix-meta" role="cell">{num(totals.calls)}</span></>}
                <span className="matrix-meta" role="cell">{tokens(totals.tokens)}</span>
              </div>
            </div>
          </section>

          <div className="matrix-cards" role="list">
            {items.map(it => (
              <div key={it.key} className="card matrix-card" role="listitem">
                <span className="matrix-card-name">{nameCell(it)}</span>
                <span className="matrix-card-sum">{formatUsd(it.usd)}</span>
                <span className="matrix-card-meta">{share(it.usd)} · {tu.calls} {num(it.calls)}</span>
                {!single && (
                  <>
                    <span className="matrix-card-last">
                      {monthName(months[lastIdx].year, months[lastIdx].month)}:{" "}
                      <a href={usageHref(months[lastIdx].fromText, months[lastIdx].toText, it)}>{formatUsd(it.byMonth[lastIdx] ?? 0)}</a>
                    </span>
                    <span className="spark" aria-hidden="true" style={{ "--chart-cols": months.length } as CSSProperties}>
                      {months.map((m, i) => {
                        const max = Math.max(0.0001, ...it.byMonth.map(v => v ?? 0))
                        return m.blank
                          ? <span key={m.key} className="is-future" />
                          : <span key={m.key} style={{ height: `${Math.max(5, ((it.byMonth[i] ?? 0) / max) * 100)}%` }} />
                      })}
                    </span>
                  </>
                )}
                <span className="matrix-card-wide">{tu.tokensAll}: {tokens(it.tokens)}</span>
              </div>
            ))}
            <div className="card matrix-cards-foot"><span>{tu.colTotal}</span><span>{formatUsd(totals.usd)}</span></div>
          </div>
        </>
      )}

      <p className="quiet" style={{ margin: 0, fontSize: "var(--fs-small)", maxWidth: 680 }}>{tu.overviewNote}</p>
    </>
  )
}
