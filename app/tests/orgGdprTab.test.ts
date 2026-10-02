/**
 * orgGdprTab.test.ts — záložka GDPR v nastaveniach organizácie (D154).
 *
 * Lehoty uchovávania, doplnok na `/privacy` a kontakt GDPR bývajú
 * v nastaveniach, ale upravuje ich len DPO (D136, D137). Správca osôb ich
 * vidí na čítanie; DPO bez roly správcu vidí len túto záložku.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const s = vi.hoisted(() => ({ canAdmin: true, canEditGdpr: true }))
const tenant = vi.hoisted(() => ({
  companyCode: "SFZ", hostnames: ["intranet.futbalsfz.sk"], languages: ["sk", "cs"], defaultLanguage: "sk",
  branding: { displayName: "Intranet SFZ" },
  privacy: {
    retention: { evidenceYears: 2 },
    extra: { sk: "Kamerový systém v sídle." },
    contact: { name: "Ján Letko", email: "gdpr@futbalsfz.sk" },
  },
}))

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") }, redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
// Krok cesty za stránkou (`leaf`, ZAKLAD-zalozky Q2) sa vypíše, nech ho test vidí.
vi.mock("@/components/AppShell", () => ({
  default: ({ children, title, trail }: { children: unknown; title?: string; trail?: Record<string, string> }) =>
    [`[path:${[...Object.values(trail ?? {}), title].join(" › ")}]`, children],
}))
vi.mock("@/lib/session", () => ({}))
vi.mock("@/components/SubmitButton", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/mongodb", () => ({ getCollection: vi.fn() }))
vi.mock("@/lib/orgSettings", () => ({
  orgPageContext: async () => ({
    state: "ready", tenant, canAdmin: s.canAdmin, canEditGdpr: s.canEditGdpr,
    person: { language: "sk", companyCode: "SFZ", email: "jan@sfz.sk" },
  }),
}))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({ displayName: "Intranet SFZ" }), tenantByCompanyCode: async () => tenant }))
vi.mock("@/lib/customerDomains", () => ({ domainRequests: async () => [], domainInstruction: () => "" }))
vi.mock("../src/app/organisation/actions", () => ({
  saveBrandingAction: async () => {},
  saveAutoProvisionAction: async () => {},
  deleteLogoAction: async () => {},
  saveSignInAction: async () => {},
  deleteSignInAction: async () => {},
  requestDomainAction: async () => {},
  verifyDomainAction: async () => {},
  cancelDomainAction: async () => {},
  createDepartmentAction: async () => {},
  renameDepartmentAction: async () => {},
  moveDepartmentAction: async () => {},
  deleteDepartmentAction: async () => {},
  addCodelistItemAction: async () => {},
  removeCodelistItemAction: async () => {},
  addLegalBasisAction: async () => {},
  retireLegalBasisAction: async () => {},
  toggleStandardLegalBasisAction: async () => {},
  saveChunkingProfileAction: async () => {},
  reindexAllAction: async () => {},
  shiftDepartmentAction: async () => {},
  saveDepartmentOrderAction: async () => {},
}))
vi.mock("../src/app/dpo/actions", () => ({
  saveGdprContactAction: async () => {}, saveRetentionAction: async () => {}, saveExtraAction: async () => {},
}))

async function render(section = "gdpr", query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/organisation/[section]/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ section }), searchParams: Promise.resolve(query) }))
}

async function renderIndex() {
  const { default: Page } = await import("../src/app/organisation/page")
  return renderToStaticMarkup(await Page())
}

beforeEach(() => { s.canAdmin = true; s.canEditGdpr = true })

describe("časť GDPR", () => {
  it("DPO: kontakt, lehoty a doplnok s uloženými hodnotami a tlačidlami", async () => {
    const html = await render()
    expect(html).toMatch(/name="privacyContactEmail"[^>]*value="gdpr@futbalsfz.sk"/)
    expect(html).toMatch(/name="evidenceYears"[^>]*value="2"/)
    expect(html).toContain('name="extra-cs"')
    expect(html).toContain("Kamerový systém v sídle.")
    expect(html).toContain("Uložiť kontakt")
    expect(html).not.toContain("<fieldset disabled")
  })

  it("správca osôb bez roly DPO: to isté na čítanie, bez tlačidiel", async () => {
    s.canEditGdpr = false
    const html = await render()
    expect(html).toContain("Vidíte ich len na čítanie.")
    expect(html.match(/<fieldset disabled=""/g)).toHaveLength(3)
    expect(html).not.toContain("Uložiť kontakt")
    expect(html).toContain("Kamerový systém v sídle.")
  })

  it("DPO bez roly správcu: len GDPR, bez zoznamu a odkazu späť; iná časť je 404 (D154)", async () => {
    s.canAdmin = false
    const html = await render("gdpr")
    expect(html).not.toContain("org-nav")
    expect(html).not.toContain("org-back")
    expect(html).toContain('name="privacyContactEmail"')
    await expect(render("branding")).rejects.toThrow("notFound")
    // Rozcestník ho pošle rovno do jeho jedinej časti.
    await expect(renderIndex()).rejects.toThrow("redirect /organisation/gdpr")
  })
})

describe("časti na vlastných cestách (2. 10. 2026)", () => {
  it("rozcestník: skupiny a poradie častí, odkazy na cesty, žiadna vybraná (Q1, Q3)", async () => {
    const html = await renderIndex()
    const groups = [...html.matchAll(/<h2 class="org-nav-title">([^<]+)</g)].map(m => m[1])
    expect(groups).toEqual(["Organizácia", "Prístup", "Dokumenty", "Dohľad"])
    const sections = [...html.matchAll(/href="\/organisation\/([a-z]+)"/g)].map(m => m[1])
    expect(sections).toEqual(["branding", "departments", "codelists", "domains", "signin", "chunking", "audit", "gdpr"])
    expect(html).not.toContain("is-active")
    expect(html).toContain('class="org-nav org-index"')
    expect(html).toContain("[path:Organizácia]")
  })

  it("časť: vybraná v zozname, názov v ceste; odkaz späť nie je — späť vedie cesta (ZAKLAD-podmenu-a-akcie)", async () => {
    const html = await render("signin")
    expect(html).toMatch(/class="org-nav-item is-active"[^>]*href="\/organisation\/signin"/)
    expect(html).not.toContain("org-back")
    expect(html).toContain("[path:Organizácia › Prihlasovanie]")
  })

  it("neznáma časť je 404", async () => {
    await expect(render("nieco")).rejects.toThrow("notFound")
  })
})
