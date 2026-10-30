/**
 * channelStatsExport.ts — štatistika kanála do Excelu pre board (Q5).
 *
 * Jeden hárok na blok (súhrn, kvalita, tickety, AI) a v stĺpcoch zvolené
 * obdobie spolu s 12 predchádzajúcimi — tabuľka, ktorá ide rovno do
 * prezentácie. Čísla sú čísla (podiely ako zlomok, sumy v USD, čas
 * v hodinách), aby sa s nimi v Exceli dalo počítať.
 */

import { dictionary, type UiLanguage } from "./i18n"
import { COST_GROUPS, summarize, type ChannelStatsData, type PeriodSummary, type StatRange } from "./channelStats"
import { rangeShort, summaryRatios } from "./channelStatsView"

/** Koľko predchádzajúcich období ide do exportu. */
export const EXPORT_HISTORY = 12

type Cell = string | number | null
type Aoa = Cell[][]

const hours = (ms: number | null) => (ms === null ? null : Math.round((ms / 3_600_000) * 10) / 10)
const round = (n: number | null, digits: number) => (n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits)

/** Hárky `[názov, riadky]` — čistá funkcia, obdobia najstaršie vľavo. */
export function channelStatsSheets(
  data: ChannelStatsData,
  ranges: StatRange[],
  opts: { withCost: boolean; language: UiLanguage },
): [string, Aoa][] {
  const ts = dictionary(opts.language).channels.stats
  const sums = ranges.map(r => summarize(data, r.start, r.end))
  const head: Cell[] = [ts.colMetric, ...ranges.map(r => rangeShort(r, opts.language))]
  const row = (label: string, of: (s: PeriodSummary) => Cell): Cell[] => [label, ...sums.map(of)]

  const summary: Aoa = [
    head,
    row(ts.tileQuestions, s => s.questions),
    row(ts.tileAnswered, s => s.answered),
    row(ts.seriesUnanswered, s => s.unanswered),
    row(`${ts.tileAnswered} %`, s => round(summaryRatios(s).answered, 3)),
    row(`${ts.tileSatisfaction} %`, s => round(summaryRatios(s).satisfaction, 3)),
    row(`${ts.tileAccuracy} %`, s => round(summaryRatios(s).accuracy, 3)),
    row(ts.tileTickets, s => s.tickets.received),
    ...(opts.withCost ? [row(`${ts.tileCost} (USD)`, s => round(s.cost.usd, 4))] : []),
  ]
  const quality: Aoa = [
    head,
    ...(["fits", "doesNotFit", "none"] as const).map(k => row(`${ts.readerTitle}: ${ts.reader[k]}`, s => s.reader[k])),
    ...(["correct", "wrong", "hallucination", "dismissed", "pending"] as const).map(k => row(`${ts.verdictTitle}: ${ts.verdicts[k]}`, s => s.verdicts[k])),
  ]
  const tt = ts.ticketTiles
  const tickets: Aoa = [
    head,
    row(tt.received, s => s.tickets.received),
    row(tt.answered, s => s.tickets.answered),
    row(tt.closed, s => s.tickets.closed),
    row(tt.reopened, s => s.tickets.reopened),
    row(`${tt.median} (${ts.units.h})`, s => hours(s.tickets.medianMs)),
    row(`${tt.p90} (${ts.units.h})`, s => hours(s.tickets.p90Ms)),
  ]
  const sheets: [string, Aoa][] = [[ts.sheets.summary, summary], [ts.sheets.quality, quality], [ts.sheets.tickets, tickets]]
  if (opts.withCost) {
    sheets.push([ts.sheets.ai, [
      head,
      ...COST_GROUPS.map(g => row(`${ts.groups[g]} (USD)`, s => round(s.cost.byGroup[g].usd, 4))),
      row(`${ts.colTotal} (USD)`, s => round(s.cost.usd, 4)),
      row(`${ts.aiPerAnswer} (USD)`, s => round(summaryRatios(s).perAnswer, 4)),
      row(ts.aiCalls, s => s.cost.calls),
      row(ts.aiTokens, s => s.cost.tokens),
    ]])
  }
  return sheets
}
