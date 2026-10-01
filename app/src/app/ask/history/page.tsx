/**
 * /ask/history — „Moje otázky" (ASK-historia-otazok).
 *
 * Vlastné otázky po dňoch, najnovšie hore, s hľadaním (slová bez
 * diakritiky) a „Načítať staršie" po 30. Riadok vedie na uloženú odpoveď
 * (`/ask/a/{id}`); × ju skryje z histórie s „Vrátiť". Všetko sú odkazy
 * a formuláre — stránka funguje bez JavaScriptu.
 *
 * Zdroj je `evaluations` (H1), lehota uchovania z nastavení organizácie
 * (`answersMonths`, H2) — tá istá, podľa ktorej maže retencia.
 */

import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { onboardingContext } from "@/lib/session"
import AppShell from "@/components/AppShell"
import AutoDismiss from "@/components/AutoDismiss"
import { listHistory, type HistoryItem } from "@/lib/askHistory"
import { retentionSettings } from "@/lib/retention"
import { SEARCH_TIME_ZONE } from "@/lib/versionContext"
import { normalizeQuery, type RawQuery } from "@/lib/urlParams"
import { dictionary, type UiLanguage } from "@/lib/i18n"
import { hideQuestionAction, unhideQuestionAction, hideAllAction, unhideAllAction } from "./actions"

export const dynamic = "force-dynamic"

/** Deň v časovom pásme organizácie, nie servera (UTC). */
const dayKey = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: SEARCH_TIME_ZONE })

function dayLabel(d: Date, now: Date, language: UiLanguage, t: ReturnType<typeof dictionary>["ask"]["history"]) {
  const key = dayKey(d)
  if (key === dayKey(now)) return t.today
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return t.yesterday
  return d.toLocaleDateString(language, { timeZone: SEARCH_TIME_ZONE, weekday: "long", day: "numeric", month: "long" })
}

export default async function AskHistoryPage({ searchParams }: { searchParams: Promise<RawQuery> }) {
  const q = normalizeQuery<{ q?: string; before?: string; hidden?: string; cleared?: string; confirm?: string }>(await searchParams)
  const ctx = await onboardingContext()
  if (ctx.state === "unknown-host") notFound()
  if (ctx.state === "not-signed-in") redirect("/sign-in")
  if (ctx.state !== "ready") notFound()

  const language = ctx.person.language
  const t = dictionary(language).ask.history
  const query = (q.q ?? "").trim()
  const before = q.before ? new Date(q.before) : undefined
  const { items, hasMore } = await listHistory(ctx.tenant.companyCode, ctx.person.id, {
    q: query,
    before: before && !Number.isNaN(before.getTime()) ? before : undefined,
  })
  const months = retentionSettings(ctx.tenant.privacy?.retention).answersMonths
  const now = new Date()

  const days: { key: string; label: string; items: HistoryItem[] }[] = []
  for (const it of items) {
    const key = dayKey(it.createdAt)
    if (days.at(-1)?.key !== key) days.push({ key, label: dayLabel(it.createdAt, now, language, t), items: [] })
    days.at(-1)!.items.push(it)
  }
  const time = (d: Date) => d.toLocaleTimeString(language, { timeZone: SEARCH_TIME_ZONE, hour: "2-digit", minute: "2-digit" })
  const status = (it: HistoryItem) => [
    it.none ? t.status.none : t.status.citations(it.citations),
    it.readerVerdict === 1 ? t.status.fits : it.readerVerdict === 0 ? t.status.doesNotFit : null,
  ].filter(Boolean).join(" · ")
  const older = items.at(-1)
  const olderHref = older
    ? `/ask/history?${new URLSearchParams({ ...(query ? { q: query } : {}), before: older.createdAt.toISOString() })}`
    : null

  return (
    <AppShell language={language} title={t.title}>
      <div className="ask-history">
        <div className="ask-history-head">
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="quiet page-lead">{t.lead}</p>
          </div>
          {items.length > 0 && !query && (
            <Link className="button button--quiet" href="/ask/history?confirm=1">{t.clearAll}</Link>
          )}
        </div>

        {/* Potvrdenie „Vymazať celú históriu" — stav v adrese, bez skriptu. */}
        {q.confirm === "1" && (
          <div className="card ask-history-confirm" role="alertdialog" aria-labelledby="clear-title">
            <p id="clear-title">{t.clearConfirm}</p>
            <form action={hideAllAction}>
              <button className="button" type="submit">{t.clearAll}</button>{" "}
              <Link className="button button--quiet" href="/ask/history">{t.clearCancel}</Link>
            </form>
          </div>
        )}

        {q.hidden && (
          <AutoDismiss>
            <form action={unhideQuestionAction} className="ask-toast" role="status">
              <input type="hidden" name="id" value={q.hidden} />
              <input type="hidden" name="q" value={query} />
              {t.removed}
              <button type="submit">{t.undo}</button>
            </form>
          </AutoDismiss>
        )}
        {q.cleared && (
          <AutoDismiss>
            <form action={unhideAllAction} className="ask-toast" role="status">
              <input type="hidden" name="at" value={q.cleared} />
              {t.removedAll}
              <button type="submit">{t.undo}</button>
            </form>
          </AutoDismiss>
        )}

        <form className="ask-history-filter" method="get" action="/ask/history" role="search">
          <input className="field-input" type="search" name="q" defaultValue={query} placeholder={t.filter} aria-label={t.filter} />
          <button className="button button--quiet" type="submit">{t.filterSubmit}</button>
        </form>

        {items.length === 0 && (
          <div className="empty">
            <div className="empty-title">{query ? t.emptyFilter : t.empty}</div>
            <div className="empty-text">{query ? t.emptyFilterText : t.emptyText}</div>
          </div>
        )}

        {days.map(day => (
          <section key={day.key} className="ask-history-day" aria-labelledby={`day-${day.key}`}>
            <h2 className="ask-history-day-title" id={`day-${day.key}`}>{day.label}</h2>
            <ul className="card ask-history-list">
              {day.items.map(it => (
                <li key={it.id} className="ask-history-row">
                  <Link href={`/ask/a/${encodeURIComponent(it.id)}`} className="ask-history-open">
                    <span className="ask-history-question">{it.question}</span>
                    <span className="ask-history-meta">
                      <time dateTime={it.createdAt.toISOString()}>{time(it.createdAt)}</time> · {status(it)}
                    </span>
                  </Link>
                  <form action={hideQuestionAction}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="q" value={query} />
                    <button type="submit" className="ask-history-hide" aria-label={t.remove} title={t.remove}>
                      <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7"
                           strokeLinecap="round" aria-hidden="true">
                        <path d="M5 5l8 8M13 5l-8 8" />
                      </svg>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {hasMore && olderHref && (
          <Link className="button button--quiet ask-history-more" href={olderHref}>{t.loadOlder}</Link>
        )}

        <p className="quiet ask-history-retention">{t.retention(months)}</p>
      </div>
    </AppShell>
  )
}
