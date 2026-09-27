/**
 * learningVerifyPage.test.ts — verejné overenie (rám CERTIFICATE): platný
 * bez mena, odvolaný bez dôvodu, zlé číslo aj hash = 404; logo Contineo
 * bez loga organizácie.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { Certificate } from "../src/lib/certificates"

const s = vi.hoisted(() => ({ cert: null as unknown }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") } }))
vi.mock("@/lib/session", () => ({ currentTenant: async () => ({ companyCode: "SFZ", defaultLanguage: "sk" }) }))
vi.mock("@/lib/certificatesDb", () => ({ certificateToVerify: async (_c: string, n: string, h: string) => (n === "SFZ-2026-0198" && h === "abcdefghijkmnpqr" ? s.cert : null) }))

const at = new Date("2026-09-18T00:00:00Z")
const cert = (over: Partial<Certificate> = {}): Certificate => ({
  id: "c1", companyCode: "SFZ", type: "course", enrollmentId: "e1", personId: "p", holderName: "Marek Horák", courseKey: "bozp", versionId: "v2",
  courseTitle: "Bezpečnosť v sídle SFZ", courseVersion: 2, partsCount: 6, testsPassed: 2, completedAt: at, issuedAt: at,
  issuedBy: { kind: "tenant", name: "Slovenský futbalový zväz", address: "Tomášikova 30C", registrationNumber: "00 687 308" },
  registrationNumber: "SFZ-2026-0198", verificationHash: "abcdefghijkmnpqr", revokedAt: null, ...over,
})
async function render(number: string, h: string) {
  const { default: Page } = await import("../src/app/verify/[registrationNumber]/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ registrationNumber: number }), searchParams: Promise.resolve({ h }) }))
}

beforeEach(() => { s.cert = cert() })

describe("/verify", () => {
  it("platný: kurz, vydavateľ s IČO, bez mena, logo Contineo", async () => {
    const html = await render("SFZ-2026-0198", "abcdefghijkmnpqr")
    expect(html).toContain("Certifikát je platný — vydal ho Slovenský futbalový zväz")
    expect(html).toContain("IČO 00 687 308")
    expect(html).not.toContain("Marek Horák")
    expect(html).toContain("<svg")
  })
  it("odvolaný: dátum, dôvod nie", async () => {
    s.cert = cert({ revokedAt: new Date("2026-09-22T00:00:00Z"), revokedReason: "podvod pri teste" })
    const html = await render("SFZ-2026-0198", "abcdefghijkmnpqr")
    expect(html).toContain("Certifikát bol odvolaný — 22. 9. 2026.")
    expect(html).not.toContain("podvod")
  })
  it("zlé číslo aj zlý hash: rovnako 404", async () => {
    await expect(render("SFZ-2026-0198", "zly")).rejects.toThrow("notFound")
    await expect(render("SFZ-2026-0199", "abcdefghijkmnpqr")).rejects.toThrow("notFound")
  })
})
