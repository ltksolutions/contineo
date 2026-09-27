/**
 * learningMyCourses.test.ts — obrazovka /learning (rám LEARNING-moje-kurzy)
 * vykreslená s podvrhnutými kurzami: tri skupiny, karta v každom stave,
 * filter smart:tagov, „Nič nečaká" a prázdny výsledok filtra.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Course, CourseVersion, Part } from "../src/lib/courses"
import type { Enrollment } from "../src/lib/enrollments"
import type { ProgressFacts } from "../src/lib/learningProgress"
import { parseSmartTag } from "../src/lib/smartTags"

const db = vi.hoisted(() => ({ courses: [] as unknown[], enrollments: [] as unknown[], facts: new Map<string, unknown>() }))

vi.mock("@/lib/certificatesDb", () => ({ ensureCertificate: async () => null, certificatesForPerson: async () => [], certificatesForCourse: async () => [], certificateForEnrollment: async () => null }))
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/learning", () => ({
  learningContext: async () => ({ state: "ready", tenant: { companyCode: "SFZ" }, person: { id: "p", companyCode: "SFZ", language: "sk" }, isAdmin: false }),
}))
vi.mock("@/lib/coursesDb", () => ({ listCourses: async () => db.courses }))
vi.mock("@/lib/enrollmentsDb", () => ({ enrollmentsForPerson: async () => db.enrollments }))
vi.mock("@/lib/learningProgressDb", () => ({ progressFactsMany: async () => db.facts }))
vi.mock("../src/app/learning/actions", () => ({ enrolAction: async () => {} }))

const at = new Date("2026-09-22T00:00:00Z")
const part = (key: string, title: string, required = true): Part => ({ key, title, required, tests: [], blocks: [{ id: "t", type: "text", markdown: "x" }], estimatedMinutes: 10 })
const version = (key: string, over: Partial<CourseVersion> = {}): CourseVersion => ({
  versionId: `${key}-v1`, version: 1, state: "published", title: `Kurz ${key}`, sequential: false,
  parts: [part("uvod", "Úvod"), part("evakuacia", "Evakuácia budovy"), part("extra", "Navyše", false)],
  issuesCertificate: false, createdAt: at, createdBy: "jan", ...over,
})
const course = (key: string, over: Partial<Course> = {}): Course => ({
  companyCode: "SFZ", key, title: key, topicKey: "bozp", topicLabel: "Bezpečnosť a ochrana zdravia",
  smartTags: [parseSmartTag("Bezpečnosť: Výťah")!], language: "sk", openEnrollment: false,
  versions: [version(key)], createdAt: at, createdBy: "jan", ...over,
})
const enr = (key: string, over: Partial<Enrollment> = {}): Enrollment => ({
  id: `e-${key}`, companyCode: "SFZ", personId: "p", email: "p@sfz.sk", fullName: "P", courseKey: key,
  versionId: `${key}-v1`, courseTitle: key, enrolledAt: at, source: "assignment",
  assignedBy: { email: "hr@sfz.sk", fullName: "Oddelenie ľudských zdrojov" }, ...over,
})
const facts = (over: Partial<ProgressFacts>): ProgressFacts => ({ completions: [], watches: [], passedTests: [], ...over })

async function render(query: Record<string, string | string[]> = {}) {
  const { default: Page } = await import("../src/app/learning/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  db.courses = [
    course("rozpracovany"),
    course("prideleny", { topicKey: "interne", topicLabel: "Interné poriadky", smartTags: [parseSmartTag("Oblasť: Ekonomika")!] }),
    course("otvoreny", { openEnrollment: true, versions: [version("otvoreny", { issuesCertificate: true, estimatedMinutes: 150 })] }),
    course("hotovy"),
  ]
  db.enrollments = [enr("rozpracovany"), enr("prideleny"), enr("hotovy")]
  db.facts = new Map([
    ["e-rozpracovany", facts({ completions: [{ partKey: "uvod", at }] })],
    ["e-hotovy", facts({ completions: [{ partKey: "uvod", at }, { partKey: "evakuacia", at: new Date("2026-09-25T00:00:00Z") }] })],
  ])
})

describe("/learning — moje kurzy", () => {
  it("tri skupiny v poradí a karta v každom stave", async () => {
    const html = await render()
    const i = (s: string) => html.indexOf(s)
    expect(i("Rozpracované")).toBeLessThan(i("Na zápis"))
    expect(i("Na zápis")).toBeLessThan(i("Dokončené"))
    expect(html).toContain("1 z 2 povinných častí")
    expect(html).toContain("Ďalej: Časť 2 · Evakuácia budovy")
    expect(html).toContain('href="/learning/rozpracovany/evakuacia"')
    expect(html).toContain("Pridelené 22. 9. 2026 · Oddelenie ľudských zdrojov")
    expect(html).toContain("Zapísať sa")
    expect(html).toContain("približne 2 hodiny 30 minút")
    expect(html).toContain("3 časti, z toho 2 povinné")
    expect(html).toContain("Dokončené 25. 9. 2026")
    expect(html).toContain("Kurz nevydáva certifikát.")
  })

  it("filter smart:tagu: zvolený tag, pilulka so zrušením, len vyhovujúce kurzy", async () => {
    const html = await render({ tag: "oblast:ekonomika" })
    expect(html).toContain("Kurz prideleny")
    expect(html).not.toContain("Kurz rozpracovany")
    expect(html).toContain("Zrušiť filtre")
    expect(html).toMatch(/class="stag is-on"/)
  })

  it("filtru nič nevyhovuje: veta s menami a zrušenie", async () => {
    const html = await render({ tag: "uroven:9" })
    expect(html).toContain("nevyhovuje žiadny kurz")
  })

  it("len dokončené: „Nič nečaká“ nad skupinou", async () => {
    db.courses = [course("hotovy")]
    db.enrollments = [enr("hotovy")]
    const html = await render()
    expect(html).toContain("Nič nečaká")
    expect(html).not.toContain("Na zápis")
  })

  it("nič pridelené ani otvorené: prázdny stav bez filtra", async () => {
    db.courses = []
    db.enrollments = []
    const html = await render()
    expect(html).toContain("Zatiaľ tu nemáte žiadny kurz")
    expect(html).not.toContain('class="lf"')
  })
})
