/**
 * revokeAssignment.test.ts — potvrdenie pred odvolaním pridelenia (30. 9. 2026).
 *
 * Tlačidlo v zozname odvolávalo jedným kliknutím; karty sa po odvolaní
 * posunuli a druhé kliknutie trafilo iné pridelenie. Test stráži, že zoznam
 * už neodvoláva, stránka povie, čo sa stane, a akcia zapíše dôvod aj povie,
 * čo presne odvolala.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({
  assignment: null as Record<string, unknown> | null,
  doc: null as Record<string, unknown> | null,
  members: [] as unknown[],
  unacknowledged: [] as unknown[],
  revoked: true,
  revokeCalls: [] as unknown[][],
}))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/session", () => ({ requestHostname: async () => "intranet.test" }))
vi.mock("@/lib/hr", () => ({
  isHr: () => true,
  assignableDocuments: async () => [],
  hrContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", name: "SFZ" },
    person: { id: "p-hr", email: "hr@sfz.sk", companyCode: "SFZ", language: "sk", roles: ["hr"] },
  }),
}))
vi.mock("@/lib/documents", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/documents")>()),
  loadDocument: async () => state.doc,
}))
vi.mock("@/lib/assignments", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/assignments")>()),
  loadAssignment: async () => state.assignment,
  audienceMembers: async () => state.members,
  notAcknowledged: async () => state.unacknowledged,
  revoke: async (...args: unknown[]) => { state.revokeCalls.push(args); return state.revoked },
}))

function assignment(over: Record<string, unknown> = {}) {
  return {
    _id: "a1", companyCode: "SFZ",
    subject: { documentId: "sfz:test", versionId: "v1", documentTitle: "Skúšobný poriadok", versionLabel: "1.0", effectiveFrom: new Date("2026-07-01") },
    audience: { kind: "department", value: "it", label: "Oddelenie IT" },
    reason: "Test e-mailu", assignedBy: "hr@sfz.sk", assignedAt: new Date("2026-09-30"), revokedAt: null,
    ...over,
  }
}

const person = (id: string, former = false) => ({ id, email: `${id}@sfz.sk`, fullName: id, former })

async function renderPage() {
  const { default: Page } = await import("../src/app/hr/[id]/revoke/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "a1" }) }))
}

async function submit(fields: Record<string, string>): Promise<string> {
  const { revokeAction } = await import("../src/app/hr/actions")
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  try {
    await revokeAction(fd)
  } catch (e) {
    return decodeURIComponent(String((e as Error).message))
  }
  throw new Error("akcia nepresmerovala")
}

const version = (versionId: string, label: string, from: string, over: Record<string, unknown> = {}) => ({
  versionId, label, effectiveFrom: new Date(from), effectiveTo: null, isActive: true, ...over,
})

beforeEach(() => {
  state.assignment = assignment()
  state.doc = { companyCode: "SFZ", documentId: "sfz:test", title: "Skúšobný poriadok", versions: [version("v1", "1.0", "2026-07-01")] }
  state.members = [person("jan"), person("agata"), person("branislav")]
  state.unacknowledged = [person("agata"), person("branislav"), person("byvaly", true)]
  state.revoked = true
  state.revokeCalls = []
})

describe("stránka potvrdenia", () => {
  it("povie, ktoré pridelenie, komu zmizne úloha a čo zostane", async () => {
    const html = await renderPage()
    expect(html).toContain("Skúšobný poriadok")
    expect(html).toContain("oddelenie „Oddelenie IT")
    // Bývalý člen oddelenia úlohu na obrazovke nemá — nepočíta sa.
    expect(html).toContain("2 ľuďom, ktorí ešte nepotvrdili, zmizne úloha")
    expect(html).toContain("Potvrdenia, ktoré už vznikli (1), zostávajú platné")
    expect(html).toContain("Odvolanie sa nedá vrátiť späť")
    expect(html).toContain('name="reason"')
    expect(html).toContain('name="id" value="a1"')
    expect(html).toContain('href="/hr"')
  })

  it("keď už všetci potvrdili, povie to namiesto počtu", async () => {
    state.unacknowledged = []
    const html = await renderPage()
    expect(html).toContain("Úlohu z tohto pridelenia už nikto nemá")
  })

  it("pridelenie nahradeného znenia nepovie „zmizne úloha“ — povie, že znenie už neplatí", async () => {
    state.doc = {
      companyCode: "SFZ", documentId: "sfz:test", title: "Skúšobný poriadok",
      versions: [version("v1", "1.0", "2026-07-01", { isActive: false }), version("v2", "1.2", "2026-09-10")],
    }
    const html = await renderPage()
    expect(html).toContain("Pridelené znenie 1.0 už neplatí — nahradilo ho 1.2")
    expect(html).toContain("2 ľudia visia ako nepotvrdení")
    expect(html).not.toContain("zmizne úloha")
  })

  it("odvolané pridelenie už formulár neponúkne", async () => {
    state.assignment = assignment({ revokedAt: new Date() })
    const html = await renderPage()
    expect(html).toContain("Toto pridelenie už neplatí.")
    expect(html).not.toContain('name="reason"')
  })

  it("cudzie alebo neexistujúce pridelenie je „nenájdené“", async () => {
    state.assignment = null
    await expect(renderPage()).rejects.toThrow("notFound")
  })
})

describe("akcia odvolania", () => {
  it("zapíše dôvod a v hlásení povie, čo presne odvolala", async () => {
    const to = await submit({ id: "a1", reason: "  test ukončený  " })
    expect(state.revokeCalls).toEqual([["SFZ", "a1", "hr@sfz.sk", "test ukončený"]])
    expect(to).toContain("Odvolané: Skúšobný poriadok — oddelenie „Oddelenie IT")
    expect(to).not.toContain("error=1")
  })

  it("už odvolané hlási ako chybu, nie ako úspech", async () => {
    state.revoked = false
    const to = await submit({ id: "a1" })
    expect(to).toContain("Toto pridelenie už neplatí.")
    expect(to).toContain("error=1")
  })
})

describe("zoznam pridelení", () => {
  it("zoznam už neodvoláva priamo — vedie na potvrdenie", async () => {
    const { readFileSync } = await import("node:fs")
    const src = readFileSync(new URL("../src/app/hr/page.tsx", import.meta.url), "utf8")
    expect(src).not.toContain("revokeAction")
    expect(src).toContain("/revoke`")
  })
})

describe("slovo „publikum“ na obrazovke (30. 9. 2026)", () => {
  it("hlásenia a popisy prideľovania ho už nepoužívajú v žiadnom jazyku", async () => {
    const { dictionary } = await import("../src/lib/i18n")
    for (const lang of ["sk", "cs", "en"] as const) {
      const hr = dictionary(lang).hr
      const texts = [
        hr.actions.assigned(4, 2, 2), hr.actions.assignedWithExisting(4, 2, 2, 1),
        hr.actions.tooManyRecipients(300, 200), hr.actions.assignedOne("X — Y"),
      ]
      for (const text of texts) expect(text, `${lang}: ${text}`).not.toMatch(/publik|publík|audience/i)
    }
  })

  it("jedno pridelenie povie čo a komu", async () => {
    const { dictionary } = await import("../src/lib/i18n")
    expect(dictionary("sk").hr.actions.assignedOne("Skúšobný poriadok — oddelenie „Oddelenie IT\""))
      .toBe("Pridelené: Skúšobný poriadok — oddelenie „Oddelenie IT\".")
    expect(dictionary("sk").hr.actions.assigned(4, 2, 2)).toBe("Pridelené: 4 (2 normy × 2 adresáti).")
  })
})
