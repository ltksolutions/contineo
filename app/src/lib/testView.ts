/**
 * Stav testu na zobrazenie (rám TESTS): pripravenému testu môže banka
 * medzičasom prestať stačiť — vtedy „⚠ Nedostatok otázok", aj keď je
 * uložený ako `ready`. Odvodené (D27), nič sa neukladá.
 */

import type { Question } from "./questions"
import { sectionAvailability } from "./testAttempts"
import type { Test } from "./tests"

export type TestDisplayStatus = "ready" | "short" | "draft" | "retired"

export function displayStatus(t: Pick<Test, "status" | "sections">, bank: Question[]): TestDisplayStatus {
  if (t.status === "retired") return "retired"
  if (t.status === "draft") return "draft"
  const avail = sectionAvailability(t, bank)
  return t.sections.some(s => (avail.get(s.key) ?? 0) < s.count) ? "short" : "ready"
}

export type TestRowTone = "ok" | "bad" | "warn" | "muted"

export interface TestRowView {
  /** Text stavu („prešiel 85 %", „rozpracovaný · zostáva 12 min · otázka 8 z 20"). */
  state: string
  tone: TestRowTone
  /** Hlavná akcia; `null` = žiadna (napr. vyčerpané). */
  action: { label: string; href: string } | null
  /** Odkaz na posledný výsledok. */
  resultHref: string | null
}

type AttemptTexts = {
  testOpen: (time: string | null, q: number, total: number) => string
  testPassedPct: (p: number) => string
  testFailedPct: (p: number) => string
  nextAttemptAt: (time: string) => string
  attemptsLeft: (remaining: number, max: number) => string
  continueTest: string
  retry: string
}

/**
 * Riadok testu v časti a v prehľade kurzu (rámy PART, COURSE; TEST-ATTEMPT
 * Q2 ✅ — rozpracovaný pokus s „Pokračovať"). Čisté: dostane stav z
 * `partTestRows` a texty.
 */
export function testRowView(
  row: {
    testKey: string
    rules: { maxAttempts?: number } | null
    questionCount: number
    availability: { open: { id: string; deadlineAt: Date | null } | null; canStart: boolean; reason: string | null; nextAt: Date | null; remaining: number | null; lastPassed: boolean }
    last: { id: string; percent?: number; passed?: boolean } | null
    attempts: { id: string; answers: Record<string, unknown> }[]
  },
  base: string,
  t: AttemptTexts & { notStarted: string; start: string },
  now: Date,
  time: (d: Date) => string,
): TestRowView {
  const href = `${base}/test/${encodeURIComponent(row.testKey)}`
  const av = row.availability
  const resultHref = row.last ? `${href}/${row.last.id}/result` : null
  if (av.open) {
    const open = row.attempts.find(a => a.id === av.open!.id)
    const answered = open ? Object.keys(open.answers).length : 0
    const left = av.open.deadlineAt ? `${Math.max(0, Math.ceil((av.open.deadlineAt.getTime() - now.getTime()) / 60000))} min` : null
    return { state: t.testOpen(left, Math.min(row.questionCount, answered + 1), row.questionCount), tone: "warn", action: { label: t.continueTest, href: `${href}/${av.open.id}` }, resultHref }
  }
  if (av.lastPassed) {
    return { state: t.testPassedPct(row.last?.percent ?? 100), tone: "ok", action: null, resultHref }
  }
  if (!row.last) return { state: t.notStarted, tone: "muted", action: { label: t.start, href }, resultHref: null }
  const failed = t.testFailedPct(row.last.percent ?? 0)
  if (av.canStart) return { state: failed, tone: "bad", action: { label: t.retry, href }, resultHref }
  if (av.reason === "pause" && av.nextAt) return { state: `${failed} · ${t.nextAttemptAt(time(av.nextAt))}`, tone: "bad", action: null, resultHref }
  const max = row.rules?.maxAttempts
  return { state: max ? `${failed} · ${t.attemptsLeft(0, max)}` : failed, tone: "bad", action: null, resultHref }
}
