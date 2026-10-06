/**
 * learningManagePage.test.ts — správa kurzov (rám MANAGE-sprava-kurzov):
 * stav s dvomi pilulkami, filter stavu, nový kurz, témy s vyradením,
 * smart:tagy s premenovaním na existujúci (zlúčenie) a krokom zlúčenia.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Course, CourseVersion } from "../src/lib/courses"
import { parseSmartTag } from "../src/lib/smartTags"

const s = vi.hoisted(() => ({ courses: [] as unknown[], usage: [] as unknown[], impact: { courses: 4, questions: 17, tests: 2 } }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
  useRouter: () => ({ refresh: () => {} }),
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", async () => { const { createElement: h } = await import("react"); return { default: ({ children, form, className }: { children: string; form?: string; className?: string }) => h("button", { type: "submit", form, className }, children) } })
vi.mock("@/components/TabLink", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/learning", () => ({
  learningAdminContext: async () => ({
    state: "ready", isAdmin: true, person: { id: "p", companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" },
    tenant: { companyCode: "SFZ", learningTopics: [
      { key: "bozp", label: "Bezpečnosť a ochrana zdravia" },
      { key: "stare", label: "Staré témy", retiredAt: new Date() },
    ] },
  }),
}))
vi.mock("@/lib/coursesDb", () => ({ listCourses: async () => s.courses }))
vi.mock("@/lib/learningStats", () => ({ courseStats: async () => new Map([["bozp", { enrolled: 48, completed: 31 }]]) }))
vi.mock("@/lib/smartTagsDb", () => ({ smartTagUsage: async () => s.usage, smartTagImpact: async () => s.impact }))
vi.mock("../src/app/learning/manage/actions", () => Object.fromEntries(["addTopicAction","createCourseAction","mergeTagsAction","renameKeyAction","renameTagAction","renameTopicAction","restoreTopicAction","retireTopicAction"].map(n => [n, async () => {}])))

const at = new Date("2026-09-20T00:00:00Z")
const v = (n: number, state: CourseVersion["state"]): CourseVersion => ({ versionId: `v${n}`, version: n, state, title: "BOZP", sequential: false, parts: [], issuesCertificate: false, createdAt: at, createdBy: "jan" })
const course = (key: string, versions: CourseVersion[]): Course => ({
  companyCode: "SFZ", key, title: `Kurz ${key}`, topicKey: "bozp", topicLabel: "Bezpečnosť a ochrana zdravia",
  smartTags: [], language: "sk", openEnrollment: true, versions, createdAt: at, createdBy: "jan",
})
const usage = (label: string, c: number, q: number, t: number) => ({ ...parseSmartTag(label)!, courses: c, questions: q, tests: t })

async function render(query: Record<string, string | string[]>) {
  const { default: Page } = await import("../src/app/learning/manage/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  s.courses = [course("bozp", [v(2, "published"), v(3, "draft")]), course("novy", [v(1, "draft")]), course("stary", [v(1, "archived")])]
  s.usage = [usage("Bezpečnosť: Výťah", 2, 12, 1), usage("Bezpečnosť: Lift", 1, 3, 0), usage("Úroveň: 1", 3, 0, 0)]
})

describe("/learning/manage", () => {
  it("kurzy: dve pilulky, počty, filter stavu", async () => {
    const html = await render({})
    expect(html).toContain("Zverejnený · v2")
    expect(html).toContain("Koncept · v3")
    expect(html).toContain("Archív · v1")
    expect(html).toContain("48 zapísaných · 31 dokončilo")
    expect(html).toContain("otvorený na zápis")
    const drafts = await render({ status: "draft" })
    expect(drafts).toContain("Kurz novy")
    expect(drafts).not.toContain("Kurz stary")
  })

  it("nový kurz: len aktívne témy", async () => {
    const html = await render({ new: "1" })
    expect(html).toContain("Vytvoriť koncept")
    expect(html).toContain("Bezpečnosť a ochrana zdravia")
    expect(html).not.toContain(">Staré témy<")
    // Pri otvorenom formulári je plné len „Vytvoriť" — hlavička „Nový kurz"
    // nekreslí (DESIGN_ODCHYLKY P10).
    expect(html).not.toContain('href="/learning/manage?tab=courses&amp;new=1"')
    expect(await render({})).toContain('<div class="page-head"><h1 class="page-title">')
  })

  it("témy: vyradená má Vrátiť a počet kurzov", async () => {
    const html = await render({ tab: "topics" })
    expect(html).toContain("vyradená")
    expect(html).toContain("Vrátiť")
    expect(html).toContain("3 kurzy")
  })

  it("smart:tagy: premenovanie na existujúci ukáže zlúčenie", async () => {
    const html = await render({ tab: "tags", rename: "bezpecnost:lift", to: "Bezpečnosť: Výťah", exists: "1" })
    expect(html).toContain("už existuje — zlúčia sa")
    expect(html).toContain("Zmení sa všade — na 23 miestach (4 kurzy, 17 otázok, 2 testy)")
    expect(html).toMatch(/form="rename-tag" class="button">Zlúčiť</)
  })

  it("smart:tagy: krok zlúčenia s predvolenou najpoužívanejšou a chyba pri jednom", async () => {
    const html = await render({ tab: "tags", sel: ["bezpecnost:vytah", "bezpecnost:lift"] })
    expect(html).toContain("Zlúčiť 2 smart:tagy do jedného")
    expect(html).toContain('<input type="radio" name="target" checked="" value="bezpecnost:vytah"/>')
    expect(html).toContain("zostane „Bezpečnosť: Výťah“")
    expect(await render({ tab: "tags", sel: "bezpecnost:lift" })).toContain("Na zlúčenie treba aspoň dva smart:tagy.")
  })
})
