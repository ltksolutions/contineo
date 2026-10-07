/**
 * learningManageCoursePage.test.ts — úprava kurzu (rám MANAGE-COURSE):
 * karta stavu v štyroch stavoch, zoznam častí so šípkami, detail časti
 * s blokmi a formulárom „Pridať blok", len čítanie pri zverejnenom.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Course, CourseVersion, Part } from "../src/lib/courses"

const s = vi.hoisted(() => ({ course: null as unknown }))

vi.mock("@/lib/certificatesDb", () => ({ ensureCertificate: async () => null, certificatesForPerson: async () => [], certificatesForCourse: async () => [], certificateForEnrollment: async () => null }))
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
  useRouter: () => ({ refresh: () => {} }),
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/SubmitButton", async () => { const { createElement: h } = await import("react"); return { default: ({ children, name, value, ariaLabel, disabled }: { children: string; name?: string; value?: string; ariaLabel?: string; disabled?: boolean }) => h("button", { type: "submit", name, value, "aria-label": ariaLabel, disabled }, children) } })
vi.mock("@/components/TabLink", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/CourseMediaUpload", async () => { const { createElement: h } = await import("react"); return { default: ({ kind }: { kind: string }) => h("div", { "data-media": kind }) } })
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/learning", () => ({
  learningAdminContext: async () => ({ state: "ready", isAdmin: true, person: { id: "p", companyCode: "SFZ", language: "sk", email: "jan@sfz.sk" }, tenant: { companyCode: "SFZ", branding: { displayName: "SFZ" }, learningTopics: [{ key: "bozp", label: "Bezpečnosť a ochrana zdravia" }], certificateSigner: { name: "Ján Letko", role: "generálny sekretár" } } }),
}))
vi.mock("@/lib/coursesDb", () => ({ getCourse: async () => s.course }))
vi.mock("@/lib/learningStats", () => ({
  courseStats: async () => new Map([["bozp", { enrolled: 5, completed: 2 }]]),
  courseRoster: async () => [
    { enrollment: { id: "e1", personId: "p1", fullName: "Marek Horák", email: "marek@sfz.sk", source: "assignment" }, department: "Právne", state: "done", requiredDone: 2, requiredTotal: 2, completedAt: new Date("2026-09-18T00:00:00Z"), lastActivity: new Date("2026-09-18T00:00:00Z") },
    { enrollment: { id: "e2", personId: "p2", fullName: "Peter Kováč", email: "peter@sfz.sk", source: "self" }, department: null, state: "in-progress", requiredDone: 1, requiredTotal: 2, completedAt: null, lastActivity: new Date("2026-09-20T00:00:00Z") },
  ],
}))
vi.mock("@/lib/assignments", () => ({
  audienceFromSelection: ({ all }: { all?: boolean }) => (all ? [{ kind: "all" }] : []),
  audienceMembers: async () => [{ id: "p1" }, { id: "p3" }, { id: "p4" }],
}))
vi.mock("@/lib/persons", () => ({ audiencesInOrg: async () => ({ groups: [{ value: "rozhodcovia", count: 4 }], tracks: [{ value: "zaklad", count: 2 }] }) }))
// Trasy sa ukazujú názvom, nie kľúčom (2. 10. 2026).
vi.mock("@/lib/tracks", () => ({ trackNames: async () => ({ zaklad: "Základný onboarding" }) }))
vi.mock("@/lib/departments", () => ({ allDepartments: async () => [], flattenTree: () => [], counts: async () => new Map() }))
vi.mock("@/lib/testsDb", () => ({ listTests: async () => [{ key: "evak", title: "Evakuácia", status: "ready", sections: [{ count: 5 }], rules: { passingPercent: 80, maxAttempts: 3 }, responsible: [{ fullName: "Marek" }] }] }))
vi.mock("@/lib/smartTagsDb", () => ({ smartTagUsage: async () => [{ key: "uroven", value: "1", label: "Úroveň: 1", courses: 2, questions: 0, tests: 0 }] }))
vi.mock("@/lib/courseDocs", () => ({ documentChoices: async () => [{ documentId: "sfz:bozp", versionId: "v1", title: "Smernica BOZP", label: "úplné znenie od 1. 3. 2026" }] }))
vi.mock("../src/app/learning/manage/[courseKey]/actions", () => Object.fromEntries(
  ["revokeCertificateAction","addPartTestAction","removePartTestAction","savePartTestsAction","assignCourseAction","saveSettingsAction","addBlockAction","addPartAction","archiveAction","moveBlockAction","movePartAction","newVersionAction","publishAction","removeBlockAction","removePartAction","updateBlockAction","updatePartAction"].map(n => [n, async () => {}])))

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
    // Riadok časti je odkaz na celý riadok (MANAGE-COURSE-akcie).
    expect(html).toContain('<a class="mc-lrow-link" href="/learning/manage/bozp/parts/uvod">')
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
    // Zdroj videa ako `.choice-row`; starý `?src=external` predvolí externý.
    expect(ext).toContain('name="source" checked="" value="external"')
    const up = await render({ tab: "parts", part: "uvod", add: "video" })
    expect(up).toContain('data-media="video"')
    expect(up).toContain("Povinné dopozeranie")
    const doc = await render({ tab: "parts", part: "uvod", add: "document" })
    expect(doc).toContain("Smernica BOZP")
    // Priradiť sa dá len pripravený test (rám MANAGE-COURSE, TESTS).
    expect(doc).toContain("Priradiť test")
    expect(doc).toContain("Evakuácia")
  })

  it("úprava textového bloku na mieste", async () => {
    const html = await render({ tab: "parts", part: "uvod", editBlock: "t" })
    expect(html).toContain('name="markdown"')
    expect(html).toContain("Vitajte v kurze.</textarea>")
  })

  it("nastavenia: formulár s tagmi (bez JS textarea), podpisujúci z organizácie, právny základ", async () => {
    const html = await render({ tab: "settings" })
    expect(html).toContain("Uložiť nastavenia")
    expect(html).toContain('name="smartTags"')
    expect(html).toContain("Ján Letko")
    expect(html).toContain("Časti idú postupne")
    expect(html).toContain("bez právneho základu sa kurz nezverejní")
  })

  it("nastavenia zverejnenej verzie sú len na čítanie", async () => {
    s.course = course([v(2, "published")])
    const html = await render({ tab: "settings" })
    expect(html).toContain("nastavenia sú len na čítanie")
    expect(html).not.toContain("Uložiť nastavenia")
  })

  it("zapísaní: stav bez skóre, filter, export", async () => {
    s.course = course([v(2, "published")])
    const html = await render({ tab: "people" })
    expect(html).toContain("dokončil 18. 9. 2026")
    expect(html).toContain("1 z 2 častí")
    expect(html).toContain("samozápisom")
    expect(html).toContain("/api/learning/courses/bozp/people")
    // Filter zapísaných je prepínač pohľadu (DESIGN_ODCHYLKY P4).
    expect(html).toContain("Dokončili <span class=\"view-switch-count\">1</span>")
    expect(html).toContain("<nav class=\"view-switch view-switch--fit\"")
  })

  it("prideliť: trasa aj skupina, dopad s už zapísanými", async () => {
    s.course = course([v(2, "published")])
    const html = await render({ tab: "people", assign: "1", preview: "1", all: "1" })
    expect(html).toContain("track:zaklad")
    // Názov trasy, nie kľúč (2. 10. 2026).
    expect(html).toContain("Základný onboarding")
    expect(html).toContain("Zapíše sa 2 ľudia do verzie 2 · 1 je už zapísaný a nič sa mu nezmení.")
    expect(html).toContain("Prideliť 2 ľuďom")
  })

  it("prideliť koncept bez zverejnenej verzie sa nedá", async () => {
    expect(await render({ tab: "people", assign: "1" })).toContain("Prideliť sa dá len zverejnený kurz.")
  })

  it("vlastné adresy (R3): časť, nastavenia a zapísaní; neznáma časť je 404", async () => {
    const { default: PartPage } = await import("../src/app/learning/manage/[courseKey]/parts/[partKey]/page")
    const part = renderToStaticMarkup(await PartPage({ params: Promise.resolve({ courseKey: "bozp", partKey: "uvod" }), searchParams: Promise.resolve({}) }))
    expect(part).toContain('href="/learning/manage/bozp/parts/uvod?add=video#add"')
    expect(part).not.toContain("tab=")
    await expect(PartPage({ params: Promise.resolve({ courseKey: "bozp", partKey: "nie-je" }), searchParams: Promise.resolve({}) })).rejects.toThrow("notFound")
    const { default: PeoplePage } = await import("../src/app/learning/manage/[courseKey]/people/page")
    const people = renderToStaticMarkup(await PeoplePage({ params: Promise.resolve({ courseKey: "bozp" }), searchParams: Promise.resolve({ assign: "1" }) }))
    expect(people).toContain("Prideliť sa dá len zverejnený kurz.")
    expect(people).toContain('href="/learning/manage/bozp/people?filter=done"')
  })

  it("akcie (MANAGE-COURSE-akcie): karta stavu len na koreni, inde štítok; náhľad", async () => {
    const root = await render()
    expect(root).toContain('href="/learning/bozp?preview=1"')
    expect(root).not.toContain("mc-stchip")
    const settings = await render({ tab: "settings" })
    expect(settings).not.toContain("mc-status")
    expect(settings).toContain('class="mc-stchip is-ok" aria-label="Stav verzie — prehľad kurzu" href="/learning/manage/bozp"')
    // Na detaile časti je plné len „Pridať blok ▾"; Uložiť časť je tiché.
    const detail = await render({ tab: "parts", part: "uvod" })
    expect(detail).toContain('<summary class="button">Pridať blok')
    expect(detail).toContain('href="/learning/manage/bozp/parts/uvod?add=video#add"')
    expect(detail).not.toContain("Všetky časti")
    expect(detail).toContain('href="/learning/manage/bozp/parts/uvod?removePart=1"')
  })

  it("úprava bloku: Uložiť blok a Odstrániť blok pod čiarou; menu sa nekreslí", async () => {
    const html = await render({ tab: "parts", part: "uvod", editBlock: "t" })
    expect(html).toContain("Blok 1 · Text")
    expect(html).toContain("Uložiť blok")
    expect(html).toContain("Odstrániť blok")
    expect(html).toContain("Blok zmizne z konceptu v1.")
    expect(html).not.toContain("<summary")
  })

  it("potvrdenia: archivácia zverejneného a odstránenie časti", async () => {
    s.course = course([v(2, "published")])
    const archive = await render({ archive: "1" })
    expect(archive).toContain('role="dialog"')
    expect(archive).toContain("Archivovať kurz Bezpečnosť v sídle?")
    expect(archive).toContain("3 rozpracovaní ho dokončia vo verzii 2.")
    expect(archive).toContain('href="/learning/manage/bozp">Zrušiť</a>')
    s.course = course([v(1, "draft")])
    expect(await render({ archive: "1" })).not.toContain('role="dialog"')
    const remove = await render({ tab: "parts", part: "uvod", removePart: "1" })
    expect(remove).toContain("Odstrániť časť „Časť uvod“ s 1 blokom?")
  })

  it("zapísaní: pri otvorenom prideľovaní sa tlačidlo Prideliť kurz v hlavičke nekreslí", async () => {
    s.course = course([v(2, "published")])
    expect(await render({ tab: "people" })).toContain('href="/learning/manage/bozp/people?assign=1"')
    expect(await render({ tab: "people", assign: "1" })).not.toContain('href="/learning/manage/bozp/people?assign=1"')
  })
})
