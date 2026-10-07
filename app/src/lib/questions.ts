/**
 * Banka otázok (ADR-018, D120; rám TESTS-testy-a-banka) — typy a čisté
 * pravidlá: kontrola otázky, porovnanie krátkeho textu, import a export CSV.
 *
 * Otázka sa **nemaže, vyraďuje** (`retired`) — pokusy ju citujú snímkou.
 * Úprava zvyšuje `version`; pokus si nesie snímku, takže zmena v banke
 * nemení, čo človek videl (D120).
 *
 * Typy sú kódy z CSV (rám, TESTS Q1 ✅): `single` · `multiple` ·
 * `true_false` · `short_text` (ADR ich píše `single_choice` …, v kóde platí
 * kratší tvar — ADR-018 §6).
 */

import type { VideoSource } from "./courses"
import { normalizeSmartTags, tagId, type SmartTag } from "./smartTags"
import { slugifyKey } from "./slug"
import { RESERVED_QUESTION_KEYS } from "./learningPaths"

export const QUESTIONS_COLLECTION = "questions"

export const QUESTION_TYPES = ["single", "multiple", "true_false", "short_text"] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]
export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** Médium otázky alebo odpovede (D120) — obrázok alebo video, dokument nie. */
export type QuestionMedia =
  | { kind: "image"; fileId: string; alt: string }
  | { kind: "video"; source: VideoSource; durationSec?: number }

export interface Answer {
  id: string
  text?: string
  /** Najviac jedno médium na odpoveď (D120). */
  media?: QuestionMedia
  correct: boolean
}

export interface Question {
  companyCode: string
  key: string
  type: QuestionType
  text?: string
  media: QuestionMedia[]
  /** `single`, `multiple`. */
  answers: Answer[]
  /** `true_false`: správna je pravda? */
  correctTrue?: boolean
  /** `short_text`: očakávaná odpoveď a alternatívy (prvá je hlavná). */
  expected?: string[]
  explanation?: string
  weight: number
  difficulty: Difficulty
  smartTags: SmartTag[]
  status: "active" | "retired"
  version: number
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

export type QuestionProblem =
  | "question.contentRequired"
  | "question.tooFewAnswers"
  | "question.tooManyAnswers"
  | "question.singleOneCorrect"
  | "question.multipleTwoCorrect"
  | "question.answerEmpty"
  | "question.altRequired"
  | "question.expectedRequired"
  | "question.tagRequired"
  | "question.weight"
  | "question.trueFalseMissing"

/** Najviac odpovedí (CSV `answer_1` … `answer_8`). */
export const MAX_ANSWERS = 8

function mediaOk(m: QuestionMedia | undefined): boolean {
  return !m || m.kind !== "image" || Boolean(m.alt.trim())
}

/** Čo bráni uložiť otázku. Prázdne pole = v poriadku. */
export function questionProblems(q: Pick<Question, "type" | "text" | "media" | "answers" | "correctTrue" | "expected" | "weight" | "smartTags">): QuestionProblem[] {
  const out: QuestionProblem[] = []
  if (!q.text?.trim() && q.media.length === 0) out.push("question.contentRequired")
  if (!q.media.every(mediaOk)) out.push("question.altRequired")
  if (q.type === "single" || q.type === "multiple") {
    const min = q.type === "single" ? 2 : 3
    if (q.answers.length < min) out.push("question.tooFewAnswers")
    if (q.answers.length > MAX_ANSWERS) out.push("question.tooManyAnswers")
    if (q.answers.some(a => !a.text?.trim() && !a.media)) out.push("question.answerEmpty")
    if (!q.answers.every(a => mediaOk(a.media)) && !out.includes("question.altRequired")) out.push("question.altRequired")
    const correct = q.answers.filter(a => a.correct).length
    if (q.type === "single" && correct !== 1) out.push("question.singleOneCorrect")
    if (q.type === "multiple" && correct < 2) out.push("question.multipleTwoCorrect")
  }
  if (q.type === "true_false" && typeof q.correctTrue !== "boolean") out.push("question.trueFalseMissing")
  if (q.type === "short_text" && !q.expected?.[0]?.trim()) out.push("question.expectedRequired")
  // Bez tagu otázku žiadny test nevylosuje (rám TESTS).
  if (q.smartTags.length === 0) out.push("question.tagRequired")
  if (!Number.isInteger(q.weight) || q.weight < 1) out.push("question.weight")
  return out
}

/**
 * Krátky text: porovnanie bez diakritiky, veľkosti písmen a nadbytočných
 * medzier (rám TESTS: „Na diakritike a veľkých písmenách nezáleží").
 */
export function normalizeShortText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()
}

export function shortTextMatches(answer: string, expected: string[]): boolean {
  const a = normalizeShortText(answer)
  return Boolean(a) && expected.some(e => normalizeShortText(e) === a)
}

/** Kľúč otázky: z `id` v CSV, inak náhodný (otázka nemá názov). */
export function questionKeyFrom(id: string | undefined): string {
  const k = slugifyKey(id ?? "")
  // `new` a `import` sú kroky banky (`/learning/tests/questions/new`, R3) —
  // otázka s takým ID z CSV dostane predponu, stále rovnakú pre opakovaný import.
  if (RESERVED_QUESTION_KEYS.includes(k)) return `q_${k}`
  return k || `q_${crypto.randomUUID().slice(0, 8)}`
}

/* ── CSV (TESTS Q1 ✅) ───────────────────────────────────────────────────── */

/**
 * CSV podľa RFC 4180: úvodzovky, zdvojené úvodzovky a **nový riadok vo
 * vnútri bunky** (odsek v znení otázky). `parseCsv` z `csv.ts` delí po
 * riadkoch, čo by takú bunku rozsekalo.
 */
export function parseCsvRecords(text: string): { headers: string[]; rows: { line: number; cells: Record<string, string> }[] } {
  const src = text.replace(/^﻿/, "")
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ""
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ","
  const records: { line: number; cells: string[] }[] = []
  let cell = "", row: string[] = [], quoted = false, line = 1, rowLine = 1
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else { if (c === "\n") line++; cell += c }
      continue
    }
    if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(cell); cell = ""
      if (row.some(x => x.trim() !== "")) records.push({ line: rowLine, cells: row })
      row = []
      line++
      rowLine = line
    } else cell += c
  }
  row.push(cell)
  if (row.some(x => x.trim() !== "")) records.push({ line: rowLine, cells: row })
  const headers = (records.shift()?.cells ?? []).map(h => h.trim().toLowerCase())
  return {
    headers,
    rows: records.map(r => ({ line: r.line, cells: Object.fromEntries(headers.map((h, i) => [h, (r.cells[i] ?? "").trim()])) })),
  }
}

export interface CsvRowError { line: number; column: string; code: string; value?: string }

export interface ImportedQuestion {
  line: number
  /** `id` z CSV — existujúca otázka sa upraví. */
  id?: string
  question: Omit<Question, "companyCode" | "key" | "status" | "version" | "createdAt" | "createdBy">
}

export interface CsvImport {
  questions: ImportedQuestion[]
  errors: CsvRowError[]
  /** Tagy z importu (identita), na výpis „Nové smart:tagy" — porovná volajúci s bankou. */
  tags: SmartTag[]
}

/**
 * CSV → otázky. Pri akejkoľvek chybe volajúci **neimportuje nič** (rám:
 * „Pri chybe sa neimportuje nič — opraviť súbor a nahrať znova").
 */
export function importQuestionsCsv(text: string): CsvImport {
  const { rows } = parseCsvRecords(text)
  const errors: CsvRowError[] = []
  const questions: ImportedQuestion[] = []
  const ids = new Set<string>()
  const allTags = new Map<string, SmartTag>()
  for (const { line, cells } of rows) {
    const err = (column: string, code: string, value?: string) => errors.push({ line, column, code, value })
    const type = cells.type as QuestionType
    if (!(QUESTION_TYPES as readonly string[]).includes(type)) { err("type", "csv.type", cells.type); continue }
    const id = cells.id || undefined
    if (id) {
      if (ids.has(id)) err("id", "csv.duplicateId", id)
      ids.add(id)
    }
    if (!cells.text) err("text", "csv.textRequired")
    const { tags, invalid } = normalizeSmartTags((cells.tags ?? "").split("|").map(s => s.trim()).filter(Boolean))
    if (!tags.length) err("tags", "csv.tagsRequired")
    if (invalid.length) err("tags", "csv.tagShape", invalid[0])
    for (const t of tags) allTags.set(tagId(t), t)
    const texts: string[] = []
    for (let n = 1; n <= MAX_ANSWERS; n++) if (cells[`answer_${n}`]) texts[n - 1] = cells[`answer_${n}`]
    const filled = texts.filter(Boolean).length
    const weight = cells.weight ? Number(cells.weight) : 1
    if (!Number.isInteger(weight) || weight < 1) err("weight", "csv.weight", cells.weight)
    const difficulty = (cells.difficulty || "medium") as Difficulty
    if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) err("difficulty", "csv.difficulty", cells.difficulty)
    const base = {
      type, text: cells.text, media: [] as QuestionMedia[], answers: [] as Answer[],
      explanation: cells.explanation || undefined, weight, difficulty, smartTags: tags,
    }
    if (type === "single" || type === "multiple") {
      const nums = (cells.correct ?? "").split(",").map(s => Number(s.trim())).filter(n => n > 0)
      if (type === "single" && (filled < 2 || nums.length !== 1)) err("correct", "csv.singleOne", cells.correct)
      if (type === "multiple" && (filled < 3 || nums.length < 2)) err("correct", "csv.multipleTwo", cells.correct)
      if (nums.some(n => !texts[n - 1])) err("correct", "csv.correctOutOfRange", cells.correct)
      base.answers = texts.flatMap((t, i): Answer[] => (t ? [{ id: `a${i + 1}`, text: t, correct: nums.includes(i + 1) }] : []))
      questions.push({ line, id, question: base })
    } else if (type === "true_false") {
      const c = (cells.correct ?? "").toLowerCase()
      if (c !== "true" && c !== "false") err("correct", "csv.trueFalse", cells.correct)
      questions.push({ line, id, question: { ...base, correctTrue: c === "true" } })
    } else {
      if (!texts[0]) err("answer_1", "csv.expectedRequired")
      questions.push({ line, id, question: { ...base, expected: texts.filter(Boolean) } })
    }
  }
  return { questions: errors.length ? [] : questions, errors, tags: [...allTags.values()] }
}

/** Export banky v tom istom formáte — dá sa upraviť a nahrať späť cez `id`. */
export function exportQuestionsCsv(questions: Question[]): string {
  const header = ["id", "type", "text", ...Array.from({ length: MAX_ANSWERS }, (_, i) => `answer_${i + 1}`), "correct", "explanation", "weight", "difficulty", "tags"]
  const esc = (v: string) => {
    let s = v ?? ""
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = questions.map(q => {
    const answers = q.type === "short_text" ? (q.expected ?? []) : q.answers.map(a => a.text ?? "")
    const correct = q.type === "true_false" ? String(q.correctTrue)
      : q.type === "short_text" ? ""
      : q.answers.map((a, i) => (a.correct ? i + 1 : 0)).filter(Boolean).join(",")
    const cells = [q.key, q.type, q.text ?? "", ...Array.from({ length: MAX_ANSWERS }, (_, i) => answers[i] ?? ""), correct,
      q.explanation ?? "", String(q.weight), q.difficulty, q.smartTags.map(t => t.label).join(" | ")]
    return cells.map(esc).join(";")
  })
  return "﻿" + [header.join(";"), ...lines].join("\r\n") + "\r\n"
}
