/**
 * trackPage.test.ts — stránka trasy sa vykreslí a názov sa dá upraviť hore
 * (Ján 2. 10. 2026: formulár na konci stránky bez nadpisu nenašiel).
 */
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/hr", () => ({
  trackManagerContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ" },
    person: { id: "p1", email: "hr@sfz.sk", companyCode: "SFZ", language: "sk", roles: ["hr"] },
  }),
}))
vi.mock("@/lib/tracks", () => ({
  trackByKey: async () => ({
    companyCode: "SFZ", key: "novy-zamestnanec", title: "Nový zamestnanec", description: "Onboarding",
    isActive: true,
    steps: [{ order: 1, type: "document", documentId: "sfz:pp", requiresAcknowledgement: true }],
  }),
}))
// Stav po ľuďoch z riadkov výkazu — Eva má z trasy 1 z 2 (2. 10. 2026).
vi.mock("@/lib/hrReport", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/hrReport")>()),
  duties: async () => [
    { personId: "p1", documentId: "sfz:pp", documentTitle: "Pracovný poriadok", versionLabel: "1", trackTitles: ["Nový zamestnanec"], sources: ["track"], acknowledgedAt: new Date() },
    { personId: "p1", documentId: "sfz:fs", documentTitle: "Finančná smernica", versionLabel: "1", trackTitles: ["Nový zamestnanec"], sources: ["track"], acknowledgedAt: null },
  ],
}))
vi.mock("@/lib/libraryRead", () => ({ libraryList: async () => [{ documentId: "sfz:pp", title: "Pracovný poriadok" }] }))
vi.mock("@/lib/people", () => ({
  listPeople: async () => [
    { id: "p1", email: "eva@sfz.sk", fullName: "Eva Nová", department: "Oddelenie IT", status: "active", tracks: ["novy-zamestnanec"] },
    { id: "p2", email: "jan@sfz.sk", fullName: "Ján Starý", status: "inactive", tracks: ["novy-zamestnanec"] },
    { id: "p3", email: "ana@sfz.sk", fullName: "Anna Malá", status: "active", tracks: [] },
  ],
}))
vi.mock("@/lib/departments", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/departments")>()),
  allDepartments: async () => [{ companyCode: "SFZ", id: "it", name: "Oddelenie IT", parentId: null }],
  counts: async () => new Map([["it", { direct: 1, withDescendants: 1 }]]),
}))
vi.mock("../src/app/hr/tracks/actions", () => ({
  renameTrackAction: async () => {}, addStepAction: async () => {}, removeStepAction: async () => {},
  moveStepAction: async () => {}, setTrackActiveAction: async () => {},
  addMembersAction: async () => {}, removeMemberAction: async () => {},
}))

describe("stránka trasy", () => {
  it("úprava názvu je hore pri nadpise, pred krokmi, s vyplneným názvom", async () => {
    const { default: Page } = await import("../src/app/hr/tracks/[key]/page")
    const html = renderToStaticMarkup(await Page({
      params: Promise.resolve({ key: "novy-zamestnanec" }),
      searchParams: Promise.resolve({}),
    }))
    const edit = html.indexOf("Upraviť názov")
    expect(edit).toBeGreaterThan(-1)
    expect(edit).toBeLessThan(html.indexOf("Kroky"))
    expect(html).toMatch(/name="title"[^>]*value="Nový zamestnanec"|value="Nový zamestnanec"[^>]*name="title"/)
    // Formulár je len jeden — na konci stránky už nie je.
    expect(html.match(/name="title"/g)).toHaveLength(1)
  })

  it("ukáže ľudí na trase s odobratím a ponúkne pridať osoby aj oddelenia (2. 10. 2026)", async () => {
    const { default: Page } = await import("../src/app/hr/tracks/[key]/page")
    const html = renderToStaticMarkup(await Page({
      params: Promise.resolve({ key: "novy-zamestnanec" }),
      searchParams: Promise.resolve({}),
    }))
    expect(html).toContain("Osoby na trase (2)")
    expect(html).toContain("Eva Nová")
    expect(html).toContain("vyradená")
    expect(html).toMatch(/name="personId"[^>]*value="p1"|value="p1"[^>]*name="personId"/)
    expect(html).toContain("Pridať osoby")
    expect(html).toContain("Oddelenie IT")
    // Na výber je len ten, kto na trase ešte nie je a nie je vyradený.
    expect(html).toContain("Anna Malá")
    // Stav pri človeku a „Dať vedieť", keď niekomu niečo chýba.
    expect(html).toContain("1 / 2")
    expect(html).toContain('href="/hr/tracks/novy-zamestnanec/notify"')
  })
})
