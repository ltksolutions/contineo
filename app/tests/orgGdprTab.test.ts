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

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") }, redirect: () => { throw new Error("redirect") } }))
// Krok cesty za stránkou (`leaf`, ZAKLAD-zalozky Q2) sa vypíše, nech ho test vidí.
vi.mock("@/components/AppShell", () => ({
  default: ({ children, leaf }: { children: unknown; leaf?: string }) => [leaf ? `[leaf:${leaf}]` : null, children],
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

async function render(tab: string | null = "gdpr") {
  const { default: Page } = await import("../src/app/organisation/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(tab ? { tab } : {}) }))
}

beforeEach(() => { s.canAdmin = true; s.canEditGdpr = true })

describe("záložka GDPR", () => {
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

  it("DPO bez roly správcu: len záložka GDPR, aj keď adresa chce inú", async () => {
    s.canAdmin = false
    const html = await render("branding")
    // Jedna časť: bez zoznamu častí aj bez odkazu späť (ZAKLAD-zalozky, D154).
    expect(html).not.toContain("org-nav")
    expect(html).not.toContain("org-back")
    expect(html).not.toContain('href="/organisation?tab=branding"')
    expect(html).toContain('name="privacyContactEmail"')
    expect(html).not.toContain('name="displayName"')
    expect(html).toContain("[leaf:GDPR]")
  })
})

describe("zoznam častí (ZAKLAD-zalozky)", () => {
  it("skupiny a poradie častí podľa skupín (Q1, Q3)", async () => {
    const html = await render("signin")
    const groups = [...html.matchAll(/<h2 class="org-nav-title">([^<]+)</g)].map(m => m[1])
    expect(groups).toEqual(["Organizácia", "Prístup", "Dokumenty", "Dohľad"])
    const tabs = [...html.matchAll(/href="\/organisation\?tab=([a-z]+)"/g)].map(m => m[1])
    expect(tabs).toEqual(["branding", "departments", "codelists", "domains", "signin", "chunking", "audit", "gdpr"])
    expect(html).toMatch(/class="org-nav-item is-active"[^>]*href="\/organisation\?tab=signin"/)
  })

  it("s ?tab: časť, odkaz späť a názov časti v ceste (Q2)", async () => {
    const html = await render("signin")
    expect(html).toContain('<div class="org-set"')
    expect(html).toContain('<a class="org-back" href="/organisation">Nastavenie organizácie</a>')
    expect(html).toContain("[leaf:Prihlasovanie]")
  })

  it("bez ?tab: zoznam (org-set--index), prvá časť pre široké okno, cesta bez časti", async () => {
    const html = await render(null)
    expect(html).toContain('<div class="org-set org-set--index"')
    expect(html).toMatch(/class="org-nav-item is-active"[^>]*href="\/organisation\?tab=branding"/)
    expect(html).toContain('name="displayName"')
    expect(html).not.toContain("[leaf:")
  })
})
