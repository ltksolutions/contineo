/**
 * trackNotify.test.ts — trasa v Pridelených dokumentoch a e-mail ľuďom na
 * trase (2. 10. 2026). Píše sa len tým, ktorí z trasy niečo nepotvrdili,
 * a len o tom, čo im chýba; stav počíta to isté ako výkaz.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({
  sent: [] as { to: string; text: string }[],
  audit: [] as Record<string, unknown>[],
}))

const TRACK = { companyCode: "SFZ", key: "t1", title: "Vstupné dokumenty SFZ", isActive: true,
  steps: [{ order: 1, type: "document", documentId: "a", requiresAcknowledgement: true }, { order: 2, type: "document", documentId: "b", requiresAcknowledgement: true }] }
const duty = (personId: string, documentTitle: string, done: boolean) => ({
  personId, fullName: personId, email: `${personId}@sfz.sk`, documentId: documentTitle, documentTitle, versionId: documentTitle,
  versionLabel: "1", sources: ["track"], trackTitles: ["Vstupné dokumenty SFZ"], since: null, due: null,
  acknowledgedAt: done ? new Date() : null, firstOpenedAt: null, readingSeconds: null,
})
const ROWS = [duty("eva", "Pracovný poriadok", true), duty("eva", "Finančná smernica", false),
  duty("jan", "Pracovný poriadok", true), duty("jan", "Finančná smernica", true)]
const PEOPLE = [
  { id: "eva", email: "eva@sfz.sk", fullName: "Eva Nová", status: "active", language: "sk", tracks: ["t1"] },
  { id: "jan", email: "jan@sfz.sk", fullName: "Ján Starý", status: "active", language: "sk", tracks: ["t1"] },
  { id: "ana", email: "ana@sfz.sk", fullName: "Anna Malá", status: "inactive", language: "sk", tracks: ["t1"] },
]

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({ displayName: "SFZ" }) }))
vi.mock("@/lib/session", () => ({ requestHostname: async () => "intranet.test" }))
const ctx = { state: "ready", tenant: { companyCode: "SFZ" }, person: { id: "hr", email: "hr@sfz.sk", companyCode: "SFZ", language: "sk", roles: ["hr"] } }
vi.mock("@/lib/hr", () => ({ trackManagerContext: async () => ctx, hrContext: async () => ctx, isHr: () => true }))
vi.mock("@/lib/tracks", () => ({ trackByKey: async () => TRACK, allTracks: async () => [TRACK] }))
vi.mock("@/lib/hrReport", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/hrReport")>()),
  duties: async () => ROWS,
}))
vi.mock("@/lib/people", () => ({ listPeople: async () => PEOPLE }))
vi.mock("@/lib/assignments", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/assignments")>()),
  assignmentOverviews: async () => [],
}))
vi.mock("@/lib/ecomail", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/ecomail")>()),
  send: async (m: { to: string; text: string }) => { state.sent.push(m) },
}))
vi.mock("@/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: async (r: Record<string, unknown>) => { state.audit.push(r) },
}))

beforeEach(() => { state.sent = []; state.audit = [] })

describe("stav trasy", () => {
  it("spolu aj po ľuďoch, z riadkov výkazu", async () => {
    const { trackStatuses } = await import("../src/lib/hrReport")
    const s = trackStatuses(ROWS as never).get("Vstupné dokumenty SFZ")!
    expect([s.done, s.total]).toEqual([3, 4])
    expect(s.perPerson.get("eva")).toMatchObject({ done: 1, total: 2 })
    expect(s.perPerson.get("eva")!.open.map(d => d.documentTitle)).toEqual(["Finančná smernica"])
  })
})

describe("komu dať vedieť", () => {
  it("len aktívnym na trase, ktorým niečo chýba, a len to, čo chýba", async () => {
    const { trackRecipients } = await import("../src/lib/trackNotify")
    const r = await trackRecipients("SFZ", "t1")
    expect(r!.recipients.map(x => [x.person.id, x.open.map(d => d.documentTitle)])).toEqual([["eva", ["Finančná smernica"]]])
  })

  it("náhľad ukáže príjemcu a presný text; odoslanie pošle jeden e-mail a zapíše audit", async () => {
    const { default: Page } = await import("../src/app/hr/tracks/[key]/notify/page")
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ key: "t1" }) }))
    expect(html).toContain("Eva Nová")
    expect(html).not.toContain("Ján Starý")
    expect(html).toContain("Finančná smernica")

    const { sendTrackNotificationAction } = await import("../src/app/hr/tracks/actions")
    const fd = new FormData(); fd.set("key", "t1")
    await expect(sendTrackNotificationAction(fd)).rejects.toThrow(/redirect \/hr\/tracks\/t1\?msg=/)
    expect(state.sent.map(m => m.to)).toEqual(["eva@sfz.sk"])
    expect(state.sent[0].text).toContain("Finančná smernica")
    expect(state.sent[0].text).toContain("https://intranet.test/documents")
    expect(state.audit).toEqual([expect.objectContaining({ subject: "track", action: "notified", targetId: "t1" })])
  })
})

describe("Pridelené dokumenty", () => {
  it("ukáže kartu trasy so stavom a odkazom na „Dať vedieť“", async () => {
    const { default: Page } = await import("../src/app/hr/page")
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
    expect(html).toContain("Vstupné dokumenty SFZ")
    expect(html).toContain("2 osoby · 2 dokumenty")
    expect(html).toContain("3 / 4")
    expect(html).toContain('href="/hr/tracks/t1/notify"')
  })
})
