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
vi.mock("@/lib/libraryRead", () => ({ libraryList: async () => [{ documentId: "sfz:pp", title: "Pracovný poriadok" }] }))
vi.mock("../src/app/hr/tracks/actions", () => ({
  renameTrackAction: async () => {}, addStepAction: async () => {}, removeStepAction: async () => {},
  moveStepAction: async () => {}, setTrackActiveAction: async () => {},
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
})
