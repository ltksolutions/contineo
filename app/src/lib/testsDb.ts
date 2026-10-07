/**
 * Testy v databáze (ADR-018, D120, D121). Stav `ready` sa počíta **pri
 * uložení** z banky (dosť otázok na každú sekciu, zodpovedná osoba,
 * pravidlá) — nie až pri pokuse. Zmena receptu zvýši `version` a uloží ho
 * do `versions[]`; kurz cituje zmrazené číslo (D118).
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import { COURSE_KEY } from "./courses"
import { RESERVED_TEST_KEYS } from "./learningPaths"
import { listQuestions } from "./questionsDb"
import { sectionAvailability } from "./testAttempts"
import {
  DEFAULT_RULES, recipeChanged, testProblems, TESTS_COLLECTION,
  type Test, type TestProblem,
} from "./tests"

export class TestError extends AppError {}

async function col() {
  return getCollection<Test>(TESTS_COLLECTION)
}

export async function listTests(companyCode: string): Promise<Test[]> {
  return (await col()).find({ companyCode }, { projection: { _id: 0 } }).sort({ title: 1 }).toArray()
}

export async function getTest(companyCode: string, key: string): Promise<Test | null> {
  return (await col()).findOne({ companyCode, key }, { projection: { _id: 0 } })
}

/** Testy, za ktoré osoba zodpovedá (záložka Výsledky, D121). */
export async function testsResponsibleFor(companyCode: string, personId: string): Promise<Test[]> {
  return (await col()).find({ companyCode, "responsible.personId": personId }, { projection: { _id: 0 } }).sort({ title: 1 }).toArray()
}

export async function createTest(companyCode: string, key: string, title: string, actor: string): Promise<Test> {
  const k = key.trim().toLowerCase()
  if (!COURSE_KEY.test(k)) throw new TestError("test.keyShape", `Kľúč testu „${k}" nemá správny tvar.`, { key: k })
  // `/learning/tests/questions` by zatienil test s kľúčom `questions` (R3).
  if (RESERVED_TEST_KEYS.includes(k)) throw new TestError("test.keyReserved", `Kľúč testu „${k}" je vyhradený.`, { key: k })
  if (!title.trim()) throw new TestError("test.noTitle", "Názov testu je povinný.")
  const at = new Date()
  const t: Test = {
    companyCode, key: k, title: title.trim(), responsible: [], sections: [], rules: { ...DEFAULT_RULES }, smartTags: [],
    status: "draft", version: 1, versions: [{ version: 1, sections: [], rules: { ...DEFAULT_RULES }, savedAt: at, savedBy: actor }],
    createdAt: at, createdBy: actor,
  }
  try {
    await (await col()).insertOne({ ...t })
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new TestError("test.keyTaken", `Test „${k}" už existuje.`, { key: k })
    throw e
  }
  await writeAudit({ companyCode, subject: "test", action: "created", actor, targetId: k, targetLabel: t.title })
  return t
}

export type TestChange = Pick<Test, "title" | "instructions" | "responsible" | "sections" | "rules" | "smartTags">

/**
 * Uloží test. Stav: `ready`, keď nič nechýba, inak `draft` (vyradený ostáva
 * vyradený). Vráti aj problémy, aby ich editor ukázal.
 */
export async function saveTest(companyCode: string, key: string, change: TestChange, actor: string): Promise<{ test: Test; problems: TestProblem[] }> {
  const before = await getTest(companyCode, key)
  if (!before) throw new TestError("test.notFound", "Taký test nie je.")
  const bank = await listQuestions(companyCode)
  const problems = testProblems(change, sectionAvailability(change, bank))
  const at = new Date()
  const bump = recipeChanged(before, change)
  const version = bump ? before.version + 1 : before.version
  const status = before.status === "retired" ? "retired" : problems.length ? "draft" : "ready"
  const set: Partial<Test> = { ...change, status, version, updatedAt: at, updatedBy: actor }
  await (await col()).updateOne(
    { companyCode, key },
    bump
      ? { $set: set, $push: { versions: { version, sections: change.sections, rules: change.rules, savedAt: at, savedBy: actor } } }
      : { $set: set },
  )
  await writeAudit({ companyCode, subject: "test", action: "changed", actor, targetId: key, targetLabel: change.title, note: `${status}${bump ? `, verzia ${version}` : ""}` })
  return { test: { ...before, ...set, versions: bump ? [...before.versions, { version, sections: change.sections, rules: change.rules, savedAt: at, savedBy: actor }] : before.versions } as Test, problems }
}

export async function setTestRetired(companyCode: string, key: string, retired: boolean, actor: string): Promise<void> {
  await (await col()).updateOne({ companyCode, key }, { $set: { status: retired ? "retired" : "draft", updatedAt: new Date(), updatedBy: actor } })
  await writeAudit({ companyCode, subject: "test", action: retired ? "retired" : "restored", actor, targetId: key })
}

/** `testKey → version` testov v stave `ready` — pre zverejnenie kurzu (zmrazenie, D118). */
export async function readyTestVersions(companyCode: string): Promise<Map<string, number>> {
  const ready = await (await col()).find({ companyCode, status: "ready" }, { projection: { _id: 0, key: 1, version: 1 } }).toArray()
  return new Map(ready.map(t => [t.key, t.version]))
}
