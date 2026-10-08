/**
 * channelsPage.test.ts — prehľad kanálov podľa návrhu KANALY-prehlad
 * (8. 10. 2026): riadky ako odkazy bez kľúča, vstavané len správcovi,
 * nový kanál len pri `?new=1`, štítok nesynchronizujúcej schránky.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({ ctx: null as unknown }))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/lib/helpdeskAgents", () => ({ channelsContext: async () => state.ctx }))
vi.mock("@/lib/tickets", () => ({
  ticketCounts: async (_c: string, key: string) => key === "k-issf"
    ? { new: 2, drafted: 1, sent: 50, closed: 9, reopened: 3 }
    : { new: 0, drafted: 0, sent: 0, closed: 0, reopened: 0 },
}))
vi.mock("@/components/ChannelTabs", () => ({
  ChannelSectionTabs: ({ isAgent }: { isAgent: boolean }) => (isAgent ? "TABS" : null),
  channelHref: (key: string) => `/channels/${encodeURIComponent(key)}`,
}))
vi.mock("../src/app/channels/actions", () => ({ saveChannelAction: async () => {} }))

const base = { companyCode: "SFZ", audience: "", folderIds: [], tickets: false, mailbox: null, assigneeIds: [], languages: ["sk"],
  widget: { origins: [], rateLimitPerHour: 60 }, createdAt: new Date(), createdBy: "x", updatedAt: new Date(), updatedBy: "x" }
const issf = { ...base, key: "k-issf", kind: "widget", name: "ISSF Helpdesk", tickets: true,
  mailbox: { kind: "graph", address: "helpdesk@futbalsfz.sk", lastSyncAt: new Date(Date.now() - 2 * 60_000), lastSyncError: null, syncIntervalMinutes: 5 } }
const portal = { ...base, key: "k-ref", kind: "portal", name: "Rozhodcovia", accessLevel: "internal" }
function admin(channels: unknown[], agent = false) {
  return { state: "ready", person: { id: "p1", language: "sk" }, tenant: { companyCode: "SFZ" }, isAdmin: true, agentChannels: agent ? channels : [], visible: channels }
}
async function render(query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/channels/page")
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }))
}

describe("/channels — KANALY-prehlad", () => {
  beforeEach(() => { state.ctx = admin([issf, portal]) })

  it("správca: riadky sú odkazy bez kľúča, štítok otvorených, vstavané, žiadny formulár", async () => {
    const html = await render()
    expect(html).toContain('href="/channels/k-issf"')
    expect(html).not.toContain("<code>")
    expect(html).toContain("Widget · helpdesk@futbalsfz.sk · verejný")
    expect(html).toContain("Portál · interný")
    expect(html).toContain('<span class="tag tag--draft">6 otvorených</span>')
    expect(html).toContain("Vstavané kanály")
    expect(html).toContain("nenastavuje sa")
    expect(html).toContain('href="/channels?new=1"')
    expect(html).not.toContain('name="isNew"')
  })

  it("?new=1: karta úlohy s dvomi voľbami typu, hlavičkové tlačidlo zmizne, chyba v karte", async () => {
    const html = await render({ new: "1", error: "Názov kanála je povinný.", kind: "portal" })
    expect(html).toContain('class="card task-card"')
    expect(html.match(/<label class="form-row choice-row"><input type="radio" name="kind"/g)).toHaveLength(2)
    expect(html).toMatch(/value="portal" checked=""|checked="" value="portal"/)
    expect(html).not.toContain('href="/channels?new=1"')
    expect(html).toContain('class="lnote lnote--bad"')
  })

  it("zlyhaná schránka: štítok Schránka nesynchronizuje", async () => {
    state.ctx = admin([{ ...issf, mailbox: { ...issf.mailbox, lastSyncError: "graph.401" } }])
    expect(await render()).toContain("Schránka nesynchronizuje")
  })

  it("riešiteľ: len jeho kanály, počet otvorených, bez vstavaných a nového kanála", async () => {
    state.ctx = { ...admin([issf], true), isAdmin: false }
    const html = await render()
    expect(html).toContain('<span class="channel-count"><b>6</b><span>otvorených</span></span>')
    expect(html).not.toContain("Vstavané kanály")
    expect(html).not.toContain("Nový kanál")
    expect(html).toContain("Kanály, v ktorých odpovedáte na tickety.")
  })

  it("správca bez kanálov: prázdny stav", async () => {
    state.ctx = admin([])
    expect(await render()).toContain("Zatiaľ žiadny kanál")
  })
})
