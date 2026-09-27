/**
 * Pokusy o test v databáze (ADR-018, D120, D121; rámy TEST-ATTEMPT, RESULT).
 *
 * - Spustenie je **idempotentné** (`idempotencyKey`) — dvojklik „Spustiť"
 *   vyrobí jeden pokus.
 * - Čas stráži **server** (`deadlineAt`); uloženie po limite sa neprijme
 *   a pokus po limite uzavrie ten, kto ho prvý číta (`closeIfExpired`).
 * - Pokus sa nemaže ani neprepisuje po uzavretí (D24); reset je
 *   `resetAt` + dôvod + audit.
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import { listQuestions } from "./questionsDb"
import { getTest } from "./testsDb"
import { recipeOf, type Test, type TestRecipe } from "./tests"
import type { Enrollment } from "./enrollments"
import type { PassedTestFact } from "./learningProgress"
import {
  availability, drawQuestions, isExpired, scoreAttempt, TEST_ATTEMPTS_COLLECTION,
  type AnswerValue, type TestAttempt,
} from "./testAttempts"

export class AttemptError extends AppError {}

async function col() {
  return getCollection<TestAttempt>(TEST_ATTEMPTS_COLLECTION)
}

export async function getAttempt(companyCode: string, id: string): Promise<TestAttempt | null> {
  const a = await (await col()).findOne({ companyCode, id }, { projection: { _id: 0 } })
  return a ? closeIfExpired(a) : null
}

/** Pokusy osoby o test v jednej časti kurzu (zápis + časť). */
export async function attemptsFor(companyCode: string, personId: string, testKey: string, enrollmentId: string, partKey: string): Promise<TestAttempt[]> {
  const list = await (await col())
    .find({ companyCode, personId, testKey, "context.enrollmentId": enrollmentId, "context.partKey": partKey }, { projection: { _id: 0 } })
    .sort({ startedAt: 1 }).toArray()
  return Promise.all(list.map(closeIfExpired))
}

/** Uzavrie pokus, ktorému uplynul čas — vyhodnotí to, čo stihol uložiť. */
async function closeIfExpired(a: TestAttempt): Promise<TestAttempt> {
  const now = new Date()
  if (a.submittedAt || !isExpired(a, now)) return a
  const s = scoreAttempt(a.questions, a.answers, a.passingPercent)
  const set = { submittedAt: a.deadlineAt!, closedBy: "timeout" as const, points: s.points, maxPoints: s.maxPoints, percent: s.percent, passed: s.passed }
  // Podmienka `submittedAt: null` — dve súbežné čítania neuzavrú dvakrát.
  await (await col()).updateOne({ companyCode: a.companyCode, id: a.id, submittedAt: null }, { $set: set })
  return { ...a, ...set }
}

/**
 * Spustí pokus. Otvorený pokus sa vráti (pokračuje sa v ňom, TEST-ATTEMPT
 * Q2 ✅); pauza a vyčerpané pokusy sa odmietnu. Recept je verzia testu
 * zmrazená v kurze (`testVersion`), inak aktuálna.
 */
export async function startAttempt(input: {
  enrollment: Enrollment
  partKey: string
  testKey: string
  testVersion?: number
  idempotencyKey: string
}): Promise<TestAttempt> {
  const e = input.enrollment
  const c = await col()
  const same = await c.findOne({ companyCode: e.companyCode, idempotencyKey: input.idempotencyKey }, { projection: { _id: 0 } })
  if (same) return same
  const test = await getTest(e.companyCode, input.testKey)
  if (!test || test.status === "retired") throw new AttemptError("attempt.testNotFound", "Taký test nie je.")
  const recipe = recipeOf(test, input.testVersion)
  if (!recipe) throw new AttemptError("attempt.testNotFound", "Verzia testu neexistuje.")
  const previous = await attemptsFor(e.companyCode, e.personId, test.key, e.id, input.partKey)
  const now = new Date()
  const avail = availability(previous, recipe.rules, now)
  if (avail.open) return (await c.findOne({ companyCode: e.companyCode, id: avail.open.id }, { projection: { _id: 0 } }))!
  if (!avail.canStart) throw new AttemptError(`attempt.${avail.reason}`, "Ďalší pokus teraz nie je možný.")

  const seed = Math.floor(Math.random() * 2 ** 31)
  const questions = drawQuestions(recipe, await listQuestions(e.companyCode), seed)
  if (!questions) throw new AttemptError("attempt.notEnoughQuestions", "V banke nie je dosť otázok na tento test.")
  const attempt: TestAttempt = {
    id: crypto.randomUUID(),
    companyCode: e.companyCode,
    testKey: test.key,
    testVersion: recipe.version,
    personId: e.personId,
    email: e.email,
    fullName: e.fullName,
    context: { kind: "course", courseKey: e.courseKey, versionId: e.versionId, partKey: input.partKey, enrollmentId: e.id },
    attemptNumber: previous.filter(a => !a.resetAt).length + 1,
    seed,
    questions,
    startedAt: now,
    deadlineAt: recipe.rules.timeLimitMinutes ? new Date(now.getTime() + recipe.rules.timeLimitMinutes * 60_000) : null,
    answers: {},
    submittedAt: null,
    passingPercent: recipe.rules.passingPercent,
    showAnswers: recipe.rules.showAnswers,
    resetAt: null,
    idempotencyKey: input.idempotencyKey,
  }
  try {
    await c.insertOne({ ...attempt })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const won = await c.findOne({ companyCode: e.companyCode, idempotencyKey: input.idempotencyKey }, { projection: { _id: 0 } })
      if (won) return won
    }
    throw err
  }
  return attempt
}

/**
 * Priebežné uloženie odpovedí (každých 30 s a pri „Ďalej"). Len vlastný,
 * otvorený pokus pred limitom; odpovede na otázky mimo snímky sa zahodia.
 */
export async function saveAnswers(companyCode: string, attemptId: string, personId: string, answers: Record<string, AnswerValue>): Promise<{ savedAt: Date }> {
  const a = await getAttempt(companyCode, attemptId)
  if (!a || a.personId !== personId) throw new AttemptError("attempt.notFound", "Pokus sa nenašiel.")
  if (a.submittedAt || a.resetAt) throw new AttemptError("attempt.closed", "Pokus je už uzavretý.")
  const savedAt = new Date()
  const keys = new Set(a.questions.map(q => q.questionKey))
  const set: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(answers)) if (keys.has(k)) set[`answers.${k}`] = { ...v, savedAt }
  if (Object.keys(set).length) await (await col()).updateOne({ companyCode, id: attemptId, submittedAt: null }, { $set: set })
  return { savedAt }
}

/** Odovzdanie. Vyhodnocuje server podľa snímky; po limite rozhodne `closeIfExpired`. */
export async function submitAttempt(companyCode: string, attemptId: string, personId: string, answers: Record<string, AnswerValue> = {}): Promise<TestAttempt> {
  if (Object.keys(answers).length) await saveAnswers(companyCode, attemptId, personId, answers).catch(() => {})
  const a = await getAttempt(companyCode, attemptId)
  if (!a || a.personId !== personId) throw new AttemptError("attempt.notFound", "Pokus sa nenašiel.")
  if (a.submittedAt) return a
  const s = scoreAttempt(a.questions, a.answers, a.passingPercent)
  const set = { submittedAt: new Date(), closedBy: "user" as const, points: s.points, maxPoints: s.maxPoints, percent: s.percent, passed: s.passed }
  await (await col()).updateOne({ companyCode, id: attemptId, submittedAt: null }, { $set: set })
  return { ...a, ...set }
}

/**
 * Reset pokusov osoby o test (záložka Výsledky, D121) — len zodpovedná
 * osoba testu (overí volajúci). Pokusy sa nemažú: `resetAt` + dôvod.
 */
export async function resetAttempts(companyCode: string, testKey: string, personId: string, reason: string, actor: string): Promise<number> {
  const text = reason.trim()
  if (!text) throw new AttemptError("learning.reasonRequired", "Dôvod je povinný.")
  const r = await (await col()).updateMany(
    { companyCode, testKey, personId, resetAt: null, passed: { $ne: true } },
    { $set: { resetAt: new Date(), resetBy: actor, resetReason: text } },
  )
  await writeAudit({ companyCode, subject: "test-attempt", action: "reset", actor, targetId: `${testKey}:${personId}`, note: `${text} (${r.modifiedCount})` })
  return r.modifiedCount
}

/** Pokusy o test pre záložku Výsledky (všetky osoby). */
export async function attemptsOfTest(companyCode: string, testKey: string): Promise<TestAttempt[]> {
  return (await col()).find({ companyCode, testKey }, { projection: { _id: 0, questions: 0 } }).sort({ startedAt: -1 }).toArray()
}

/** Prejdené testy zápisov — udalosti pre odvodenie postupu (D119). */
export async function passedTestsFor(companyCode: string, enrollmentIds: string[]): Promise<Map<string, PassedTestFact[]>> {
  const out = new Map<string, PassedTestFact[]>(enrollmentIds.map(id => [id, []]))
  if (!enrollmentIds.length) return out
  const passed = await (await col()).find(
    { companyCode, "context.enrollmentId": { $in: enrollmentIds }, passed: true, resetAt: null },
    { projection: { _id: 0, testKey: 1, context: 1, submittedAt: 1 } },
  ).toArray()
  for (const a of passed) out.get(a.context.enrollmentId)?.push({ partKey: a.context.partKey, testKey: a.testKey, at: a.submittedAt! })
  return out
}

export interface PartTestRow {
  testKey: string
  required: boolean
  test: Test | null
  rules: TestRecipe["rules"] | null
  questionCount: number
  attempts: TestAttempt[]
  availability: ReturnType<typeof availability>
  /** Posledný uzavretý pokus. */
  last: TestAttempt | null
}

/**
 * Stav testov jednej časti pre zapísaného človeka (PART, COURSE, úvod
 * testu): recept zo zmrazenej verzie (D118), pokusy, dostupnosť.
 */
export async function partTestRows(enrollment: Enrollment, part: { key: string; tests: { testKey: string; required: boolean; testVersion?: number }[] }): Promise<PartTestRow[]> {
  const now = new Date()
  return Promise.all(part.tests.map(async x => {
    const test = await getTest(enrollment.companyCode, x.testKey)
    const recipe = test ? recipeOf(test, x.testVersion) : null
    const attempts = await attemptsFor(enrollment.companyCode, enrollment.personId, x.testKey, enrollment.id, part.key)
    const closed = attempts.filter(a => a.submittedAt && !a.resetAt)
    return {
      testKey: x.testKey,
      required: x.required,
      test,
      rules: recipe?.rules ?? null,
      questionCount: recipe ? recipe.sections.reduce((n, s) => n + s.count, 0) : 0,
      attempts,
      availability: availability(attempts, recipe?.rules ?? {}, now),
      last: closed[closed.length - 1] ?? null,
    }
  }))
}
