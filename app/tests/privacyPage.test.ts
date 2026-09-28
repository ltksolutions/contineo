/**
 * privacyPage.test.ts — informovanie (C1): pohlavie má každá organizácia,
 * časti o Vzdelávaní len tá, ktorá má modul zapnutý (ADR-018, ADR-021).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const s = vi.hoisted(() => ({ learning: false, language: "sk" }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") } }))
vi.mock("@/lib/session", () => ({
  currentTenant: async () => ({ companyCode: "SFZ", defaultLanguage: "sk", branding: { displayName: "SFZ" }, controller: { legalName: "Slovenský futbalový zväz" }, modules: { learning: s.learning } }),
  currentPerson: async () => ({ language: s.language }),
}))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({ displayName: "SFZ" }) }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/privacy", () => ({ dpoContacts: async () => [], PRIVACY_NOTICE_VERSION: new Date("2026-09-28T00:00:00Z") }))

async function render() {
  const { default: Page } = await import("../src/app/privacy/page")
  return renderToStaticMarkup(await Page())
}
beforeEach(() => { s.learning = false; s.language = "sk" })

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
})
