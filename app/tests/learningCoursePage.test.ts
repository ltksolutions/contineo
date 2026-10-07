/**
 * learningCoursePage.test.ts — prehľad kurzu (rám COURSE-prehlad-kurzu)
 * vykreslený s podvrhnutými dátami: rozpracovaný so zamknutou časťou,
 * nezapísaný bez odkazov (COURSE Q1), nová verzia, archív, dokončený, 404.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Course, CourseVersion, Part } from "../src/lib/courses"
import type { Enrollment } from "../src/lib/enrollments"
import type { ProgressFacts } from "../src/lib/learningProgress"

const db = vi.hoisted(() => ({ course: null as unknown, enrollment: null as unknown, facts: null as unknown, isAdmin: false }))

vi.mock("@/lib/certificatesDb", () => ({ ensureCertificate: async () => null, certificatesForPerson: async () => [], certificatesForCourse: async () => [], certificateForEnrollment: async () => null }))
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/learning", () => ({
  learningContext: async () => ({ state: "ready", tenant: { companyCode: "SFZ" }, person: { id: "p", companyCode: "SFZ", language: "sk" }, isAdmin: db.isAdmin }),
}))
vi.mock("@/lib/coursesDb", () => ({ getCourse: async () => db.course }))
vi.mock("@/lib/enrollmentsDb", () => ({ enrollmentFor: async () => db.enrollment }))
vi.mock("@/lib/testAttemptsDb", () => ({
  partTestRows: async (_e: unknown, part: { tests: { testKey: string; required: boolean }[] }) => part.tests.map(t => ({
    testKey: t.testKey, required: t.required, test: { title: `Test ${t.testKey}`, responsible: [] }, rules: { maxAttempts: 3 }, questionCount: 10, attempts: [],
    availability: { open: null, canStart: true, reason: null, nextAt: null, used: 0, remaining: 3, lastPassed: (globalThis as { __passed?: string[] }).__passed?.includes(t.testKey) ?? false },
    last: (globalThis as { __passed?: string[] }).__passed?.includes(t.testKey) ? { id: "a1", percent: 90, passed: true } : null,
  })),
}))
vi.mock("@/lib/learningProgressDb", () => ({ progressFacts: async () => db.facts }))
vi.mock("../src/app/learning/actions", () => ({ enrolAction: async () => {} }))

const at = new Date("2026-09-12T00:00:00Z")
const parts: Part[] = [
  { key: "uvod", title: "Úvod", required: true, tests: [], blocks: [{ id: "t", type: "text", markdown: "x" }] },
  { key: "evakuacia", title: "Evakuácia budovy", required: true, tests: [{ testKey: "evakuacia-test", required: true }], blocks: [
    { id: "t", type: "text", markdown: "x" },
    { id: "v", type: "video", source: { kind: "internal", assetId: "a" }, mustWatch: true, durationSec: 720 },
  ] },
  { key: "prva-pomoc", title: "Prvá pomoc", required: false, tests: [], blocks: [
    { id: "g", type: "gallery", items: [] }, { id: "x", type: "video", source: { kind: "external", provider: "youtube", url: "https://y" }, mustWatch: false },
  ] },
  { key: "zaver", title: "Záver", required: true, tests: [], blocks: [{ id: "t", type: "text", markdown: "x" }] },
]
const version = (over: Partial<CourseVersion> = {}): CourseVersion => ({
  versionId: "v2", version: 2, state: "published", title: "Bezpečnosť pri práci v sídle SFZ", subtitle: "Pre všetkých v sídle",
  description: "Kurz prejde pravidlá bezpečnosti.", estimatedMinutes: 40, sequential: true, parts, issuesCertificate: true,
  createdAt: at, createdBy: "jan", publishedAt: at, ...over,
})
const course = (over: Partial<Course> = {}): Course => ({
  companyCode: "SFZ", key: "bozp", title: "BOZP", topicKey: "bozp", topicLabel: "Bezpečnosť a ochrana zdravia",
  smartTags: [], language: "sk", openEnrollment: false, versions: [version()], createdAt: at, createdBy: "jan", ...over,
})
const enrollment: Enrollment = {
  id: "e1", companyCode: "SFZ", personId: "p", email: "p@sfz.sk", fullName: "P", courseKey: "bozp",
  versionId: "v2", courseTitle: "BOZP", enrolledAt: at, source: "assignment", cancelledAt: null,
}
const facts = (over: Partial<ProgressFacts> = {}): ProgressFacts => ({ completions: [], watches: [], passedTests: [], ...over })

async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/learning/[courseKey]/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ courseKey: "bozp" }), searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  db.isAdmin = false
  db.course = course()
  db.enrollment = enrollment
  db.facts = facts({
    completions: [{ partKey: "uvod", at }],
    watches: [{ partKey: "evakuacia", blockId: "v", watchedRanges: [[0, 450]], durationSec: 720, updatedAt: at }],
  })
})

describe("/learning/[courseKey]", () => {
  it("rozpracovaný: postup, pokračovať tu, video %, zamknutá časť a test", async () => {
    const html = await render()
    expect(html).toContain("1 z 3")
    expect(html).toContain("Pokračovať tu")
    expect(html).toContain('class="pr is-next"')
    expect(html).toContain("rozpracovaná — video pozreté 62 %")
    expect(html).toContain("povinné video 12 minút")
    expect(html).toContain("galéria, video externé")
    expect(html).toContain("Hotová 12. 9. 2026")
    expect(html).toContain("Sprístupní sa po časti 2")
    expect(html).not.toContain('href="/learning/bozp/zaver"')
    expect(html).toContain("Test evakuacia-test")
    expect(html).toContain("nespustený")
    expect(html).toContain("12. 9. 2026 · pridelením")
    expect(html).toContain("postupne")
  })

  it("nezapísaný na otvorenom kurze: časti bez odkazov a Zapísať sa (COURSE Q1)", async () => {
    db.course = course({ openEnrollment: true })
    db.enrollment = null
    const html = await render()
    expect(html).toContain("Zapísať sa")
    expect(html).toContain("1. Úvod")
    expect(html).not.toMatch(/href="\/learning\/bozp\/[a-z]/)
    expect(html).not.toContain("nespustený")
  })

  it("nezapísaný na zatvorenom kurze = 404", async () => {
    db.enrollment = null
    await expect(render()).rejects.toThrow("notFound")
  })

  it("nová verzia a archív: informačné hlášky", async () => {
    db.course = course({ versions: [version({ state: "archived" }), version({ versionId: "v3", version: 3, publishedAt: new Date("2026-09-20T00:00:00Z") })] })
    expect(await render()).toContain("Kurz má novú verziu 3 (zverejnená 20. 9. 2026). Dokončujete verziu 2")
    db.course = course({ versions: [version({ state: "archived" })] })
    expect(await render()).toContain("Kurz bol archivovaný — dokončiť ho môžete.")
  })

  it("dokončený: hláška s dátumom", async () => {
    db.facts = facts({
      completions: [{ partKey: "uvod", at }, { partKey: "evakuacia", at }, { partKey: "zaver", at: new Date("2026-09-18T00:00:00Z") }],
      watches: [{ partKey: "evakuacia", blockId: "v", watchedRanges: [[0, 720]], durationSec: 720, updatedAt: at }],
      passedTests: [{ partKey: "evakuacia", testKey: "evakuacia-test", at }],
    })
    ;(globalThis as { __passed?: string[] }).__passed = ["evakuacia-test"]
    const done = await render()
    ;(globalThis as { __passed?: string[] }).__passed = []
    expect(done).toContain("Kurz ste dokončili 18. 9. 2026.")
    expect(done).toContain("prešiel 90 %")
  })

  it("náhľad ako študent (MANAGE-COURSE-akcie Q2): koncept, bez zápisu, nič nezamknuté", async () => {
    db.isAdmin = true
    db.enrollment = null
    db.course = course({ versions: [version(), version({ versionId: "v3", version: 3, state: "draft", publishedAt: undefined, title: "Koncept v3" })] })
    const html = await render({ preview: "3" })
    expect(html).toContain("Náhľad verzie 3 tak, ako ju uvidí študent.")
    expect(html).toContain("Koncept v3")
    expect(html).toContain('href="/learning/bozp/zaver?preview=3"')
    expect(html).not.toContain("Zapísať sa")
    // Študent bez roly náhľad nedostane — zatvorený kurz ostáva 404.
    db.isAdmin = false
    await expect(render({ preview: "3" })).rejects.toThrow("notFound")
  })
})
