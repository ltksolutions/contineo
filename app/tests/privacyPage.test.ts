/**
 * privacyPage.test.ts — informovanie (C1): pohlavie má každá organizácia,
 * časti o Vzdelávaní len tá, ktorá má modul zapnutý (ADR-018, ADR-021).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const s = vi.hoisted(() => ({ learning: false, language: "sk", country: undefined as string | undefined, generation: "anthropic", privacy: undefined as unknown }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") } }))
vi.mock("@/lib/session", () => ({
  currentTenant: async () => ({ companyCode: "SFZ", defaultLanguage: "sk", branding: { displayName: "SFZ" }, controller: { legalName: "Slovenský futbalový zväz", country: s.country }, modules: { learning: s.learning }, privacy: s.privacy }),
  currentPerson: async () => ({ language: s.language }),
}))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({ displayName: "SFZ" }) }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/privacy", async (orig) => ({ ...(await orig<typeof import("../src/lib/privacy")>()), dpoContacts: async () => [], PRIVACY_NOTICE_VERSION: new Date("2026-09-28T00:00:00Z") }))
vi.mock("@/lib/tenantProfile", () => {
  const profile = () => ({ providers: { generation: { kind: s.generation, url: "http://vllm" }, embedding: { kind: "atlas-auto" }, rerank: { kind: "atlas-stage" } } })
  return { getTenantProfile: async () => profile(), defaultProfile: profile }
})

async function render() {
  const { default: Page } = await import("../src/app/privacy/page")
  return renderToStaticMarkup(await Page())
}
beforeEach(() => { s.learning = false; s.language = "sk"; s.country = undefined; s.generation = "anthropic"; s.privacy = undefined })

describe("/privacy", () => {
  it("bez Vzdelávania: pohlavie áno, kurzy nie, nič sa nerozhoduje automatizovane", async () => {
    const html = await render()
    expect(html).toContain("pohlavie, ak ho vyplní personalista")
    expect(html).not.toContain("certifikát")
    expect(html).toContain("O nikom sa nerozhoduje automatizovane.")
  })
  it("so Vzdelávaním: kurzy, lehoty, certifikát sa nemaže, automatické vyhodnotenie testu", async () => {
    s.learning = true
    const html = await render()
    expect(html).toContain("vedie aj kurzy a testy")
    expect(html).toContain("12 mesiacov po dokončení kurzu")
    expect(html).toContain("Výnimkou je certifikát — ten sa nemaže.")
    expect(html).toContain("Test vyhodnocuje systém automaticky")
    expect(html).not.toContain("O nikom sa nerozhoduje automatizovane.")
    expect(html).toContain("Verzia textu: 28. 9. 2026")
  })
  it("česky aj anglicky", async () => {
    s.learning = true
    s.language = "cs"
    expect(await render()).toContain("Výjimkou je certifikát")
    s.language = "en"
    expect(await render()).toContain("The exception is the certificate")
  })

  it("krajina sídla CZ: český úrad a zákon o archívnictve aj v slovenskom texte (ADR-022)", async () => {
    s.country = "CZ"
    s.learning = true
    const html = await render()
    expect(html).toContain("Úradu pre ochranu osobných údajov ČR (uoou.gov.cz)")
    expect(html).toContain("zákona č. 499/2004 Sb.")
    expect(html).not.toContain("dataprotection.gov.sk")
  })
  it("sprostredkovatelia z profilu: model na vlastnom serveri = bez Anthropicu", async () => {
    expect(await render()).toContain(">Anthropic<")
    s.generation = "openai"
    const html = await render()
    expect(html).not.toContain(">Anthropic<")
    expect(html).toContain("Voyage AI")
  })

  it("lehoty a verzia textu z nastavení organizácie (D136, D138)", async () => {
    expect(await render()).toContain("3 roky od skončenia pracovného pomeru")
    s.learning = true
    s.privacy = { retention: { evidenceYears: 2, capYears: 6, learningDetailMonths: 6 }, updatedAt: new Date("2026-10-05T00:00:00Z") }
    const html = await render()
    expect(html).toContain("2 roky od skončenia pracovného pomeru")
    expect(html).toContain("najdlhšie 6 rokov od poslednej udalosti")
    expect(html).toContain("6 mesiacov po dokončení kurzu")
    expect(html).toContain("Verzia textu: 5. 10. 2026")
  })

  it("doplnok DPO: v jazyku čitateľa, inak v predvolenom; bez neho sekcia nie je (D137)", async () => {
    expect(await render()).not.toContain('id="extra"')
    s.privacy = { extra: { sk: "Prvý odsek.\n\nDruhý <b>odsek</b>." } }
    const html = await render()
    expect(html).toContain('id="extra"')
    expect(html).toContain("Doplnenie prevádzkovateľa")
    expect(html).toContain("<p style=\"white-space:pre-line\">Prvý odsek.</p>")
    expect(html).toContain("Druhý &lt;b&gt;odsek&lt;/b&gt;.")
    s.language = "en"
    expect(await render()).toContain("Prvý odsek.")
  })
})
