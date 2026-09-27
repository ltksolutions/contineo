/**
 * Pokusy o test (ADR-018, D120; rámy TEST-ATTEMPT, RESULT) — čisté pravidlá.
 *
 * - **Losovanie**: pre každú sekciu `count` otázok z banky, ktoré vyhovujú
 *   filtru (AND/OR, D117); otázka sa v pokuse neopakuje. Poradie otázok
 *   aj odpovedí sa mieša. Náhoda je **so seedom** uloženým v pokuse —
 *   pokus sa dá presne zopakovať (forenzne) a testovať.
 * - **Snímka**: pokus si uloží znenie, odpovede, správnosť a váhu každej
 *   otázky v poradí, ako ich človek videl. Obrazovka aj vyhodnotenie
 *   čítajú **len** zo snímky — zmena v banke nič nezmení.
 * - **Bodovanie**: súčet váh správnych otázok; „viac správnych" je
 *   **všetko alebo nič** (TESTS Q2 ✅).
 * - **Dostupnosť**: najviac pokusov, pauza medzi pokusmi, otvorený pokus;
 *   resetované pokusy (`resetAt`) sa nerátajú (D121).
 */

import { matchesSmartFilter } from "./smartTags"
import { shortTextMatches, type Answer, type Question, type QuestionMedia, type QuestionType } from "./questions"
import type { ShowAnswers, TestRecipe } from "./tests"

export const TEST_ATTEMPTS_COLLECTION = "test_attempts"

/** Tolerancia pri odovzdaní po limite (sieť, klik v poslednej sekunde). */
export const DEADLINE_GRACE_MS = 10_000

export interface QuestionSnapshot {
  questionKey: string
  questionVersion: number
  type: QuestionType
  text?: string
  media: QuestionMedia[]
  /** Odpovede **v zamiešanom poradí** pokusu. */
  answers: Answer[]
  correctTrue?: boolean
  expected?: string[]
  explanation?: string
  weight: number
}

/** Odpoveď človeka: id odpovedí (`single`, `multiple`), pravda/nepravda, text. */
export type AnswerValue =
  | { kind: "choice"; ids: string[] }
  | { kind: "bool"; value: boolean }
  | { kind: "text"; value: string }

export interface AttemptContext {
  kind: "course"
  courseKey: string
  versionId: string
  partKey: string
  enrollmentId: string
}

export interface TestAttempt {
  id: string
  companyCode: string
  testKey: string
  testVersion: number
  personId: string
  email: string
  fullName: string
  context: AttemptContext
  attemptNumber: number
  seed: number
  questions: QuestionSnapshot[]
  startedAt: Date
  /** Server: začiatok + limit. `null` = bez limitu. */
  deadlineAt: Date | null
  answers: Record<string, AnswerValue & { savedAt: Date }>
  submittedAt?: Date | null
  closedBy?: "user" | "timeout"
  points?: number
  maxPoints?: number
  percent?: number
  passed?: boolean
  /** Pravidlá v čase pokusu (kópia) — hranica, pauza, zobrazenie odpovedí. */
  passingPercent: number
  showAnswers: ShowAnswers
  resetAt?: Date | null
  resetBy?: string
  resetReason?: string
  /** Jedno „Spustiť" = jeden pokus aj pri dvojkliku. */
  idempotencyKey: string
}

/* ── Náhoda so seedom ──────────────────────────────────────────────────── */

/** mulberry32 — malý deterministický generátor (0 ≤ x < 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/* ── Losovanie a snímky ────────────────────────────────────────────────── */

export function snapshotOf(q: Question, random: () => number): QuestionSnapshot {
  return {
    questionKey: q.key,
    questionVersion: q.version,
    type: q.type,
    text: q.text,
    media: structuredClone(q.media ?? []),
    answers: q.type === "single" || q.type === "multiple" ? shuffle(structuredClone(q.answers), random) : [],
    correctTrue: q.correctTrue,
    expected: q.expected ? [...q.expected] : undefined,
    explanation: q.explanation,
    weight: q.weight,
  }
}

/**
 * Vylosuje otázky podľa receptu z aktívnych otázok banky. Vráti `null`,
 * keď na niektorú sekciu nie je dosť otázok (test by nemal byť `ready`).
 */
export function drawQuestions(recipe: Pick<TestRecipe, "sections">, bank: Question[], seed: number): QuestionSnapshot[] | null {
  const random = rng(seed)
  const used = new Set<string>()
  const out: QuestionSnapshot[] = []
  for (const s of recipe.sections) {
    const pool = bank.filter(q => q.status === "active" && !used.has(q.key) && matchesSmartFilter(q.smartTags, s.filter))
    if (pool.length < s.count) return null
    for (const q of shuffle(pool, random).slice(0, s.count)) {
      used.add(q.key)
      out.push(snapshotOf(q, random))
    }
  }
  return out
}

/** Koľko aktívnych otázok vyhovuje každej sekcii (editor testu). */
export function sectionAvailability(recipe: Pick<TestRecipe, "sections">, bank: Question[]): Map<string, number> {
  return new Map(recipe.sections.map(s => [s.key, bank.filter(q => q.status === "active" && matchesSmartFilter(q.smartTags, s.filter)).length]))
}

/* ── Vyhodnotenie ──────────────────────────────────────────────────────── */

export function isCorrect(q: QuestionSnapshot, a: AnswerValue | undefined): boolean {
  if (!a) return false
  switch (q.type) {
    case "single":
    case "multiple": {
      if (a.kind !== "choice") return false
      const want = new Set(q.answers.filter(x => x.correct).map(x => x.id))
      const got = new Set(a.ids)
      // Všetko alebo nič: presná zhoda množín (TESTS Q2 ✅).
      return want.size === got.size && [...want].every(id => got.has(id))
    }
    case "true_false":
      return a.kind === "bool" && a.value === q.correctTrue
    case "short_text":
      return a.kind === "text" && shortTextMatches(a.value, q.expected ?? [])
  }
}

export interface AttemptScore {
  points: number
  maxPoints: number
  percent: number
  passed: boolean
  /** Správnosť po otázkach v poradí pokusu. */
  results: boolean[]
}

export function scoreAttempt(questions: QuestionSnapshot[], answers: Record<string, AnswerValue>, passingPercent: number): AttemptScore {
  const results = questions.map(q => isCorrect(q, answers[q.questionKey]))
  const maxPoints = questions.reduce((n, q) => n + q.weight, 0)
  const points = questions.reduce((n, q, i) => n + (results[i] ? q.weight : 0), 0)
  const percent = maxPoints ? Math.round((points / maxPoints) * 100) : 0
  return { points, maxPoints, percent, passed: percent >= passingPercent, results }
}

/** Uplynul čas pokusu (s toleranciou)? */
export function isExpired(a: Pick<TestAttempt, "deadlineAt">, now: Date): boolean {
  return Boolean(a.deadlineAt) && now.getTime() > a.deadlineAt!.getTime() + DEADLINE_GRACE_MS
}

/* ── Dostupnosť pokusu ─────────────────────────────────────────────────── */

export interface Availability {
  /** Otvorený (neodovzdaný, neresetovaný) pokus — pokračuje sa v ňom. */
  open: Pick<TestAttempt, "id" | "deadlineAt" | "startedAt"> | null
  canStart: boolean
  reason: "pause" | "exhausted" | "passed" | null
  /** Kedy bude ďalší pokus možný (pri pauze). */
  nextAt: Date | null
  used: number
  /** `null` = bez obmedzenia. */
  remaining: number | null
  lastPassed: boolean
}

/**
 * Dá sa spustiť ďalší pokus? `attempts` sú pokusy tej istej osoby o ten
 * istý test v tom istom kontexte. Kto už prešiel, ďalší nepotrebuje.
 */
export function availability(
  attempts: Pick<TestAttempt, "id" | "deadlineAt" | "startedAt" | "submittedAt" | "passed" | "resetAt">[],
  rules: { maxAttempts?: number; pauseMinutes?: number },
  now: Date,
): Availability {
  const counted = attempts.filter(a => !a.resetAt)
  const open = counted.find(a => !a.submittedAt && !isExpired(a, now)) ?? null
  const closed = counted.filter(a => a.submittedAt || isExpired(a, now))
    .sort((a, b) => (a.submittedAt ?? a.deadlineAt ?? a.startedAt).getTime() - (b.submittedAt ?? b.deadlineAt ?? b.startedAt).getTime())
  const last = closed[closed.length - 1]
  const lastPassed = Boolean(closed.some(a => a.passed))
  const used = counted.length
  const remaining = rules.maxAttempts ? Math.max(0, rules.maxAttempts - used) : null
  if (open) return { open, canStart: false, reason: null, nextAt: null, used, remaining, lastPassed }
  if (lastPassed) return { open: null, canStart: false, reason: "passed", nextAt: null, used, remaining, lastPassed }
  if (remaining === 0) return { open: null, canStart: false, reason: "exhausted", nextAt: null, used, remaining, lastPassed }
  if (last && rules.pauseMinutes) {
    const end = last.submittedAt ?? last.deadlineAt ?? last.startedAt
    const nextAt = new Date(end.getTime() + rules.pauseMinutes * 60_000)
    if (nextAt > now) return { open: null, canStart: false, reason: "pause", nextAt, used, remaining, lastPassed }
  }
  return { open: null, canStart: true, reason: null, nextAt: null, used, remaining, lastPassed }
}

/** Smie človek vidieť správne odpovede (RESULT)? */
export function answersVisible(show: ShowAnswers, passed: boolean, exhausted: boolean): boolean {
  return show === "after_submit" || (show === "after_pass" && passed) || (show === "after_last_attempt" && (exhausted || passed))
}
