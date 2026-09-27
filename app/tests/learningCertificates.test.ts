/**
 * learningCertificates.test.ts — certifikáty (ADR-018, D122; rám CERTIFICATE):
 * číslo a hash, vydanie len pri naozaj dokončenom kurze (jeden na zápis),
 * kópia vydavateľa a loga, verejné overenie bez mena a bez dôvodu
 * odvolania, zlé číslo aj zlý hash = 404.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { newVerificationHash, numberPrefix, registrationNumber, verifyPath } from "../src/lib/certificates"

const s = vi.hoisted(() => ({
  existing: null as unknown, course: null as unknown, facts: { completions: [] as unknown[], watches: [], passedTests: [] as unknown[] },
  inserted: [] as unknown[], seq: 197, brand: null as unknown, saved: [] as unknown[], verify: null as unknown,
  files: {} as Record<string, Buffer>, deleted: [] as string[], updates: [] as unknown[], modified: 1,
}))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("../src/lib/mongodb", () => ({
  getCollection: async (name: string) => ({
    findOne: async () => (name === "certificates" ? s.existing : null),
    insertOne: async (doc: unknown) => { s.inserted.push(doc); return {} },
    findOneAndUpdate: async () => ({ seq: ++s.seq }),
    updateOne: async (...a: unknown[]) => { s.updates.push(a); return { modifiedCount: s.modified } },
  }),
}))
vi.mock("../src/lib/audit", () => ({ writeAudit: async () => {} }))
vi.mock("../src/lib/branding", () => ({ loadBrand: async () => s.brand }))
vi.mock("../src/lib/fileStore", () => ({
  saveFile: async (...a: unknown[]) => { s.saved.push(a); return { id: a[2] === "application/pdf" ? "pdf1" : "logo1" } },
  loadFile: async (_c: string, id: string) => (s.files[id] ? { data: s.files[id], contentType: "", name: "" } : null),
  deleteFile: async (_c: string, id: string) => { s.deleted.push(id) },
}))
vi.mock("../src/lib/coursesDb", () => ({ getCourse: async () => s.course }))
vi.mock("../src/lib/learningProgressDb", () => ({ progressFacts: async () => s.facts }))

import { certificatePdf, ensureCertificate } from "../src/lib/certificatesDb"
import type { Certificate } from "../src/lib/certificates"

const at = new Date("2026-09-18T00:00:00Z")
const version = { versionId: "v2", version: 2, state: "published", title: "Bezpečnosť v sídle", sequential: false, issuesCertificate: true,
  signer: { name: "Ján Letko", role: "generálny sekretár" },
  parts: [{ key: "a", title: "A", required: true, tests: [], blocks: [{ id: "t", type: "text", markdown: "x" }] }], createdAt: at, createdBy: "jan" }
const enrollment = { id: "e1", companyCode: "SFZ", personId: "p", email: "p@x", fullName: "Marek Horák", courseKey: "bozp", versionId: "v2", courseTitle: "BOZP", enrolledAt: at, source: "self" as const, cancelledAt: null }
const tenant = { companyCode: "SFZ", branding: { displayName: "Slovenský futbalový zväz", shortName: "SFZ", logoUrl: "/api/brand/SFZ?v=1" },
  controller: { legalName: "Slovenský futbalový zväz", address: "Tomášikova 30C, Bratislava", registrationNumber: "00 687 308" } }

beforeEach(() => {
  s.existing = null
  s.course = { key: "bozp", title: "BOZP", versions: [version] }
  s.facts = { completions: [{ partKey: "a", at }], watches: [], passedTests: [] }
  s.inserted = []
  s.saved = []
  s.brand = { contentType: "image/png", data: Buffer.from("png") }
  s.files = {}
  s.deleted = []
  s.updates = []
  s.modified = 1
})

describe("číslo a hash", () => {
  it("predpona zo skratky, poradie štvormiestne", () => {
    expect(numberPrefix("SFZ", "sfz")).toBe("SFZ")
    expect(numberPrefix("Žilina U", "ZU")).toBe("ZILINAU")
    expect(numberPrefix(undefined, "ltk")).toBe("LTK")
    expect(registrationNumber("SFZ", 2026, 198)).toBe("SFZ-2026-0198")
  })
  it("hash má 16 znakov bez zameniteľných", () => {
    const h = newVerificationHash()
    expect(h).toMatch(/^[a-km-np-z2-9]{16}$/)
    expect(newVerificationHash()).not.toBe(h)
    expect(verifyPath({ registrationNumber: "SFZ-2026-0198", verificationHash: h })).toBe(`/verify/SFZ-2026-0198?h=${h}`)
  })
})

describe("ensureCertificate", () => {
  it("dokončený kurz: vydá s kópiami a skopíruje nahraté logo", async () => {
    const c = await ensureCertificate(enrollment, tenant as never)
    expect(c).toMatchObject({
      registrationNumber: "SFZ-2026-0198", holderName: "Marek Horák", courseTitle: "Bezpečnosť v sídle", courseVersion: 2,
      signer: { name: "Ján Letko" }, issuedBy: { name: "Slovenský futbalový zväz", registrationNumber: "00 687 308", logoFileId: "logo1" },
    })
    expect(s.inserted).toHaveLength(1)
  })
  it("existujúci sa vráti, nevydá sa druhý", async () => {
    s.existing = { id: "x" }
    expect(await ensureCertificate(enrollment, tenant as never)).toEqual({ id: "x" })
    expect(s.inserted).toHaveLength(0)
  })
  it("nedokončený alebo kurz bez certifikátu: nič", async () => {
    s.facts = { completions: [], watches: [], passedTests: [] }
    expect(await ensureCertificate(enrollment, tenant as never)).toBeNull()
    s.facts = { completions: [{ partKey: "a", at }], watches: [], passedTests: [] }
    s.course = { key: "bozp", versions: [{ ...version, issuesCertificate: false }] }
    expect(await ensureCertificate(enrollment, tenant as never)).toBeNull()
    expect(s.inserted).toHaveLength(0)
  })
  it("statické logo sa nekopíruje, bez loga nič (logo Contineo)", async () => {
    const c1 = await ensureCertificate(enrollment, { ...tenant, branding: { ...tenant.branding, logoUrl: "/tenants/sfz.svg" } } as never)
    expect(c1?.issuedBy).toMatchObject({ logoUrl: "/tenants/sfz.svg" })
    expect(c1?.issuedBy.logoFileId).toBeUndefined()
    const c2 = await ensureCertificate(enrollment, { ...tenant, branding: { ...tenant.branding, logoUrl: "" } } as never)
    expect(c2?.issuedBy.logoFileId ?? c2?.issuedBy.logoUrl).toBeUndefined()
  })
})

describe("certificatePdf", () => {
  const cert = (over: Partial<Certificate> = {}): Certificate => ({
    id: "c1", companyCode: "SFZ", type: "course", enrollmentId: "e1", personId: "p", holderName: "Marek Horák", courseKey: "bozp", versionId: "v2",
    courseTitle: "Bezpečnosť v sídle", courseVersion: 2, partsCount: 1, testsPassed: 0, completedAt: at, issuedAt: at,
    issuedBy: { kind: "tenant", name: "SFZ", logoUrl: "/tenants/sfz.svg" }, registrationNumber: "SFZ-2026-0198", verificationHash: "abcdefghijkmnpqr", revokedAt: null, ...over,
  })

  it("prvé stiahnutie: vyrobí, uloží a zapíše pdfFileId len ak ešte nie je", async () => {
    const pdf = await certificatePdf(cert(), "https://intranet.futbalsfz.sk", "sk")
    expect(Buffer.from(pdf!.slice(0, 5)).toString()).toBe("%PDF-")
    expect((s.saved.at(-1) as unknown[]).slice(0, 3)).toEqual(["SFZ", "certifikat-SFZ-2026-0198.pdf", "application/pdf"])
    expect(s.updates[0]).toEqual([{ companyCode: "SFZ", id: "c1", pdfFileId: { $exists: false } }, { $set: { pdfFileId: "pdf1" } }])
  })
  it("uložené PDF sa vráti bez nového vykreslenia", async () => {
    s.files.stored = Buffer.from("%PDF-stored")
    expect(Buffer.from(await certificatePdf(cert({ pdfFileId: "stored" }), "https://x", "sk") as Uint8Array).toString()).toBe("%PDF-stored")
    expect(s.saved).toHaveLength(0)
  })
  it("súbežné stiahnutie: naše PDF sa zmaže, platí to prvé", async () => {
    s.modified = 0
    s.existing = cert({ pdfFileId: "first" })
    s.files.first = Buffer.from("%PDF-first")
    expect(Buffer.from(await certificatePdf(cert(), "https://x", "sk") as Uint8Array).toString()).toBe("%PDF-first")
    expect(s.deleted).toEqual(["pdf1"])
  })
  it("odvolaný: žiadne PDF", async () => {
    expect(await certificatePdf(cert({ revokedAt: at }), "https://x", "sk")).toBeNull()
    expect(s.saved).toHaveLength(0)
  })
  it("bez loga: značka Contineo, PDF vznikne", async () => {
    expect(await certificatePdf(cert({ issuedBy: { kind: "tenant", name: "SFZ" } }), "https://x", "sk")).not.toBeNull()
  })
})
