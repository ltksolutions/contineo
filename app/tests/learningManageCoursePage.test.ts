/**
 * learningManageCoursePage.test.ts — úprava kurzu (rám MANAGE-COURSE):
 * karta stavu v štyroch stavoch, zoznam častí so šípkami, detail časti
 * s blokmi a formulárom „Pridať blok", len čítanie pri zverejnenom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Course, CourseVersion, Part } from "../src/lib/courses"

const s = vi.hoisted(() => ({ course: null as unknown }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
  useRouter: () => ({ refresh: () => {} }),
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", async () => { const { createElement: h } = await import("react"); return { default: ({ children }: { children: string }) => h("button", { type: "submit" }, children) } })
vi.mock("@/components/TabLink", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/CourseMediaUpload", async () => { const { createElement: h } = await import("react"); return { default: ({ kind }: { kind: string }) => h("div", { "data-media": kind }) } })
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/learning", () => ({
  learningAdminContext: async () => ({ state: "ready", isAdmin: true, person: { id: "p", companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" }, tenant: { companyCode: "SFZ" } }),
}))
vi.mock("@/lib/coursesDb", () => ({ getCourse: async () => s.course }))
vi.mock("@/lib/learningStats", () => ({ courseStats: async () => new Map([["bozp", { enrolled: 5, completed: 2 }]]) }))
vi.mock("@/lib/courseDocs", () => ({ documentChoices: async () => [{ documentId: "sfz:bozp", versionId: "v1", title: "Smernica BOZP", label: "úplné znenie od 1. 3. 2026" }] }))
vi.mock("../src/app/learning/manage/[courseKey]/actions", () => Object.fromEntries(
  ["addBlockAction","addPartAction","archiveAction","moveBlockAction","movePartAction","newVersionAction","publishAction","removeBlockAction","removePartAction","updateBlockAction","updatePartAction"].map(n => [n, async () => {}])))

const at = new Date("2026-09-20T00:00:00Z")
const part = (key: string, blocks: Part["blocks"] = [{ id: "t", type: "text", markdown: "Vitajte v kurze." }]): Part => ({ key, title: `Časť ${key}`, required: true, tests: [], blocks })
const v = (n: number, state: CourseVersion["state"], over: Partial<CourseVersion> = {}): CourseVersion => ({
  versionId: `v${n}`, version: n, state, title: "Bezpečnosť v sídle", sequential: false, parts: [part("uvod"), part("zaver")],
  issuesCertificate: false, legalBasisKey: "bozp", createdAt: at, createdBy: "jan", ...over,
})
const course = (versions: CourseVersion[]): Course => ({
  companyCode: "SFZ", key: "bozp", title: "BOZP", topicKey: "bozp", topicLabel: "Bezpečnosť a ochrana zdravia",
  smartTags: [], language: "sk", openEnrollment: false, versions, createdAt: at, createdBy: "jan",
})

async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/learning/manage/[courseKey]/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ courseKey: "bozp" }), searchParams: Promise.resolve(query) }))
}

beforeEach(() => { s.course = course([v(1, "draft")]) })

describe("/learning/manage/[courseKey]", () => {
  it("koncept bez častí: čo chýba a vypnuté zverejnenie", async () => {
    s.course = course([v(1, "draft", { parts: [], legalBasisKey: undefined })])
    const html = await render()
    expect(html).toContain("Na zverejnenie chýba")
    expect(html).toContain("Kurz nemá žiadnu časť.")
    expect(html).toContain("Chýba právny základ")
    expect(html).toMatch(/disabled="" aria-disabled="true">Zverejniť verziu 1/)
    expect(html).toContain("Kurz zatiaľ nemá žiadnu časť")
  })

  it("koncept pripravený nad zverejneným: zverejniť v3, v2 zostáva", async () => {
    s.course = course([v(2, "published"), v(3, "draft")])
    const html = await render()
    expect(html).toContain("Pripravené na zverejnenie")
    expect(html).toContain("<button type=\"submit\">Zverejniť verziu 3</button>")
    expect(html).toContain("Verzia 2 zostáva zverejnená")
    expect(html).toContain("Posunúť vyššie")
  })

  it("zverejnený: len čítanie, Nová verzia a Archivovať", async () => {
    s.course = course([v(2, "published")])
    const html = await render()
    expect(html).toContain("Zverejnená verzia sa nemení.")
    expect(html).toContain("Nová verzia")
    expect(html).toContain("Archivovať")
    expect(html).toContain("len na čítanie")
    expect(html).not.toContain("Posunúť vyššie")
    expect(html).toContain("Zobraziť")
  })

  it("archív: rozpracovaní a Obnoviť ako novú verziu", async () => {
    s.course = course([v(1, "archived")])
    const html = await render()
    expect(html).toContain("Rozpracovaní dokončia svoju verziu (3).")
    expect(html).toContain("Obnoviť ako novú verziu")
  })

  it("detail časti: bloky, pridať video externé s upozornením, dokument zo zoznamu", async () => {
    const ext = await render({ tab: "parts", part: "uvod", add: "video", src: "external" })
    expect(ext).toContain("Vitajte v kurze.")
    expect(ext).toContain("Pri externom videu sa dopozeranie neoverí.")
    expect(ext).toContain('name="source" value="external"')
    const up = await render({ tab: "parts", part: "uvod", add: "video" })
    expect(up).toContain('data-media="video"')
    expect(up).toContain("Povinné dopozeranie")
    const doc = await render({ tab: "parts", part: "uvod", add: "document" })
    expect(doc).toContain("Smernica BOZP")
  })

  it("úprava textového bloku na mieste", async () => {
    const html = await render({ tab: "parts", part: "uvod", editBlock: "t" })
    expect(html).toContain('name="markdown"')
    expect(html).toContain("Vitajte v kurze.</textarea>")
  })
})
