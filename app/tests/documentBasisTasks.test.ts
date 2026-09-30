/**
 * documentBasisTasks.test.ts — úloha zodpovednej osoby pri pripravovanom
 * a ešte neúčinnom znení (ADR-023, D139), bez databázy.
 *
 * Od 30. 9. 2026 (D151) je úloha na karte dokumentu v správe; zodpovedná
 * osoba bez roly správcu obsahu tam vidí len ju. Čitateľská karta slúži na
 * čítanie a potvrdenie a formulár na právny základ nemá nikto.
 *
 * Stráži to, čo `tsc` ani lint nevidia: že stránka v týchto stavoch **vôbec
 * vykreslí** a ponúkne formulár tomu, komu má — chyba pri vykresľovaní je
 * 200 s chybovou stránkou (CLAUDE.md, „Čo tieto štyri brzdy nevidia").
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({
  doc: null as Record<string, unknown> | null,
  draftTask: null as Record<string, unknown> | null,
  contentManager: false,
}))

const GARANT = { personId: "p-garant", fullName: "Garant Predpisu", email: "garant@sfz.sk" }

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/components/AcknowledgeButton", () => ({ default: () => null }))
vi.mock("@/components/ReadingTimer", () => ({ default: () => null }))
vi.mock("@/lib/session", () => ({
  onboardingContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", name: "SFZ" },
    person: { id: "p-garant", email: "garant@sfz.sk", companyCode: "SFZ", language: "sk", roles: [] },
  }),
}))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/documentOpens", () => ({ recordOpen: async () => {} }))
vi.mock("@/lib/assignments", () => ({ assignedAtByVersion: async () => new Map() }))
vi.mock("@/lib/pending", () => ({ acknowledgementDuties: async () => ({ fromTracks: [], outsideTracks: [] }) }))
vi.mock("@/lib/acknowledgements", () => ({ buildStatement: () => "formulka", hasAcknowledged: async () => false }))
vi.mock("@/lib/library", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/library")>()),
  isContentManager: () => state.contentManager,
  // Zodpovedná osoba bez roly správcu obsahu — karta v správe ju pustí len k úlohe.
  libraryContext: async () => ({ state: "forbidden" }),
}))
vi.mock("../src/app/library/actions", () => ({}))
vi.mock("@/lib/legalBases", () => ({
  legalBasisOptions: () => [
    { key: "bozp", basis: "legal_obligation", label: "BOZP", reference: "§ 7 zákona č. 124/2006 Z. z." },
    { key: "interna_smernica", basis: "legitimate_interest", label: "Interná smernica", reference: null },
  ],
}))
vi.mock("@/lib/documents", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/documents")>()),
  loadDocumentFor: async () => state.doc,
}))
vi.mock("@/lib/versionResponsibilityDb", () => ({
  draftBasisTaskFor: async () => state.draftTask,
  responsibleContact: async (_c: string, r: unknown) => (r ? { ...(r as object), mobilePhone: null, active: true } : null),
}))
vi.mock("../src/app/documents/[documentId]/actions", () => ({
  acknowledgeAction: async () => {},
  setLegalBasisAction: async () => {},
}))

const pdf = (id: string) => ({ id, name: `${id}.pdf`, bytes: 1_300_000, sha256: id, type: "pdf", uploadedAt: new Date(), uploadedBy: "x" })
const DAY = 24 * 60 * 60 * 1000
const current = {
  versionId: "v-old", label: "úplné znenie od 7. 9. 2026", isActive: true,
  effectiveFrom: new Date(Date.now() - 20 * DAY), effectiveTo: null,
  markdown: "# Čl. 1\nstarý text", pdf: pdf("old"),
  responsiblePerson: { personId: "p-iny", fullName: "Iná Osoba", email: "ina@sfz.sk" },
  legalBasis: "legitimate_interest", legalBasisLabel: "Interná smernica",
}

function doc(versions: unknown[] = [current]) {
  return { documentId: "sfz:pp", title: "Pracovný poriadok SFZ", companyCode: "SFZ", versions }
}

function draftTask(over: Record<string, unknown> = {}) {
  return {
    documentId: "sfz:pp", title: "Pracovný poriadok SFZ", draftTitle: null,
    draftMarkdown: "# Čl. 1\nnový text", draftPdf: { name: "novy.pdf", bytes: 250_000 },
    effectiveFrom: new Date("2026-10-01T00:00:00Z"), legalBasis: null, ...over,
  }
}

/** Karta dokumentu v správe — tam je úloha (D151). */
async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/library/[id]/page")
  const el = await Page({ params: Promise.resolve({ id: "sfz%3App" }), searchParams: Promise.resolve(query) })
  return renderToStaticMarkup(el)
}

/** Čitateľská karta — čítanie a potvrdenie. */
async function renderReader(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/documents/[documentId]/page")
  const el = await Page({ params: Promise.resolve({ documentId: "sfz%3App" }), searchParams: Promise.resolve(query) })
  return renderToStaticMarkup(el)
}

beforeEach(() => {
  state.doc = doc()
  state.draftTask = null
  state.contentManager = false
})

describe("pripravované znenie (ADR-023, D139)", () => {
  it("zodpovedná osoba vidí úlohu, PDF konceptu a formulár, ktorý ukladá na koncept", async () => {
    state.draftTask = draftTask()
    const html = await render()
    expect(html).toContain("Pripravované znenie — ste zodpovedná osoba")
    expect(html).toContain("/api/documents/sfz%3App/pdf?draft=1")
    expect(html).toContain('name="draft" value="1"')
    expect(html).toContain("Účinnosť od 1. 10. 2026")
    // Pri koncepte sa dôvod nepýta — nikto sa naň ešte nepotvrdil.
    expect(html).not.toContain('name="reason"')
    expect(html).toContain('name="back" value="library"')
    // Na čítanie a potvrdenie je čitateľská karta, sem len odkaz.
    expect(html).not.toContain("formulka")
    expect(html).toContain('href="/documents/sfz%3App"')
  })

  it("dokument, ktorý by inak nevidela, ukáže len úlohu — nič na potvrdenie", async () => {
    state.doc = null
    state.draftTask = draftTask({ draftTitle: "Pracovný poriadok SFZ 2027" })
    const html = await render()
    expect(html).toContain("Pracovný poriadok SFZ")
    expect(html).toContain("Nový názov: „Pracovný poriadok SFZ 2027&quot;")
    expect(html).toContain('name="draft" value="1"')
    expect(html).not.toContain("formulka")
  })

  it("kto nemá úlohu, ide na čitateľskú kartu ako doteraz", async () => {
    await expect(render()).rejects.toThrow("redirect /documents/sfz%3App")
  })

  it("určený základ sa zbalí so súhrnom a výber zostane zaškrtnutý", async () => {
    state.draftTask = draftTask({
      legalBasis: {
        entries: [{ basis: "legal_obligation", key: "bozp", label: "BOZP", reference: "§ 7 zákona č. 124/2006 Z. z." }],
        at: new Date(), by: "garant@sfz.sk",
      },
    })
    const html = await render()
    expect(html).toContain("Právny základ pripravovaného znenia: BOZP")
    expect(html).not.toContain("Pripravované znenie — ste zodpovedná osoba")
    expect(html).toMatch(/value="bozp" checked=""|checked="" value="bozp"/)
  })
})

describe("zverejnené, ešte neúčinné znenie (ADR-023)", () => {
  const future = {
    versionId: "v-new", label: "úplné znenie od 1. 12. 2099", isActive: true,
    effectiveFrom: new Date("2099-12-01T00:00:00Z"), effectiveTo: null,
    markdown: "# Čl. 1\nnový text", pdf: pdf("new"), responsiblePerson: GARANT,
  }

  it("zodpovedná osoba dostane formulár hneď po zverejnení, nie až v deň účinnosti", async () => {
    state.doc = doc([{ ...current, isActive: false }, future])
    const html = await render()
    expect(html).toContain("Znenie účinné od 1. 12. 2099 — ste zodpovedná osoba")
    expect(html).toContain('name="versionId" value="v-new"')
    expect(html).toContain("/api/documents/sfz%3App/pdf?version=v-new")
    expect(html).toContain('name="back" value="library"')
    // Platné znenie má inú zodpovednú osobu — to nie je jej úloha.
    expect(html).not.toContain('name="versionId" value="v-old"')
  })

  it("čitateľ do účinnosti vidí doterajšie znenie a môže ho potvrdiť — bez formulára na základ (D143, D151)", async () => {
    // Presne stav po `publish()`: staré je neaktívne s koncom = začiatok nového.
    state.doc = doc([{ ...current, isActive: false, effectiveTo: future.effectiveFrom }, future])
    const html = await renderReader()
    expect(html).not.toContain("platnosť sa ešte nezačala")
    expect(html).toContain("/api/documents/sfz%3App/pdf?version=v-old")
    expect(html).toContain("formulka")
    // Aj zodpovedná osoba novely tu len číta a potvrdzuje.
    expect(html).not.toContain("ste zodpovedná osoba")
    expect(html).not.toContain('name="versionId"')
  })

  it("ani správca obsahu nemá na čitateľskej karte formulár (D151)", async () => {
    state.contentManager = true
    state.doc = doc([{ ...current, responsiblePerson: undefined, legalBasis: undefined, legalBasisLabel: undefined }])
    const html = await renderReader()
    expect(html).toContain("formulka")
    expect(html).not.toContain('name="versionId"')
    expect(html).not.toContain('name="draft"')
  })

  it("iný človek formulár k cudziemu zneniu nedostane — ide na čitateľskú kartu", async () => {
    state.doc = doc([{ ...current, isActive: false }, { ...future, responsiblePerson: { personId: "p-iny", fullName: "Iná", email: "ina@sfz.sk" } }])
    await expect(render()).rejects.toThrow("redirect /documents/sfz%3App")
  })

  it("s určeným základom je karta zbalená a zmena pýta dôvod", async () => {
    state.doc = doc([{ ...current, isActive: false }, { ...future, legalBasis: "legal_obligation", legalBasisLabel: "BOZP", legalBasisKey: "bozp" }])
    const html = await render()
    expect(html).toContain("Právny základ znenia účinného od 1. 12. 2099: BOZP")
    expect(html).toContain('name="reason"')
  })
})
