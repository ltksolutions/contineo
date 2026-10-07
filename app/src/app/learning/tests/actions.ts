"use server"

/**
 * Akcie obrazovky Testy a banky otázok (rám TESTS). Rola `learning-admin`
 * sa overuje v každej akcii.
 */

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { importPath, NEW_QUESTION_PATH, questionPath, TESTS_PATH, testsPath } from "@/lib/learningPaths"
import { learningAdminContext, learningContext } from "@/lib/learning"
import { resetAttempts } from "@/lib/testAttemptsDb"
import { createTest, getTest, saveTest, setTestRetired, testsResponsibleFor } from "@/lib/testsDb"
import { getQuestion, importQuestions, saveQuestion, setQuestionStatus, type QuestionInput } from "@/lib/questionsDb"
import { importQuestionsCsv, MAX_ANSWERS, QUESTION_TYPES, DIFFICULTIES, type Answer, type QuestionMedia, type QuestionType, type Difficulty } from "@/lib/questions"
import { SHOW_ANSWERS, type ShowAnswers, type TestSection } from "@/lib/tests"
import { parseSmartTags } from "@/lib/smartTags"
import { slugifyTrackKey } from "@/lib/slug"
import { fileInfo } from "@/lib/fileStore"
import { listPeople } from "@/lib/people"
import { dropImport, loadImport, MAX_IMPORT_BYTES, storeImport } from "@/lib/questionImports"
import { AppError } from "@/lib/appError"
import { dictionary, errorText } from "@/lib/i18n"

async function admin() {
  const ctx = await learningAdminContext()
  if (ctx.state !== "ready") redirect("/")
  return ctx
}

function field(fd: FormData, name: string): string {
  const v = fd.get(name)
  return typeof v === "string" ? v.trim() : ""
}

function num(fd: FormData, name: string): number | undefined {
  const n = Number(field(fd, name))
  return field(fd, name) && Number.isFinite(n) ? n : undefined
}

function go(path: string, message?: string, error = false): never {
  revalidatePath("/learning/tests")
  const sep = path.includes("?") ? "&" : "?"
  redirect(message ? `${path}${sep}msg=${encodeURIComponent(message)}${error ? "&error=1" : ""}` : path)
}

export async function createTestAction(fd: FormData) {
  const ctx = await admin()
  const title = field(fd, "title")
  const key = field(fd, "key") || slugifyTrackKey(title)
  try {
    await createTest(ctx.person.companyCode, key, title, ctx.person.email)
  } catch (e) {
    go(`${TESTS_PATH}?new=1`, errorText(e, ctx.person.language), true)
  }
  go(`${TESTS_PATH}/${key}`)
}

/**
 * Uloženie testu. Sekcie sú riadky `section_{i}_*` jedného formulára;
 * tlačidlá `op` pridajú, posunú alebo odstránia sekciu — bez JavaScriptu,
 * a pritom sa uloží aj všetko ostatné, čo človek v formulári zmenil.
 */
export async function saveTestAction(fd: FormData) {
  const ctx = await admin()
  const key = field(fd, "testKey")
  const t = dictionary(ctx.person.language).learning.tests
  const test = await getTest(ctx.person.companyCode, key)
  if (!test) go("/learning/tests")
  const people = await listPeople(ctx.person.companyCode)
  const responsible = fd.getAll("responsiblePersonId").map(String)
    .map(id => people.find(p => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map(p => ({ personId: p.id, fullName: p.fullName, email: p.email }))

  const n = Number(field(fd, "sections")) || 0
  let sections: TestSection[] = []
  for (let i = 0; i < n; i++) {
    sections.push({
      key: field(fd, `section_${i}_key`) || `s${i + 1}`,
      filter: parseSmartTags(field(fd, `section_${i}_tags`)).tags,
      count: Math.max(1, Math.round(num(fd, `section_${i}_count`) ?? 1)),
    })
  }
  const op = field(fd, "op")
  const [verb, at] = op.split(":")
  const i = Number(at)
  if (verb === "add") sections.push({ key: `s${Date.now().toString(36)}`, filter: [], count: 5 })
  if (verb === "remove") sections = sections.filter((_, k) => k !== i)
  if ((verb === "up" && i > 0) || (verb === "down" && i < sections.length - 1)) {
    const j = verb === "up" ? i - 1 : i + 1
    ;[sections[i], sections[j]] = [sections[j], sections[i]]
  }
  const show = field(fd, "showAnswers") as ShowAnswers
  let ready = false
  try {
    const r = await saveTest(ctx.person.companyCode, key, {
      title: field(fd, "title") || test.title,
      instructions: field(fd, "instructions") || undefined,
      responsible,
      sections,
      rules: {
        passingPercent: num(fd, "passingPercent") ?? 80,
        timeLimitMinutes: num(fd, "timeLimitMinutes") || undefined,
        maxAttempts: num(fd, "maxAttempts") || undefined,
        pauseMinutes: num(fd, "pauseMinutes") || undefined,
        showAnswers: (SHOW_ANSWERS as readonly string[]).includes(show) ? show : "after_submit",
      },
      smartTags: parseSmartTags(field(fd, "smartTags")).tags,
    }, ctx.person.email)
    ready = r.problems.length === 0
  } catch (e) {
    go(`/learning/tests/${key}`, errorText(e, ctx.person.language), true)
  }
  // Pri úprave sekcií bez oznamu — človek pokračuje v úprave.
  if (verb) go(`/learning/tests/${key}#sections`)
  go(`/learning/tests/${key}`, ready ? t.savedReady : t.savedDraft, !ready)
}

export async function retireTestAction(fd: FormData) {
  const ctx = await admin()
  const key = field(fd, "testKey")
  await setTestRetired(ctx.person.companyCode, key, field(fd, "retire") === "1", ctx.person.email)
  go(`${TESTS_PATH}/${key}`)
}

/** Médiá otázky: ponechané z existujúcich + nahraté (druh podľa prípony). */
async function mediaFrom(fd: FormData, companyCode: string, before: QuestionMedia[]): Promise<QuestionMedia[]> {
  const keep = new Set(fd.getAll("keepMedia").map(String))
  const kept = before.filter((_, i) => keep.has(String(i)))
  const alt = field(fd, "mediaAlt")
  const added: QuestionMedia[] = []
  for (const id of field(fd, "fileIds").split(",").map(s => s.trim()).filter(Boolean)) {
    const info = await fileInfo(companyCode, id)
    if (!info) continue
    const ext = info.name.toLowerCase().split(".").pop() ?? ""
    added.push(["mp4", "webm"].includes(ext)
      ? { kind: "video", source: { kind: "internal", assetId: id } }
      : { kind: "image", fileId: id, alt })
  }
  return [...kept, ...added]
}

export async function saveQuestionAction(fd: FormData) {
  const ctx = await admin()
  const t = dictionary(ctx.person.language).learning.tests
  const key = field(fd, "questionKey") || null
  const type = (QUESTION_TYPES as readonly string[]).includes(field(fd, "type")) ? (field(fd, "type") as QuestionType) : "single"
  const before = key ? await getQuestion(ctx.person.companyCode, key) : null
  const back = key ? questionPath(key) : `${NEW_QUESTION_PATH}?type=${type}`
  const correct = new Set(fd.getAll("correct").map(String))
  const answers: Answer[] = []
  if (type === "single" || type === "multiple") {
    for (let i = 0; i < MAX_ANSWERS; i++) {
      const text = field(fd, `answer_${i}`)
      if (text) answers.push({ id: field(fd, `answer_${i}_id`) || `a${i + 1}`, text, correct: correct.has(String(i)) })
    }
  }
  const expected = type === "short_text"
    ? [field(fd, "expected"), ...field(fd, "alternatives").split("\n").map(s => s.trim())].filter(Boolean)
    : undefined
  const input: QuestionInput = {
    type,
    text: field(fd, "text") || undefined,
    media: await mediaFrom(fd, ctx.person.companyCode, before?.media ?? []),
    answers,
    correctTrue: type === "true_false" ? field(fd, "correctTrue") === "true" ? true : field(fd, "correctTrue") === "false" ? false : undefined : undefined,
    expected,
    explanation: field(fd, "explanation") || undefined,
    weight: Math.round(num(fd, "weight") ?? 1),
    difficulty: (DIFFICULTIES as readonly string[]).includes(field(fd, "difficulty")) ? (field(fd, "difficulty") as Difficulty) : "medium",
    smartTags: parseSmartTags(field(fd, "smartTags")).tags,
  }
  let saved = key
  try {
    saved = (await saveQuestion(ctx.person.companyCode, key, input, ctx.person.email)).key
  } catch (e) {
    go(back, errorText(e, ctx.person.language), true)
  }
  go(questionPath(saved ?? ""), t.questionSaved)
}

export async function questionStatusAction(fd: FormData) {
  const ctx = await admin()
  const key = field(fd, "questionKey")
  await setQuestionStatus(ctx.person.companyCode, key, field(fd, "retire") === "1" ? "retired" : "active", ctx.person.email)
  go(questionPath(key))
}

/** Import 1/2: súbor → dočasný záznam → náhľad. Nič sa ešte neimportuje. */
export async function previewImportAction(fd: FormData) {
  const ctx = await admin()
  const file = fd.get("csv")
  if (!(file instanceof File) || file.size === 0) go(importPath(), errorText(new AppError("learning.fileRequired", ""), ctx.person.language), true)
  if (file.size > MAX_IMPORT_BYTES) go(importPath(), errorText(new AppError("file.tooLarge", "", { mb: Math.ceil(file.size / 1048576), maxMb: 2 }), ctx.person.language), true)
  const id = await storeImport(ctx.person.companyCode, ctx.person.email, file.name, await file.text())
  go(importPath(id))
}

/** Import 2/2: znova skontrolovať a zapísať — pri chybe nič (rám TESTS). */
export async function runImportAction(fd: FormData) {
  const ctx = await admin()
  const t = dictionary(ctx.person.language).learning.tests
  const id = field(fd, "importId")
  const stored = await loadImport(ctx.person.companyCode, ctx.person.email, id)
  if (!stored) go(importPath(), t.importExpired, true)
  const parsed = importQuestionsCsv(stored.csv)
  if (parsed.errors.length) go(importPath(id))
  const r = await importQuestions(ctx.person.companyCode, parsed.questions, ctx.person.email)
  await dropImport(ctx.person.companyCode, ctx.person.email, id)
  go(testsPath("questions"), t.imported(r.created, r.updated))
}

/**
 * Reset pokusov osoby (záložka Výsledky, D121) — len zodpovedná osoba
 * testu, nie lektor ani HR. Pokusy sa nemažú; dôvod je povinný a ide do
 * auditu (`resetAttempts`).
 */
export async function resetAttemptsAction(fd: FormData) {
  const ctx = await learningContext()
  if (ctx.state !== "ready") redirect("/")
  const testKey = field(fd, "testKey")
  const personId = field(fd, "personId")
  const back = `${testsPath("results")}?test=${encodeURIComponent(testKey)}`
  const mine = await testsResponsibleFor(ctx.person.companyCode, ctx.person.id)
  if (!mine.some(t => t.key === testKey)) go(testsPath("results"))
  let n = 0
  try {
    n = await resetAttempts(ctx.person.companyCode, testKey, personId, field(fd, "reason"), ctx.person.email)
  } catch (e) {
    go(`${back}&reset=${encodeURIComponent(personId)}`, errorText(e, ctx.person.language), true)
  }
  go(back, dictionary(ctx.person.language).learning.results.resetDone(n))
}
