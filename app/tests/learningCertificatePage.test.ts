/**
 * learningCertificatePage.test.ts — certifikát pre držiteľa (rám CERTIFICATE):
 * platný s overovacím odkazom a tlačou, odvolaný s dôvodom (vidí len
 * držiteľ), bez tlače a bez overovacieho bloku.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Certificate } from "../src/lib/certificates"

const s = vi.hoisted(() => ({ cert: null as unknown }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") }, redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/CopyLink", () => ({ default: () => null }))
vi.mock("@/lib/learning", () => ({ learningContext: async () => ({ state: "ready", person: { id: "p", companyCode: "SFZ", language: "sk" }, tenant: { companyCode: "SFZ", hostnames: ["sfz.localhost", "intranet.futbalsfz.sk"] } }) }))
vi.mock("@/lib/coursesDb", () => ({ getCourse: async () => ({ key: "bozp", title: "BOZP", versions: [{ versionId: "v2", version: 2, title: "Bezpečnosť v sídle", issuesCertificate: true, parts: [] }] }) }))
vi.mock("@/lib/enrollmentsDb", () => ({ enrollmentFor: async () => ({ id: "e1", versionId: "v2", cancelledAt: null }) }))
vi.mock("@/lib/certificatesDb", () => ({ ensureCertificate: async () => s.cert, withHolderGender: async (c: unknown) => c }))

const at = new Date("2026-09-18T00:00:00Z")
const cert = (over: Partial<Certificate> = {}): Certificate => ({
  id: "c1", companyCode: "SFZ", type: "course", enrollmentId: "e1", personId: "p", holderName: "Marek Horák", courseKey: "bozp", versionId: "v2",
  courseTitle: "Bezpečnosť v sídle", courseVersion: 2, partsCount: 6, testsPassed: 2, completedAt: at, issuedAt: at,
  issuedBy: { kind: "tenant", name: "Slovenský futbalový zväz", logoUrl: "/tenants/sfz.svg" },
  registrationNumber: "SFZ-2026-0198", verificationHash: "abcdefghijkmnpqr", revokedAt: null, ...over,
})
async function render() {
  const { default: Page } = await import("../src/app/learning/[courseKey]/certificate/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ courseKey: "bozp" }), searchParams: Promise.resolve({}) }))
}
beforeEach(() => { s.cert = cert() })

describe("/learning/[courseKey]/certificate", () => {
  it("platný: meno, číslo, logo organizácie, PDF, tlač a overovací odkaz (doména, nie localhost)", async () => {
    const html = await render()
    expect(html).toContain("Marek Horák")
    // Pohlavie nevyplnené → zátvorkový tvar.
    expect(html).toContain("absolvoval(a) kurz Bezpečnosť v sídle (verzia 2)")
    expect(html).toContain('src="/tenants/sfz.svg"')
    expect(html).toContain('href="/learning/bozp/certificate/pdf"')
    expect(html).toContain("Stiahnuť PDF")
    expect(html).toContain('href="/learning/bozp/certificate/print"')
    expect(html).toContain("https://intranet.futbalsfz.sk/verify/SFZ-2026-0198?h=abcdefghijkmnpqr")
  })
  it("odvolaný: dôvod pre držiteľa, bez tlače a overenia", async () => {
    s.cert = cert({ revokedAt: new Date("2026-09-22T00:00:00Z"), revokedReason: "chybné údaje" })
    const html = await render()
    expect(html).toContain("Certifikát bol odvolaný 22. 9. 2026. Dôvod: chybné údaje")
    expect(html).toContain('disabled="" aria-disabled="true"')
    expect(html).not.toContain("/verify/")
    expect(html).not.toContain("/certificate/pdf")
    expect(html).toContain("Pri odvolanom certifikáte sa PDF ani tlač neponúka.")
  })
  it("pohlavie v kópii: absolvoval / absolvovala", async () => {
    s.cert = cert({ holderGender: "female" })
    expect(await render()).toContain("absolvovala kurz Bezpečnosť v sídle")
    s.cert = cert({ holderGender: "male" })
    expect(await render()).toContain("absolvoval kurz Bezpečnosť v sídle")
  })
  it("ešte nevydaný: veta", async () => {
    s.cert = null
    expect(await render()).toContain("Certifikát sa vydá po dokončení kurzu.")
  })
})
