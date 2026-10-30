/**
 * channelStatsView.ts — čísla štatistiky kanála do textu: názvy období,
 * zmena oproti predchádzajúcemu obdobiu, trvanie. Spoločné pre obrazovku
 * a export do Excelu, aby board videl v tabuľke to isté ako na stránke.
 */

import { dictionary, type UiLanguage } from "./i18n"
import { formatUsd } from "./pricing"
import { shiftRange, type PeriodSummary, type StatBucket, type StatRange } from "./channelStats"

export function statsLocale(language: UiLanguage): string {
  return language === "en" ? "en-GB" : language === "cs" ? "cs-CZ" : "sk-SK"
}

const utc = (d: { year: number; month: number; day: number }) => new Date(Date.UTC(d.year, d.month, d.day))
const capital = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1)

/** „Týždeň 26. 10. – 1. 11. 2026", „Október 2026", „2026", „Piatok 30. 10. 2026". */
export function rangeTitle(r: StatRange, language: UiLanguage): string {
  const locale = statsLocale(language)
  const ts = dictionary(language).channels.stats
  if (r.period === "year") return String(r.first.year)
  if (r.period === "month") {
    return capital(new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(r.first)))
  }
  if (r.period === "day") {
    return capital(new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).format(utc(r.first)))
  }
  return ts.weekTitle(rangeSpan(r, language))
}

/** Krátko pre porovnanie a hlavičky stĺpcov exportu: „19. – 25. 10. 2026", „09/2026". */
export function rangeShort(r: StatRange, language: UiLanguage): string {
  const locale = statsLocale(language)
  if (r.period === "year") return String(r.first.year)
  if (r.period === "month") return new Intl.DateTimeFormat(locale, { month: "numeric", year: "numeric", timeZone: "UTC" }).format(utc(r.first))
  if (r.period === "day") return new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).format(utc(r.first))
  return rangeSpan(r, language)
}

/** „26. 10. – 1. 11. 2026" — rok len raz, keď sa obdobie neláme cez Silvestra. */
function rangeSpan(r: StatRange, language: UiLanguage): string {
  const locale = statsLocale(language)
  const full = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" })
  const short = new Intl.DateTimeFormat(locale, { day: "numeric", month: "numeric", timeZone: "UTC" })
  const from = r.first.year === r.last.year ? short.format(utc(r.first)) : full.format(utc(r.first))
  return `${from} – ${full.format(utc(r.last))}`
}

/** Popis stĺpca grafu: hodina, „po 26.", deň v mesiaci, mesiac. */
export function bucketLabel(r: StatRange, b: StatBucket, language: UiLanguage): string {
  if (r.period === "day") return String(b.hour ?? 0)
  if (r.period === "year") return dictionary(language).org.aiUsage.monthHeads[b.month]
  if (r.period === "month") return String(b.day)
  const wd = new Intl.DateTimeFormat(statsLocale(language), { weekday: "short", timeZone: "UTC" }).format(utc(b))
  return `${wd} ${b.day}.`
}

/** Celý popis stĺpca pre čítačku a `title`. */
export function bucketTitle(r: StatRange, b: StatBucket, language: UiLanguage): string {
  const locale = statsLocale(language)
  if (r.period === "day") return `${b.hour ?? 0}:00`
  if (r.period === "year") return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(utc(b))
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" }).format(utc(b))
}

/** „45 min", „3 h 20 min", „1 d 4 h". */
export function formatDuration(ms: number | null, language: UiLanguage): string {
  if (ms === null) return "—"
  const u = dictionary(language).channels.stats.units
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} ${u.min}`
  const h = Math.floor(min / 60)
  if (h < 24) return min % 60 ? `${h} ${u.h} ${min % 60} ${u.min}` : `${h} ${u.h}`
  return h % 24 ? `${Math.floor(h / 24)} ${u.d} ${h % 24} ${u.h}` : `${Math.floor(h / 24)} ${u.d}`
}

export const ratio = (part: number, whole: number): number | null => (whole ? part / whole : null)

export function formatPct(r: number | null, language: UiLanguage): string {
  return r === null ? "—" : `${new Intl.NumberFormat(statsLocale(language)).format(Math.round(r * 100))} %`
}

/** Ukazovatele súhrnu — tie isté na dlaždiciach aj v exporte. */
export function summaryRatios(s: PeriodSummary) {
  return {
    answered: ratio(s.answered, s.questions),
    satisfaction: ratio(s.reader.fits, s.reader.fits + s.reader.doesNotFit),
    accuracy: ratio(s.verdicts.correct, s.verdicts.correct + s.verdicts.wrong),
    perAnswer: s.answered ? s.cost.usd / s.answered : null,
  }
}

export type DeltaTone = "is-better" | "is-worse" | "is-same"
export interface Delta { text: string; tone: DeltaTone }

/**
 * Zmena oproti predchádzajúcemu obdobiu. `better` hovorí, ktorý smer je
 * dobrý — viac otázok nie je ani dobre, ani zle (`null`), vyššia cena je
 * horšie. Farba nesie hodnotenie, šípka smer (stav nie len farbou).
 */
export function delta(
  cur: number | null,
  prev: number | null,
  kind: "count" | "share" | "points" | "usd" | "duration",
  better: "up" | "down" | null,
  language: UiLanguage,
): Delta {
  const ts = dictionary(language).channels.stats
  const locale = statsLocale(language)
  if (cur === null || prev === null) return { text: ts.deltaNone, tone: "is-same" }
  const diff = kind === "points" ? Math.round(cur * 100) - Math.round(prev * 100) : cur - prev
  if (Math.abs(diff) < (kind === "usd" ? 0.005 : kind === "duration" ? 60_000 : 0.5)) return { text: ts.deltaSame, tone: "is-same" }
  const arrow = diff > 0 ? "▲" : "▼"
  const tone: DeltaTone = better === null ? "is-same" : (diff > 0) === (better === "up") ? "is-better" : "is-worse"
  const num = (n: number) => new Intl.NumberFormat(locale).format(n)
  const text =
    kind === "points" ? ts.deltaPoints(`${arrow} ${num(Math.abs(diff))}`) :
    kind === "usd" ? `${arrow} ${formatUsd(Math.abs(diff))}` :
    kind === "duration" ? `${arrow} ${diff < 0 ? ts.faster(formatDuration(-diff, language)) : ts.slower(formatDuration(diff, language))}` :
    kind === "share" && prev > 0 ? ts.deltaVs(`${arrow} ${num(Math.round((Math.abs(diff) / prev) * 100))} %`, num(prev)) :
    `${arrow} ${num(Math.abs(diff))}`
  return { text, tone }
}

/** Predchádzajúce obdobia pre export: najstaršie prvé, posledné je zvolené. */
export function rangeHistory(r: StatRange, count: number): StatRange[] {
  return Array.from({ length: count + 1 }, (_, i) => shiftRange(r, i - count))
}
