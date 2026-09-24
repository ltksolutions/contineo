/**
 * approvalsPage.test.ts — obrazovka schvaľovateľa vykreslená bez databázy
 * (rám APPROVALS-pdf-konceptu): jedno kolo rozbalené, viac kôl ako riadky,
 * zmenený koncept s upozornením a aktívnym „Schváliť" (Q3 = nie).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { ApprovalRound } from "../src/lib/approvals"

const state = vi.hoisted(() => ({
  rounds: [] as ApprovalRound[],
  docs: [] as Record<string, unknown>[],
}))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/session", () => ({
  onboardingContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", name: "SFZ" },
    person: { id: "p-marek", email: "marek@sfz.sk", companyCode: "SFZ", language: "sk" },
  }),
}))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/approvalsDb", () => ({ roundsWaitingFor: async () => state.rounds }))
vi.mock("@/lib/people", () => ({
  listPeople: async () => [{ id: "p-jan", fullName: "Ján Letko", email: "jan@sfz.sk", status: "active" }],
}))
vi.mock("@/lib/mongodb", () => ({
  getCollection: async () => ({ find: () => ({ toArray: async () => state.docs }) }),
}))
vi.mock("../src/app/approvals/actions", () => ({ decideAction: async () => {} }))

const meta = { author: "Oddelenie ĽZ", approvedBy: "VV SFZ", approvedOn: null, effectiveFrom: new Date("2026-10-01T00:00:00Z") }
const draftPdf = { id: "f1", name: "pp.pdf", bytes: 1_300_000, sha256: "abc", type: "pdf", uploadedAt: new Date(), uploadedBy: "jan@sfz.sk" }

async function draftIdOf(doc: Record<string, unknown>) {
  const { documentDraftIdentity } = await import("../src/lib/versionMeta")
  return documentDraftIdentity(doc as never)
}

function doc(documentId: string, over: Record<string, unknown> = {}) {
  return {
    documentId, title: `Dokument ${documentId}`, draftMarkdown: "# Čl. 1\ntext", draftPdf, draftMeta: meta,
    versions: [{ versionId: "v-old", label: "staré", isActive: true, effectiveFrom: new Date("2026-01-01T00:00:00Z") }],
    ...over,
  }
}

const round = (documentId: string, versionId: string, over: Partial<ApprovalRound> = {}): ApprovalRound => ({
  companyCode: "SFZ", documentId, versionId, round: 1,
  submittedBy: "jan@sfz.sk", submittedAt: new Date("2026-09-24T08:00:00Z"),
  note: "Zmena článkov 12 a 14.",
  approvers: [
    { email: "marek@sfz.sk", fullName: "Marek Horák", decidedAt: null, decision: null },
    { email: "peter@sfz.sk", fullName: "Peter Kováč", decidedAt: null, decision: null },
  ],
  closedAt: null, outcome: null, ...over,
})

async function render() {
  const { default: Page } = await import("../src/app/approvals/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
}

beforeEach(() => {
  state.rounds = []
  state.docs = []
})

describe("/approvals", () => {
  it("jedno kolo: štítok znenia namiesto versionId, údaje, poznámka a ostatní", async () => {
    const d = doc("sfz:pp")
    state.docs = [d]
    state.rounds = [round("sfz:pp", await draftIdOf(d))]
    const html = await render()
    expect(html).toContain("Nové znenie od 1. 10. 2026")
    expect(html).toContain("1. kolo · predložil Ján Letko")
    expect(html).toContain("Čo schvaľuješ")
    expect(html).toContain("Poznámka od predkladateľa")
    expect(html).toContain("Peter Kováč")
    expect(html).not.toContain("Marek Horák</span>") // seba medzi „Rozhodujú aj" nevidí
    expect(html).not.toContain("ap-fold")
  })

  it("dokument bez platného znenia je „Prvé znenie od …“", async () => {
    const d = doc("sfz:nova", { versions: [] })
    state.docs = [d]
    state.rounds = [round("sfz:nova", await draftIdOf(d))]
    expect(await render()).toContain("Prvé znenie od 1. 10. 2026")
  })

  it("dve kolá sú riadky s „Prečítať a rozhodnúť“", async () => {
    const a = doc("sfz:a"), b = doc("sfz:b")
    state.docs = [a, b]
    state.rounds = [round("sfz:a", await draftIdOf(a)), round("sfz:b", await draftIdOf(b))]
    const html = await render()
    expect(html.match(/ap-fold/g)?.length).toBe(2)
    expect(html).toContain("Prečítať a rozhodnúť")
  })

  it("zmenený koncept: upozornenie hore a „Schváliť“ aktívne", async () => {
    state.docs = [doc("sfz:pp")]
    state.rounds = [round("sfz:pp", "stara-identita")]
    const html = await render()
    expect(html).toContain('class="ap-warn"')
    expect(html).toMatch(/<button class="button" type="submit" name="decision" value="approved">/)
  })
})
