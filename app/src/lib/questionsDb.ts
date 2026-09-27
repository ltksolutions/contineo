/**
 * Banka otázok v databáze (ADR-018, D120). Každý dotaz nesie `companyCode`
 * (D32). Otázka sa nemaže — vyraďuje sa; úprava zvyšuje `version`
 * (pokusy citujú snímku, takže staré znenie ostane v pokuse).
 */

import { getCollection } from "./mongodb"
import { writeAudit } from "./audit"
import { AppError } from "./appError"
import {
  QUESTIONS_COLLECTION, questionKeyFrom, questionProblems,
  type ImportedQuestion, type Question,
} from "./questions"
import { TEST_ATTEMPTS_COLLECTION } from "./testAttempts"
import { TESTS_COLLECTION, type Test } from "./tests"
import { matchesSmartFilter } from "./smartTags"

export class QuestionError extends AppError {}

async function col() {
  return getCollection<Question>(QUESTIONS_COLLECTION)
}

export async function listQuestions(companyCode: string): Promise<Question[]> {
  return (await col()).find({ companyCode }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
}

export async function getQuestion(companyCode: string, key: string): Promise<Question | null> {
  return (await col()).findOne({ companyCode, key }, { projection: { _id: 0 } })
}

export type QuestionInput = Pick<Question, "type" | "text" | "media" | "answers" | "correctTrue" | "expected" | "explanation" | "weight" | "difficulty" | "smartTags">

/** Založí alebo upraví otázku. Pri úprave `version + 1`. */
export async function saveQuestion(companyCode: string, key: string | null, input: QuestionInput, actor: string): Promise<Question> {
  const problems = questionProblems(input)
  if (problems.length) throw new QuestionError(problems[0], "Otázka sa nedá uložiť.", { count: problems.length })
  const c = await col()
  const at = new Date()
  if (key) {
    const before = await c.findOne({ companyCode, key }, { projection: { _id: 0 } })
    if (!before) throw new QuestionError("question.notFound", "Taká otázka v banke nie je.")
    const next: Question = { ...before, ...input, version: before.version + 1, updatedAt: at, updatedBy: actor }
    await c.updateOne({ companyCode, key }, { $set: { ...input, version: next.version, updatedAt: at, updatedBy: actor } })
    await writeAudit({ companyCode, subject: "question", action: "changed", actor, targetId: key, targetLabel: (input.text ?? "").slice(0, 80), note: `verzia ${next.version}` })
    return next
  }
  const q: Question = { companyCode, key: questionKeyFrom(undefined), ...input, status: "active", version: 1, createdAt: at, createdBy: actor }
  await c.insertOne({ ...q })
  await writeAudit({ companyCode, subject: "question", action: "created", actor, targetId: q.key, targetLabel: (input.text ?? "").slice(0, 80) })
  return q
}

export async function setQuestionStatus(companyCode: string, key: string, status: "active" | "retired", actor: string): Promise<void> {
  await (await col()).updateOne({ companyCode, key }, { $set: { status, updatedAt: new Date(), updatedBy: actor } })
  await writeAudit({ companyCode, subject: "question", action: status === "retired" ? "retired" : "restored", actor, targetId: key })
}

/**
 * Import z CSV (rám TESTS, Q1 ✅). `id` existujúcej otázky ju upraví
 * (nová verzia), inak vznikne nová s kľúčom z `id`. Volajúci importuje
 * len vtedy, keď `importQuestionsCsv` nevrátil žiadnu chybu.
 */
export async function importQuestions(companyCode: string, rows: ImportedQuestion[], actor: string): Promise<{ created: number; updated: number }> {
  const c = await col()
  const at = new Date()
  let created = 0, updated = 0
  for (const r of rows) {
    const key = r.id ? questionKeyFrom(r.id) : questionKeyFrom(undefined)
    const before = r.id ? await c.findOne({ companyCode, key }, { projection: { _id: 0 } }) : null
    if (before) {
      // Médiá sa CSV nenesú — pri úprave ostanú tie, čo otázka mala.
      await c.updateOne({ companyCode, key }, { $set: { ...r.question, media: before.media, version: before.version + 1, updatedAt: at, updatedBy: actor } })
      updated++
    } else {
      await c.insertOne({ companyCode, key, ...r.question, status: "active", version: 1, createdAt: at, createdBy: actor })
      created++
    }
  }
  await writeAudit({ companyCode, subject: "question", action: "imported", actor, targetId: null, note: `nových ${created}, upravených ${updated}` })
  return { created, updated }
}

/** „Použitá v 2 testoch · 41 pokusov ju cituje snímkou" (rám TESTS). */
export async function questionUsage(companyCode: string, q: Question): Promise<{ tests: number; attempts: number }> {
  const tests = await (await getCollection<Test>(TESTS_COLLECTION)).find({ companyCode, status: { $ne: "retired" } }, { projection: { _id: 0, sections: 1 } }).toArray()
  const attempts = await (await getCollection(TEST_ATTEMPTS_COLLECTION)).countDocuments({ companyCode, "questions.questionKey": q.key })
  return { tests: tests.filter(t => t.sections.some(s => matchesSmartFilter(q.smartTags, s.filter))).length, attempts }
}
