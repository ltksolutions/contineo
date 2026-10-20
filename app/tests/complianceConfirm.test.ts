/**
 * complianceConfirm.test.ts — potvrdenie pred spustením, zastavenie a
 * zrušenie kontroly (ADR-036, Ján 20. 10. 2026).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({
  updates: [] as { filter: Record<string, unknown>; update: Record<string, unknown> }[],
  matched: 1,
  preview: null as unknown,
  started: 0,
}))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/server", () => ({ after: () => {} }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("../src/lib/mongodb", () => ({
  getCollection: async () => ({
    updateOne: async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      state.updates.push({ filter, update })
      return { matchedCount: state.matched }
    },
  }),
}))
vi.mock("@/lib/complianceAccess", () => ({
  complianceContext: async () => ({
    state: "ready", isReviewer: true,
    tenant: { companyCode: "SFZ", name: "SFZ" },
    person: { id: "p1", email: "jan@sfz.sk", companyCode: "SFZ", language: "sk" },
  }),
  complianceViewContext: async () => ({ state: "ready" }),
}))
vi.mock("@/lib/channels", () => ({ listChannels: async () => [{ key: "issf", name: "ISSF Helpdesk" }] }))
vi.mock("@/lib/tenants", async importOriginal => ({ ...(await importOriginal<typeof import("../src/lib/tenants")>()), brandingView: () => ({}) }))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/complianceCheck", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/complianceCheck")>()),
  previewRun: async () => state.preview,
  startDocumentReview: async () => { state.started++; return { runId: "r9" } },
  startHelpdeskReview: async () => { state.started++; return { runId: "r9" } },
}))

// Kontrola a kolá (D239): spustenie založí kontrolu a jej prvé kolo.
vi.mock("@/lib/complianceChecks", () => ({
  createCheck: async () => ({ checkId: "c1" }),
  startCheckRound: async () => { state.started++; return { runId: "r9" } },
  archiveCheck: async () => {},
  renameCheck: async () => {},
  roundsOf: async () => [],
  checkById: async () => null,
}))

import { startDocumentReviewAction, startHelpdeskReviewAction } from "../src/app/library/complianceActions"
import { stopRun, archiveRun, sameTask } from "../src/lib/complianceCheck"

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try { await p } catch (e) { return String((e as Error).message) }
  return ""
}
function form(fields: [string, string][]): FormData {
  const fd = new FormData()
  for (const [k, v] of fields) fd.append(k, v)
  return fd
}

const basePreview = {
  kind: "helpdesk", questions: 51, model: "claude-opus-5-5", fromHierarchy: true,
  subjects: [{ documentId: "m1", title: "Konto a prihlásenie", state: "draft" }],
  references: [{ documentId: "s1", title: "Stanovy SFZ" }],
  estimate: { usd: 4.66, minutes: 9, from: new Date("2026-10-13") },
  running: null, openInLast: null,
}

beforeEach(() => { Object.assign(state, { updates: [], matched: 1, preview: { ...basePreview }, started: 0 }) })

describe("spustenie len po potvrdení", () => {
  it("formulár bez potvrdenia nespustí nič a vedie na rekapituláciu s tým istým zadaním", async () => {
    const to = await redirectOf(startDocumentReviewAction(form([["subjectIds", "m1"], ["subjectIds", "m2"], ["documentIds", "s1"], ["name", "Manuály"]])))
    expect(to).toContain("/library/compliance/confirm?kind=documents")
    expect(to).toContain("subjectIds=m1&subjectIds=m2")
    expect(to).toContain("documentIds=s1")
    expect(state.started).toBe(0)
  })

  it("návrhy z helpdesku tiež", async () => {
    const to = await redirectOf(startHelpdeskReviewAction(form([["channelKey", "issf"]])))
    expect(to).toContain("kind=helpdesk")
    expect(to).toContain("channelKey=issf")
    expect(state.started).toBe(0)
  })

  it("s potvrdením sa založí kontrola a spustí jej prvé kolo", async () => {
    const to = await redirectOf(startHelpdeskReviewAction(form([["channelKey", "issf"], ["confirmed", "1"]])))
    expect(to).toContain("/library/compliance/c1")
    expect(state.started).toBe(1)
  })
})

describe("stránka potvrdenia", () => {
  async function render(query: Record<string, string | string[]>): Promise<string> {
    const { default: Page } = await import("../src/app/library/compliance/confirm/page")
    return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
  }

  it("ukáže druh, dokumenty, normy, model a odhad; plné tlačidlo na konci", async () => {
    const html = await render({ kind: "helpdesk", channelKey: "issf" })
    expect(html).toContain("Návrhy z helpdesku do manuálov — ISSF Helpdesk (51 otázok)")
    expect(html).toContain("Konto a prihlásenie")
    expect(html).toContain("· koncept")
    expect(html).toContain("Stanovy SFZ")
    expect(html).toContain("Claude Opus 5.5")
    expect(html).toContain("približne 4,66 USD a 9 min")
    expect(html).toContain('name="confirmed" value="1"')
    expect(html).toContain("Spustiť kontrolu")
  })

  it("keď to isté zadanie beží, spustiť sa nedá", async () => {
    state.preview = { ...basePreview, running: { runId: "r1" } }
    const html = await render({ kind: "helpdesk", channelKey: "issf" })
    expect(html).toContain("Toto zadanie práve beží")
    expect(html).not.toContain('name="confirmed"')
  })

  it("upozorní na nerozhodnuté nálezy posledného kola", async () => {
    state.preview = { ...basePreview, openInLast: { runId: "r2", open: 43 } }
    expect(await render({ kind: "helpdesk", channelKey: "issf" })).toContain("má 43 nerozhodnutých nálezov")
  })
})

describe("zastavenie a zrušenie", () => {
  it("zastavenie vyprázdni zvyšok, nastaví stoppedAt a potlačí upozornenie o dobehnutí", async () => {
    await stopRun("SFZ", "r1", "jan@sfz.sk")
    const { filter, update } = state.updates[0]
    expect(filter).toMatchObject({ companyCode: "SFZ", runId: "r1", stoppedAt: null })
    expect((update.$set as Record<string, unknown>).pending).toEqual([])
    expect((update.$set as Record<string, unknown>).notifiedAt).toBeInstanceOf(Date)
  })

  it("zastavenie kola, ktoré nebeží, je chyba", async () => {
    state.matched = 0
    await expect(stopRun("SFZ", "r1", "jan@sfz.sk")).rejects.toThrow()
  })

  it("zrušenie zastaví a označí archivedAt, nemaže", async () => {
    await archiveRun("SFZ", "r1", "jan@sfz.sk")
    expect(state.updates).toHaveLength(2)
    expect((state.updates[1].update.$set as Record<string, unknown>).archivedAt).toBeInstanceOf(Date)
    expect(state.updates.every(u => !("$unset" in u.update))).toBe(true)
  })

  it("rovnaké zadanie: druh, kontrolované dokumenty a kanál, poradie nehrá rolu", () => {
    const run = { scope: { kind: "documents" as const, subjectIds: ["b", "a"], helpdesk: { channelKey: "issf", channelName: "ISSF", items: [] } } }
    expect(sameTask(run, ["a", "b"], "issf")).toBe(true)
    expect(sameTask(run, ["a", "b"], null)).toBe(false)
    expect(sameTask(run, ["a"], "issf")).toBe(false)
  })
})
