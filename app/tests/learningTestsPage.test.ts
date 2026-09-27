/**
 * learningTestsPage.test.ts — obrazovka Testy a banka otázok (rám TESTS):
 * stav testu vrátane „Nedostatok otázok", banka s filtrom, formulár podľa
 * typu, import CSV s chybami po riadkoch, editor testu so sekciami.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Question } from "../src/lib/questions"
import type { Test } from "../src/lib/tests"
import { parseSmartTag } from "../src/lib/smartTags"

const s = vi.hoisted(() => ({ tests: [] as unknown[], bank: [] as unknown[], csv: null as string | null, courses: [] as unknown[] }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
  useRouter: () => ({ refresh: () => {} }),
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", async () => { const { createElement: h } = await import("react"); return { default: ({ children }: { children: string }) => h("button", { type: "submit" }, children) } })
vi.mock("@/components/TabLink", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/CourseMediaUpload", () => ({ default: () => null }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/learning", () => ({
  learningAdminContext: async () => ({ state: "ready", isAdmin: true, person: { id: "p", companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" }, tenant: { companyCode: "SFZ" } }),
}))
vi.mock("@/lib/testsDb", () => ({ listTests: async () => s.tests, getTest: async (_c: string, k: string) => (s.tests as Test[]).find(t => t.key === k) ?? null }))
vi.mock("@/lib/questionsDb", () => ({ listQuestions: async () => s.bank, questionUsage: async () => ({ tests: 2, attempts: 41 }) }))
vi.mock("@/lib/smartTagsDb", () => ({ smartTagUsage: async () => [] }))
vi.mock("@/lib/questionImports", () => ({ loadImport: async () => (s.csv ? { name: "otazky.csv", csv: s.csv } : null) }))
vi.mock("@/lib/coursesDb", () => ({ listCourses: async () => s.courses }))
vi.mock("@/lib/people", () => ({ listPeople: async () => [{ id: "p1", fullName: "Marek Horák", email: "m@sfz.sk", status: "active" }] }))
vi.mock("../src/app/learning/tests/actions", () => Object.fromEntries(["createTestAction","previewImportAction","questionStatusAction","runImportAction","saveQuestionAction","saveTestAction","retireTestAction"].map(n => [n, async () => {}])))

const at = new Date("2026-10-01T00:00:00Z")
const T = (x: string) => parseSmartTag(x)!
const q = (key: string, tags: string[]): Question => ({
  companyCode: "SFZ", key, type: "single", text: `Otázka ${key}`, media: [], answers: [{ id: "a1", text: "x", correct: true }, { id: "a2", text: "y", correct: false }],
  weight: 1, difficulty: "medium", smartTags: tags.map(T), status: "active", version: 1, createdAt: at, createdBy: "jan",
})
const test = (key: string, over: Partial<Test> = {}): Test => ({
  companyCode: "SFZ", key, title: `Test ${key}`, responsible: [{ personId: "p1", fullName: "Marek Horák", email: "m@sfz.sk" }],
  sections: [{ key: "s1", filter: [T("Bezpečnosť: Požiar")], count: 2 }], rules: { passingPercent: 80, showAnswers: "after_submit" },
  smartTags: [], status: "ready", version: 1, versions: [], createdAt: at, createdBy: "jan", ...over,
})

async function renderList(query: Record<string, string>) {
  const { default: Page } = await import("../src/app/learning/tests/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}
async function renderEditor(key: string) {
  const { default: Page } = await import("../src/app/learning/tests/[testKey]/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ testKey: key }), searchParams: Promise.resolve({}) }))
}

beforeEach(() => {
  s.bank = [q("a", ["Bezpečnosť: Požiar"]), q("b", ["Bezpečnosť: Požiar"]), q("c", ["Bezpečnosť: Výťah"])]
  s.tests = [test("poziar"), test("vytah", { sections: [{ key: "s1", filter: [T("Bezpečnosť: Výťah")], count: 3 }] }), test("bez", { responsible: [], status: "draft" })]
  s.csv = null
  s.courses = []
})

describe("/learning/tests", () => {
  it("testy: pripravený, nedostatok otázok, bez osoby", async () => {
    const html = await renderList({})
    expect(html).toContain("Pripravený")
    expect(html).toContain("⚠ Nedostatok otázok")
    expect(html).toContain("nikto — nedá sa pripraviť")
    expect(html).toContain('title="Marek Horák">MH<')
  })

  it("banka: filter tagov a formulár viac správnych", async () => {
    const html = await renderList({ tab: "questions", tag: "bezpecnost:vytah" })
    expect(html).toContain("Otázka c")
    expect(html).not.toContain("Otázka a<")
    const form = await renderList({ tab: "questions", new: "1", type: "multiple" })
    expect(form).toContain("Táto otázka má viac správnych odpovedí")
    expect(form).toContain('type="checkbox" name="correct"')
    const edit = await renderList({ tab: "questions", q: "a" })
    expect(edit).toContain("Použitá v 2 testoch · 41 pokusov ju cituje snímkou")
  })

  it("import: chyby po riadkoch a nič sa neimportuje; bez chyby tlačidlo", async () => {
    s.csv = "type;text;answer_1;answer_2;correct;tags\nsingle;Q;A;B;1,2;K: V\n"
    const bad = await renderList({ tab: "questions", import: "x" })
    expect(bad).toContain("Pri chybe sa neimportuje nič")
    expect(bad).toContain("jedna správna potrebuje 2–8 odpovedí")
    s.csv = "type;text;answer_1;answer_2;correct;tags\nsingle;Q;A;B;1;Nová: Hodnota\n"
    const ok = await renderList({ tab: "questions", import: "x" })
    expect(ok).toContain("Importovať 1 otázku")
    expect(ok).toContain("Nové smart:tagy: Nová: Hodnota")
  })

  it("editor: sekcia s nedostatkom, osoby, použité v kurze", async () => {
    s.courses = [{ key: "bozp", title: "BOZP", versions: [{ version: 1, parts: [{ title: "Evakuácia", tests: [{ testKey: "vytah", required: true, testVersion: 1 }] }] }] }]
    const html = await renderEditor("vytah")
    expect(html).toContain("V banke vyhovuje len 1 otázka — chýba 2")
    expect(html).toContain('name="responsiblePersonId"')
    expect(html).toContain("BOZP · Evakuácia · povinný · verzia testu 1")
    expect(html).toContain('value="add"')
  })
})
