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
  shiftDepartmentAction: async () => {},
  saveDepartmentOrderAction: async () => {},
  saveAiSettingsAction: async () => {},
  deleteAiKeyAction: async () => {},
}))
// Číselníky (záložky, 3. 10. 2026): položky bez databázy.
vi.mock("@/lib/codelistsTenant", () => ({
  availableOptions: (_t: unknown, name: string) => [{ key: `${name}-a`, label: `${name} A` }, { key: `${name}-b`, label: `${name} B` }],
  customItems: () => [],
  codelistUsage: async () => 0,
}))
vi.mock("@/lib/legalBasesDb", () => ({ legalBasisUsage: async () => new Map() }))
// Spotreba AI (D158): dva riadky bez databázy.
vi.mock("@/lib/aiUsage", async (orig) => {
  const real = await orig<typeof import("../src/lib/aiUsage")>()
  const actor = { companyCode: "SFZ", personId: "p1", personName: "Ján Letko", email: "jan@sfz.sk" }
  const at = new Date("2026-10-05T08:15:00Z")
  const rows = [
    real.usageRecord({ actor, purpose: "answer", provider: "anthropic", model: "claude-sonnet-5", keySource: "operator", tokens: { input: 6000, output: 1500 }, at }),
    real.usageRecord({ actor, purpose: "pdf-rewrite", subject: "Volebný poriadok SFZ", provider: "anthropic", model: "claude-sonnet-4-5", keySource: "tenant", tokens: { input: 20000, output: 9000 }, at }),
  ]
  return {
    ...real,
    usageRows: async () => rows,
    usageTotals: async () => ({ calls: 2, usd: rows[0].usd + rows[1].usd, tokens: { input: 26000, output: 10500, cacheRead: 0, cacheWrite: 0 } }),
    usagePeople: async () => [{ personId: "p1", personName: "Ján Letko" }],
  }
})
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
    await expect(render("general")).rejects.toThrow("notFound")
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
    expect(sections).toEqual(["general", "departments", "codelists", "ai", "helpdesk", "domains", "signin", "acknowledgements", "audit", "gdpr"])
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

  it("umelá inteligencia: poskytovateľ, pole na kľúč bez hodnoty, modely s cenou (D157)", async () => {
    const html = await render("ai")
    expect(html).toContain("[path:Organizácia › Umelá inteligencia]")
    expect(html).toContain("Anthropic (Claude)")
    expect(html).toMatch(/<input[^>]*(name="apiKey"[^>]*type="password"|type="password"[^>]*name="apiKey")/)
    expect(html).not.toMatch(/name="apiKey"[^>]*value=/)
    expect(html).toContain("Claude Sonnet 5 — vstup 2 $ · výstup 10 $")
    expect(html).toContain("Claude Haiku 4.5")
    // Bez vlastného kľúča sa tlačidlo odstránenia neukazuje.
    expect(html).not.toContain("Odstrániť kľúč")
  })

  it("umelá inteligencia → spotreba: filter, súčty, riadky s účelom, exporty s tými istými filtrami (D158)", async () => {
    const html = await render("ai", { view: "usage", from: "2026-10-01", to: "2026-10-05", purpose: "answer" })
    expect(html).toMatch(/class="[^"]*is-active[^"]*"[^>]*href="\/organisation\/ai\?view=usage"|href="\/organisation\/ai\?view=usage"[^>]*class="[^"]*is-active/)
    expect(html).toMatch(/name="from"[^>]*value="2026-10-01"|value="2026-10-01"[^>]*name="from"/)
    expect(html).toContain("Odpoveď asistenta")
    expect(html).toContain("Prepis skenu PDF")
    expect(html).toContain("Volebný poriadok SFZ")
    expect(html).toContain("kľúč organizácie")
    expect(html).toContain("/api/ai-usage?format=xlsx&amp;from=2026-10-01&amp;to=2026-10-05&amp;purpose=answer")
    expect(html).toContain("Ján Letko")
    // Nastavenie (kľúč) sa na záložke Spotreba nekreslí.
    expect(html).not.toContain('name="apiKey"')
  })

  it("členenie už nie je časť nastavení (D160)", async () => {
    await expect(render("chunking")).rejects.toThrow("notFound")
  })

  it("neznáma časť je 404", async () => {
    await expect(render("nieco")).rejects.toThrow("notFound")
  })
})

describe("číselníky ako záložky (3. 10. 2026)", () => {
  it("štyri záložky bez počtu; predvolene Druhy dokumentov, ostatné číselníky nie sú vykreslené", async () => {
    const html = await render("codelists")
    for (const label of ["Druhy dokumentov", "Značky", "Pracoviská", "Právne základy"]) expect(html).toContain(label)
    expect(html).toContain('href="/organisation/codelists?list=tags"')
    expect(html).toContain('class="tab is-active" aria-current="page" href="/organisation/codelists?list=category"')
    expect(html).toContain('id="cl-category"')
    expect(html).not.toContain('id="cl-tags"')
    expect(html).not.toContain('id="cl-legal"')
    // Počet položiek pri záložke nič nehlásil (Ján 3. 10.) — nie je.
    expect(html).not.toContain("tab-count")
  })

  it("?list=legal ukáže len právne základy; formuláre nesú list, aby sa po uložení vrátili", async () => {
    const html = await render("codelists", { list: "legal" })
    expect(html).toContain('id="cl-legal"')
    expect(html).not.toContain('id="cl-category"')
    expect(html).toContain('name="list" value="legal"')
  })

  it("neznámy číselník padá na prvý", async () => {
    expect(await render("codelists", { list: "nieco" })).toContain('id="cl-category"')
  })
})
