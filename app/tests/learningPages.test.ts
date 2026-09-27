/**
 * learningPages.test.ts — kostra `/learning*` (L0, ADR-018) vykreslená bez
 * databázy: prázdny stav pri zapnutom module, 404 pri vypnutom alebo bez roly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const s = vi.hoisted(() => ({ ctx: null as unknown }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/coursesDb", () => ({ listCourses: async () => [] }))
vi.mock("@/lib/testsDb", () => ({ listTests: async () => [] }))
vi.mock("@/lib/questionsDb", () => ({ listQuestions: async () => [], questionUsage: async () => ({ tests: 0, attempts: 0 }) }))
vi.mock("../src/app/learning/tests/actions", () => Object.fromEntries(["createTestAction","previewImportAction","questionStatusAction","runImportAction","saveQuestionAction"].map(n => [n, async () => {}])))
vi.mock("@/lib/learningStats", () => ({ courseStats: async () => new Map() }))
vi.mock("@/lib/smartTagsDb", () => ({ smartTagUsage: async () => [], smartTagImpact: async () => ({ courses: 0, questions: 0, tests: 0 }) }))
vi.mock("../src/app/learning/manage/actions", () => Object.fromEntries(["addTopicAction","createCourseAction","mergeTagsAction","renameKeyAction","renameTagAction","renameTopicAction","restoreTopicAction","retireTopicAction"].map(n => [n, async () => {}])))
vi.mock("@/lib/enrollmentsDb", () => ({ enrollmentsForPerson: async () => [] }))
vi.mock("@/lib/learningProgressDb", () => ({ progressFactsMany: async () => new Map() }))
vi.mock("../src/app/learning/actions", () => ({ enrolAction: async () => {} }))
vi.mock("@/lib/learning", () => ({
  learningContext: async () => s.ctx,
  learningAdminContext: async () => s.ctx,
}))

const ready = { state: "ready", tenant: { companyCode: "SFZ", learningTopics: [] }, person: { id: "p", companyCode: "SFZ", language: "sk" }, isAdmin: true }
const pages = {
  "/learning": () => import("../src/app/learning/page"),
  "/learning/manage": () => import("../src/app/learning/manage/page"),
  "/learning/tests": () => import("../src/app/learning/tests/page"),
}

async function render(path: keyof typeof pages) {
  const { default: Page } = await pages[path]()
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
}

beforeEach(() => { s.ctx = ready })

describe("/learning*", () => {
  it("zapnutý modul: nadpis a prázdny stav", async () => {
    expect(await render("/learning")).toContain("Zatiaľ tu nemáte žiadny kurz")
    expect(await render("/learning/manage")).toContain("Zatiaľ tu nie je žiadny kurz.")
    expect(await render("/learning/tests")).toContain("Zatiaľ tu nie je žiadny test.")
  })

  it("vypnutý modul alebo bez roly je 404, neprihlásený ide na prihlásenie", async () => {
    for (const path of Object.keys(pages) as (keyof typeof pages)[]) {
      s.ctx = { state: "disabled" }
      await expect(render(path)).rejects.toThrow("notFound")
      s.ctx = { state: "forbidden" }
      await expect(render(path)).rejects.toThrow("notFound")
      s.ctx = { state: "not-signed-in" }
      await expect(render(path)).rejects.toThrow("redirect /sign-in")
    }
  })
})
