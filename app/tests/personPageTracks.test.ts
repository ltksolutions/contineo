/**
 * personPageTracks.test.ts — karta osoby: trasy sa vyberajú podľa názvu
 * (2. 10. 2026). Kľúč sa neukazuje; kľúč, ku ktorému trasa nie je, ostane
 * zaškrtnutý, aby ho uloženie potichu nezmazalo.
 */
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const { UUID } = vi.hoisted(() => ({ UUID: "3f1c0b7e-0000-4000-8000-000000000001" }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/session", () => ({ currentTenant: async () => null, currentPerson: async () => null }))
vi.mock("@/lib/people", () => ({
  ASSIGNABLE_ROLES: ["hr", "content-admin"],
  peopleContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", codelists: {}, modules: {} },
    person: { id: "admin", email: "admin@sfz.sk", companyCode: "SFZ", language: "sk", roles: ["people-admin"] },
  }),
  loadPersonById: async () => ({
    id: "p1", companyCode: "SFZ", email: "eva@sfz.sk", fullName: "Eva Nová", firstName: "Eva", lastName: "Nová",
    personType: "employee", status: "active", language: "sk", roles: [], groups: [],
    tracks: [UUID, "stara-trasa"], emailHistory: [], accounts: [],
  }),
}))
vi.mock("@/lib/persons", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/persons")>()),
  audiencesInOrg: async () => ({ groups: [], tracks: [] }),
}))
vi.mock("@/lib/tracks", () => ({
  allTracks: async () => [
    { companyCode: "SFZ", key: UUID, title: "Rozhodcovia 2026", isActive: true, steps: [] },
    { companyCode: "SFZ", key: "novy-zamestnanec", title: "Nový zamestnanec", isActive: false, steps: [] },
  ],
}))
vi.mock("@/lib/departments", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/departments")>()),
  allDepartments: async () => [],
}))
vi.mock("@/lib/evidenceDb", () => ({ evidenceForPerson: async () => [] }))
vi.mock("../src/app/people/actions", () => ({
  savePersonAction: async () => {}, togglePersonStatusAction: async () => {},
  resendInviteAction: async () => {}, setEndedAtAction: async () => {},
}))

describe("karta osoby — trasy", () => {
  it("ponúkne trasy názvom, kľúč neukáže, neznámy kľúč nechá zaškrtnutý", async () => {
    const { default: Page } = await import("../src/app/people/[id]/page")
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "p1" }), searchParams: Promise.resolve({}) }))

    expect(html).toContain("Rozhodcovia 2026")
    expect(html).toContain("Nový zamestnanec")
    expect(html).toContain("vypnutá")
    // Kľúč je len hodnota políčka, nie text na obrazovke.
    expect(html.replace(/value="[^"]*"/g, "")).not.toContain(UUID)
    expect(html).toMatch(new RegExp(`value="${UUID}"[^>]*checked|checked[^>]*value="${UUID}"`))
    expect(html).toMatch(/value="stara-trasa"[^>]*checked|checked[^>]*value="stara-trasa"/)
    expect(html).toContain("neznáma trasa")
  })

  it("karta osoby (OSOBY-karta-osoby): sekcie, výbery bez karty v karte, lišta, Ďalšie akcie", async () => {
    const { default: Page } = await import("../src/app/people/[id]/page")
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "p1" }), searchParams: Promise.resolve({}) }))

    expect(html).toContain('<form class="card set-form"')
    expect(html.match(/<section class="set-sec">/g)).toHaveLength(6)
    // Trasy ako riadky priamo v sekcii — žiadna karta v karte formulára.
    expect(html).toMatch(/<fieldset class="sec-rows"><legend class="sec-rows-head">Trasy<\/legend><div class="sec-rows-body">/)
    expect(html).toMatch(/<label class="form-row select-row"><input type="checkbox" name="track"/)
    expect(html).not.toContain("form-group-body--rows")
    expect(html).toContain('class="set-savebar"')
    // Vyradenie len ako riadok; karta s potvrdením až pri ?exclude=1.
    expect(html).toContain('href="/people/p1?exclude=1#more"')
    expect(html).not.toContain('name="confirmation"')
    expect(html).not.toContain("<details class=\"detail-tools\"")
    const excl = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "p1" }), searchParams: Promise.resolve({ exclude: "1" }) }))
    expect(excl).toContain('name="confirmation"')
    expect(excl).not.toContain('href="/people/p1?exclude=1#more"')
  })
})
