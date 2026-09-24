/**
 * libraryDetailFlow.test.ts — detail dokumentu vykreslený v každom kroku
 * postupu znenia (ADR-014) bez databázy.
 *
 * Nie je to test vzhľadu. Stráži to, čo `tsc` ani lint nevidia: že stránka
 * v danom stave **vôbec vykreslí** a ponúkne správny formulár — chyba pri
 * vykresľovaní servera je 200 s chybovou stránkou (CLAUDE.md, „Čo tieto
 * štyri brzdy nevidia").
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { ApprovalRound } from "../src/lib/approvals"

/** Serverové akcie ako prázdne funkcie — formulár ich potrebuje len ako hodnotu `action`. */
const stubs = vi.hoisted(() => (names: string[]) => Object.fromEntries(names.map(n => [n, async () => {}])))

const state = vi.hoisted(() => ({
  detail: null as Record<string, unknown> | null,
  rounds: new Map<string, unknown[]>(),
  carryOver: [] as unknown[],
}))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/library", () => ({
  libraryContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", name: "SFZ" },
    person: { id: "p-jan", email: "jan@sfz.sk", companyCode: "SFZ", language: "sk", roles: ["hr", "content"] },
  }),
}))
vi.mock("@/lib/hr", () => ({ isHr: () => true }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/codelistsTenant", () => ({ tenantExtras: () => ({}) }))
vi.mock("@/lib/legalBases", () => ({ legalBasisOptions: () => [] }))
vi.mock("@/lib/folders", () => ({ allFolders: async () => [], flattenTree: () => [] }))
vi.mock("@/lib/departments", () => ({ allDepartments: async () => [], flattenTree: () => [] }))
vi.mock("@/lib/people", () => ({
  listPeople: async () => [
    { id: "p-jan", fullName: "Ján Letko", email: "jan@sfz.sk", status: "active" },
    { id: "p-marek", fullName: "Marek Horák", email: "marek@sfz.sk", status: "active", department: "Právne" },
    { id: "p-peter", fullName: "Peter Kováč", email: "peter@sfz.sk", status: "active" },
  ],
}))
vi.mock("@/lib/libraryProgress", () => ({ documentProgress: async () => ({ percent: null, acknowledged: 0, assigned: 0 }) }))
vi.mock("@/lib/acknowledgements", () => ({ validAcknowledgements: async () => [] }))
vi.mock("@/lib/assignments", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/assignments")>()),
  carryOverCandidates: async () => state.carryOver,
}))
vi.mock("@/lib/approvalsDb", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/approvalsDb")>()),
  roundsByVersion: async () => state.rounds,
}))
vi.mock("@/lib/libraryRead", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/libraryRead")>()),
  libraryDetail: async () => state.detail,
  versionMetaSuggestions: async () => ({ authors: [], approvers: [] }),
  tagOptions: async () => [],
}))
vi.mock("@/app/documents/[documentId]/actions", () => stubs(["acknowledgeAction","setLegalBasisAction"]))
vi.mock("@/lib/session", () => ({}))
vi.mock("../src/app/library/actions", () => stubs(["uploadAction","uploadVersionAction","saveTextAction","saveDraftMetaAction","prepareDraftAction","publishVersionAction","previewId","sendToModelAction","decideOnDraftAction","carryOverAssignmentsAction","saveDocumentMetadataAction","createFolderAction","renameFolderAction","moveFolderAction","deleteFolderAction","assignToFolderAction","moveManyAction","assignManyAction","reindexDocumentAction","fixVersionAction","setResponsibleAction","revokeVersionAction","fixTextAction","shiftFolderAction","saveFolderOrderAction","submitForApprovalAction","cancelApprovalAction"]))

const pdf = (id: string) => ({ id, name: `${id}.pdf`, bytes: 1_300_000, sha256: id, type: "pdf", uploadedAt: new Date(), uploadedBy: "jan@sfz.sk" })
const effective = {
  versionId: "v-old", label: "úplné znenie od 7. 9. 2026", isActive: true,
  effectiveFrom: new Date("2026-09-07T00:00:00Z"), effectiveTo: null,
  publishedAt: new Date("2026-09-10T00:00:00Z"), markdown: "# Čl. 1\nstarý text", pdf: pdf("old"),
  responsiblePerson: { personId: "p-jan", fullName: "Ján Letko", email: "jan@sfz.sk" },
}
const meta = { author: "Oddelenie ĽZ", approvedBy: "VV SFZ", approvedOn: new Date("2026-09-22T00:00:00Z"), effectiveFrom: new Date("2026-10-01T00:00:00Z") }

function detail(over: Record<string, unknown> = {}) {
  return {
    documentId: "sfz:pp", title: "Pracovný poriadok SFZ", status: "published", processingState: "indexed",
    tags: [], versions: [effective], effectiveVersionId: "v-old", effectiveLabel: effective.label,
    draftMarkdown: "# Čl. 1\nnový text", markdown: "# Čl. 1\nstarý text",
    draftPdf: pdf("new"), draftSource: null, draftMeta: meta, draftMetaSuggestion: null, draftResponsible: null,
    companyCode: "SFZ", editableText: "", folderTrail: [],
    ...over,
  }
}

async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/library/[id]/page")
  const el = await Page({ params: Promise.resolve({ id: "sfz%3App" }), searchParams: Promise.resolve(query) })
  return renderToStaticMarkup(el)
}

async function draftId() {
  const { documentDraftIdentity } = await import("../src/lib/versionMeta")
  const d = detail()
  return documentDraftIdentity({ draftMarkdown: String(d.draftMarkdown).trim(), draftPdf: d.draftPdf, draftMeta: d.draftMeta })
}

const round = (over: Partial<ApprovalRound>): ApprovalRound => ({
  companyCode: "SFZ", documentId: "sfz:pp", versionId: "x", round: 1,
  submittedBy: "jan@sfz.sk", submittedAt: new Date("2026-09-24T08:00:00Z"),
  approvers: [
    { email: "marek@sfz.sk", fullName: "Marek Horák", decidedAt: new Date("2026-09-25T00:00:00Z"), decision: "approved" },
    { email: "peter@sfz.sk", fullName: "Peter Kováč", decidedAt: null, decision: null },
  ],
  closedAt: null, outcome: null, ...over,
})

beforeEach(() => {
  state.detail = detail()
  state.rounds = new Map()
  state.carryOver = []
})

describe("detail — postup znenia", () => {
  it("krok 1: jeden formulár s dvomi tlačidlami a schvaľovateľmi z posledného kola", async () => {
    // Staršie kolo na platnom znení — z neho sa predvyplnia schvaľovatelia (Q2).
    state.rounds = new Map([["v-old", [round({ versionId: "v-old", submittedAt: new Date("2026-09-01T00:00:00Z"), outcome: "approved" })]]])
    const html = await render()
    expect(html).toContain("Nové znenie od 1. 10. 2026")
    expect(html).toContain('aria-current="step"')
    expect(html).toContain("Uložiť a predložiť na schválenie")
    expect(html).toContain("Len uložiť")
    expect(html).toMatch(/value="p-marek" checked=""|checked="" value="p-marek"/)
    // Tlačidlo v hlavičke je počas prípravy neaktívne.
    expect(html).toContain('aria-disabled="true"')
  })

  it("krok 1 po zamietnutí ukáže dôvod doslova", async () => {
    state.rounds = new Map([["x", [round({
      outcome: "rejected", closedAt: new Date("2026-09-25T00:00:00Z"),
      approvers: [{ email: "peter@sfz.sk", fullName: "Peter Kováč", decidedAt: new Date("2026-09-25T00:00:00Z"), decision: "rejected", reason: "Článok 4 odkazuje na zrušenú smernicu." }],
    })]]])
    const html = await render()
    expect(html).toContain("Peter Kováč zamietol 25. 9. 2026")
    expect(html).toContain("Článok 4 odkazuje na zrušenú smernicu.")
  })

  it("krok 2: stav kola, čo sa schvaľuje a stiahnutie kola", async () => {
    state.rounds = new Map([[await draftId(), [round({})]]])
    const html = await render()
    expect(html).toContain("Čaká na schválenie — 1 z 2")
    expect(html).toContain("Čo sa schvaľuje")
    expect(html).toContain("Stiahnuť kolo")
    expect(html).not.toContain("Uložiť a predložiť")
  })

  it("krok 3: návrh označenia, osoba z prípravy a prenos pridelení", async () => {
    state.detail = detail({ draftResponsible: { personId: "p-marek", fullName: "Marek Horák", email: "marek@sfz.sk" } })
    state.rounds = new Map([[await draftId(), [round({
      outcome: "approved", closedAt: new Date("2026-09-25T00:00:00Z"),
      approvers: [{ email: "marek@sfz.sk", fullName: "Marek Horák", decidedAt: new Date(), decision: "approved" }],
    })]]])
    state.carryOver = [{ audience: { kind: "all" }, previousReason: "nástup" }]
    const html = await render()
    expect(html).toContain('value="úplné znenie od 1. 10. 2026"')
    expect(html).toContain("Zodpovedná osoba: Marek Horák. Určená v príprave.")
    expect(html).toContain('name="carryOver"')
    expect(html).toContain("Zverejniť a prideliť")
  })

  it("krok 4: po zverejnení s publikami z predošlého znenia", async () => {
    state.detail = detail({ draftMarkdown: effective.markdown, draftPdf: effective.pdf, draftMeta: null })
    state.carryOver = [{ audience: { kind: "all" }, previousReason: "nástup" }]
    const html = await render()
    expect(html).toContain("Znenie od 7. 9. 2026")
    expect(html).toContain("Prideliť vybraným")
  })

  it("bez prípravy a prenosu nie je karta, platné znenie je súhrn s panelom v adrese", async () => {
    state.detail = detail({ draftMarkdown: effective.markdown, draftPdf: effective.pdf })
    const html = await render({ open: "fix" })
    expect(html).not.toContain('class="card flow"')
    expect(html).toContain("Platné znenie")
    expect(html).toContain("Dôvod opravy")
  })
})
