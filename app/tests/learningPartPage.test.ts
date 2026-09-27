/**
 * learningPartPage.test.ts — časť kurzu (rám PART-cast-kurzu) vykreslená
 * s podvrhnutými dátami: stavy pásu časti (video rozpozerané, pripravená,
 * označená bez testu, hotová), bloky obsahu, zamknutá a nezapísaný.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Course, CourseVersion, Part } from "../src/lib/courses"
import type { Enrollment } from "../src/lib/enrollments"
import type { ProgressFacts } from "../src/lib/learningProgress"

const db = vi.hoisted(() => ({ course: null as unknown, enrollment: null as unknown, facts: null as unknown, docs: new Map() }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
  useRouter: () => ({ refresh: () => {} }),
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/learning", () => ({
  learningContext: async () => ({ state: "ready", tenant: { companyCode: "SFZ" }, person: { id: "p", companyCode: "SFZ", language: "sk" }, isAdmin: false }),
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
vi.mock("@/lib/courseDocs", () => ({ courseDocInfo: async () => db.docs }))
vi.mock("../src/app/learning/actions", () => ({ completePartAction: async () => {}, enrolAction: async () => {} }))

const at = new Date("2026-09-17T00:00:00Z")
const parts: Part[] = [
  { key: "uvod", title: "Úvod", required: true, tests: [], blocks: [{ id: "t", type: "text", markdown: "Vitajte." }] },
  { key: "evakuacia", title: "Evakuácia budovy", required: true, estimatedMinutes: 20,
    tests: [{ testKey: "evak", required: true }, { testKey: "extra", required: false }],
    blocks: [
      { id: "t", type: "text", markdown: "Pri poplachu opustite budovu." },
      { id: "img", type: "image", fileId: "f1", alt: "Plán únikových ciest", caption: "Prízemie" },
      { id: "doc", type: "document", documentId: "sfz:bozp", versionId: "v1", title: "Smernica BOZP" },
      { id: "v", type: "video", source: { kind: "internal", assetId: "a1" }, mustWatch: true, durationSec: 720 },
      { id: "yt", type: "video", source: { kind: "external", provider: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk" }, mustWatch: false },
    ] },
  { key: "zaver", title: "Záver", required: true, tests: [], blocks: [{ id: "t", type: "text", markdown: "Koniec." }] },
]
const version: CourseVersion = {
  versionId: "v2", version: 2, state: "published", title: "Bezpečnosť v sídle SFZ", sequential: true, parts,
  issuesCertificate: false, createdAt: at, createdBy: "jan",
}
const course: Course = {
  companyCode: "SFZ", key: "bozp", title: "BOZP", topicKey: "bozp", topicLabel: "BOZP", smartTags: [], language: "sk",
  openEnrollment: false, versions: [version], createdAt: at, createdBy: "jan",
}
const enrollment: Enrollment = {
  id: "e1", companyCode: "SFZ", personId: "p", email: "p@sfz.sk", fullName: "P", courseKey: "bozp",
  versionId: "v2", courseTitle: "BOZP", enrolledAt: at, source: "self", cancelledAt: null,
}
const facts = (over: Partial<ProgressFacts> = {}): ProgressFacts => ({ completions: [{ partKey: "uvod", at }], watches: [], passedTests: [], ...over })
const watched = (to: number) => ({ partKey: "evakuacia", blockId: "v", watchedRanges: [[0, to]] as [number, number][], durationSec: 720, updatedAt: at })

async function render(partKey = "evakuacia") {
  const { default: Page } = await import("../src/app/learning/[courseKey]/[partKey]/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ courseKey: "bozp", partKey }), searchParams: Promise.resolve({}) }))
}

beforeEach(() => {
  db.course = course
  db.enrollment = enrollment
  db.facts = facts({ watches: [watched(450)] })
  db.docs = new Map([["doc", { label: "úplné znenie od 1. 3. 2026", effectiveFrom: new Date("2026-03-01T00:00:00Z"), newer: { label: "úplné znenie od 1. 9. 2026", effectiveFrom: null } }]])
})

describe("/learning/[courseKey]/[partKey]", () => {
  it("video rozpozerané: vypnuté označenie s percentom, bloky, ďalšia vypnutá", async () => {
    const html = await render()
    expect(html).toContain("Časť 2 z 3")
    expect(html).toContain('class="pnav-off" aria-disabled="true"')
    expect(html).toMatch(/<button type="button" class="button" disabled="" aria-disabled="true">Označiť ako prejdené<\/button>/)
    expect(html).toContain("pozreté 62 %, treba aspoň 90 %")
    expect(html).toContain("Povinné dopozeranie · pozreté 62 %")
    expect(html).toContain('src="/api/learning/media/a1"')
    expect(html).toContain('alt="Plán únikových ciest"')
    expect(html).toContain("/api/documents/sfz%3Abozp/pdf?version=v1")
    expect(html).toContain("Platné je už úplné znenie od 1. 9. 2026.")
    expect(html).toContain("https://www.youtube-nocookie.com/embed/abcdefghijk")
    expect(html).toContain("Externé video · dopozeranie sa neoveruje")
    expect(html).toContain("Povinný test: nespustený")
    expect(html).toContain("Test evak")
    expect(html).toContain('href="/learning/bozp/evakuacia/test/evak"')
  })

  it("dopozerané: tlačidlo je formulár, test pred prejdením nebráni (PART Q1)", async () => {
    db.facts = facts({ watches: [watched(700)] })
    const html = await render()
    expect(html).toContain('name="partKey" value="evakuacia"')
    expect(html).toContain("Po označení je časť hotová.")
    expect(html).toContain("✓</span> Dopozerané")
  })

  it("označená bez povinného testu a hotová s nepovinným testom", async () => {
    db.facts = facts({ completions: [{ partKey: "uvod", at }, { partKey: "evakuacia", at }], watches: [watched(700)] })
    expect(await render()).toContain("Označené 17. 9. 2026 · časť bude hotová po prejdení povinného testu.")
    db.facts = facts({
      completions: [{ partKey: "uvod", at }, { partKey: "evakuacia", at }], watches: [watched(700)],
      passedTests: [{ partKey: "evakuacia", testKey: "evak", at }],
    })
    ;(globalThis as { __passed?: string[] }).__passed = ["evak"]
    const html = await render()
    expect(html).toContain("Časť je hotová · 17. 9. 2026")
    expect(html).toContain("Nepovinný test môžete spraviť kedykoľvek.")
    expect(html).toContain('href="/learning/bozp/zaver"')
    expect(html).toContain("prešiel 90 %")
    ;(globalThis as { __passed?: string[] }).__passed = []
  })

  it("zamknutá časť a nezapísaný vracajú na prehľad kurzu", async () => {
    await expect(render("zaver")).rejects.toThrow("redirect /learning/bozp")
    db.enrollment = null
    await expect(render()).rejects.toThrow("redirect /learning/bozp")
  })
})
