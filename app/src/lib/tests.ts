/**
 * Testy (ADR-018, D120, D121; rám TESTS-testy-a-banka) — typy a čisté
 * pravidlá.
 *
 * **Test je recept, nie zoznam otázok**: sekcie, každá = filter smart:tagov
 * + počet. Otázky sa losujú pri každom pokuse (`testAttempts.ts`).
 *
 * Zmena receptu (sekcie alebo pravidlá) zvýši `version` a starý recept
 * ostane v `versions[]` — kurz pri zverejnení zmrazí `testVersion` (D118),
 * takže zmena testu neprepíše, čo ľudia v kurze robia.
 *
 * Test **bez dosť otázok v banke nie je `ready`** — hovorí sa to pri
 * uložení, nie pri pokuse.
 */

import type { SmartTag } from "./smartTags"

export const TESTS_COLLECTION = "tests"

export const SHOW_ANSWERS = ["never", "after_submit", "after_pass", "after_last_attempt"] as const
export type ShowAnswers = (typeof SHOW_ANSWERS)[number]

export interface TestSection {
  key: string
  title?: string
  filter: SmartTag[]
  count: number
}

export interface TestRules {
  /** Hranica úspešnosti v percentách (0–100). */
  passingPercent: number
  /** Limit času; bez neho pokus ostáva otvorený do odovzdania. */
  timeLimitMinutes?: number
  /** Najviac pokusov; bez neho neobmedzene. */
  maxAttempts?: number
  /** Pauza medzi pokusmi v minútach. */
  pauseMinutes?: number
  showAnswers: ShowAnswers
}

export interface TestRecipe {
  version: number
  sections: TestSection[]
  rules: TestRules
  savedAt: Date
  savedBy: string
}

export interface Responsible { personId: string; fullName: string; email: string }

export interface Test {
  companyCode: string
  key: string
  title: string
  instructions?: string
  /** Zodpovedné osoby (1..n) — vidia výsledky a smú resetovať pokus (D121). */
  responsible: Responsible[]
  sections: TestSection[]
  rules: TestRules
  /** Na hľadanie; losovanie nemenia. */
  smartTags: SmartTag[]
  status: "draft" | "ready" | "retired"
  /** Aktuálna verzia receptu. */
  version: number
  /** Všetky verzie receptu vrátane aktuálnej — pokus aj kurz citujú číslo. */
  versions: TestRecipe[]
  createdAt: Date
  createdBy: string
  updatedAt?: Date
  updatedBy?: string
}

export const DEFAULT_RULES: TestRules = { passingPercent: 80, showAnswers: "after_submit" }

export type TestProblem =
  | { code: "test.noResponsible" }
  | { code: "test.noSections" }
  | { code: "test.sectionEmptyFilter"; sectionKey: string }
  | { code: "test.sectionShort"; sectionKey: string; have: number; need: number }
  | { code: "test.rules" }
  | { code: "test.noTitle" }

export function rulesValid(r: TestRules): boolean {
  const pos = (n: number | undefined) => n === undefined || (Number.isFinite(n) && n > 0)
  return Number.isFinite(r.passingPercent) && r.passingPercent >= 0 && r.passingPercent <= 100 &&
    pos(r.timeLimitMinutes) && pos(r.maxAttempts) && (r.pauseMinutes === undefined || r.pauseMinutes >= 0) &&
    (SHOW_ANSWERS as readonly string[]).includes(r.showAnswers)
}

/**
 * Čo bráni stavu `ready`. `available` = počet vyhovujúcich otázok na
 * sekciu (počíta volajúci nad bankou, `sectionAvailability`).
 */
export function testProblems(
  t: Pick<Test, "title" | "responsible" | "sections" | "rules">,
  available: ReadonlyMap<string, number>,
): TestProblem[] {
  const out: TestProblem[] = []
  if (!t.title.trim()) out.push({ code: "test.noTitle" })
  if (t.responsible.length === 0) out.push({ code: "test.noResponsible" })
  if (t.sections.length === 0) out.push({ code: "test.noSections" })
  for (const s of t.sections) {
    if (s.filter.length === 0) out.push({ code: "test.sectionEmptyFilter", sectionKey: s.key })
    const have = available.get(s.key) ?? 0
    if (have < s.count) out.push({ code: "test.sectionShort", sectionKey: s.key, have, need: s.count })
  }
  if (!rulesValid(t.rules)) out.push({ code: "test.rules" })
  return out
}

export function questionCount(t: Pick<Test, "sections">): number {
  return t.sections.reduce((n, s) => n + s.count, 0)
}

/** Zmenil sa recept? (sekcie alebo pravidlá — nie názov, osoby, tagy). */
export function recipeChanged(a: Pick<Test, "sections" | "rules">, b: Pick<Test, "sections" | "rules">): boolean {
  const norm = (x: Pick<Test, "sections" | "rules">) => JSON.stringify({
    s: x.sections.map(s => ({ c: s.count, f: s.filter.map(f => `${f.key}:${f.value}`).sort() })),
    r: x.rules,
  })
  return norm(a) !== norm(b)
}

/** Recept danej verzie (kurz ju zmrazil pri zverejnení). */
export function recipeOf(t: Pick<Test, "versions" | "version" | "sections" | "rules">, version?: number): TestRecipe | null {
  const v = version ?? t.version
  return t.versions.find(r => r.version === v) ?? null
}
