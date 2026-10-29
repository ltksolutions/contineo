/**
 * helpdeskTicketPage.test.ts — vlakno ticketu na obrazovke riesitela (ADR-028).
 *
 * Posledna prijata sprava nad odpovedou, pod odpovedou historia od najstarsej;
 * odpovede helpdesku odsadene, sprava zobrazena hore je v historii zbalena
 * (Jan 29. 10. 2026, predtym od najnovsej podla 7. 10.).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const stubs = vi.hoisted(() => (names: string[]) => Object.fromEntries(names.map(n => [n, async () => {}])))
const state = vi.hoisted(() => ({ messages: [] as unknown[] }))

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404") }, redirect: () => { throw new Error("redirect") } }))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({}) }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/lib/persons", () => ({ findPerson: async () => null }))
vi.mock("@/lib/mongodb", () => ({ getCollection: async () => ({ find: () => ({ sort: () => ({ toArray: async () => [] }) }) }) }))
vi.mock("@/lib/helpdeskAgents", () => ({
  helpdeskContext: async () => ({
    state: "ready",
    person: { id: "p1", language: "sk", companyCode: "SFZ", email: "a@sfz.sk" },
    tenant: { companyCode: "SFZ" },
    channels: [{ key: "k", name: "ISSF Helpdesk", mailbox: { address: "helpdesk@futbalsfz.sk" } }],
  }),
}))
vi.mock("@/lib/tickets", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/tickets")>()),
  ticketById: async () => ({
    _id: "t1", companyCode: "SFZ", channelKey: "k", source: "email", threadRef: "conv1",
    asker: { personId: null, email: "jan@example.sk", name: "Ján Smandra", roles: [], club: null },
    subject: "Zmena priezviska", messages: state.messages, state: "new", assigneeId: null,
    draft: null, sentAnswer: null, createdAt: new Date(), updatedAt: new Date(), closedAt: null,
  }),
}))
vi.mock("../src/app/channels/tickets/actions", () => stubs([
  "takeTicketAction", "draftWithAiAction", "saveDraftAction", "sendAnswerAction", "closeTicketAction", "ticketToFaqAction", "importThreadAction",
]))

const msg = (providerId: string, direction: "in" | "out", text: string, day: number) => ({
  internetMessageId: null, providerId, direction, from: direction === "in" ? { address: "jan@example.sk", name: "Ján Smandra" } : null,
  subject: "", text, at: new Date(`2026-10-0${day}T10:00:00Z`), attachments: [],
})

async function render() {
  const { default: Page } = await import("../src/app/channels/tickets/[id]/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "t1" }), searchParams: Promise.resolve({}) }))
}

beforeEach(() => { state.messages = [] })

describe("vlakno ticketu", () => {
  it("posledna prijata hore, potom odpoved, potom historia od najstarsej", async () => {
    state.messages = [
      msg("a", "in", "Žiadam o zmenu priezviska.\nĎalší riadok", 3),
      msg("b", "out", "Kontaktujte matriku.", 6),
      msg("c", "in", "Nech sa páči: jozko@example.sk", 7),
      msg("d", "out", "Ďakujeme, upravené.", 8),
    ]
    const html = await render()
    const last = html.indexOf('id="last-message"'), answer = html.indexOf('id="answer"'), history = html.indexOf('id="history"')
    expect(last).toBeGreaterThan(-1)
    expect(last).toBeLessThan(answer)
    expect(answer).toBeLessThan(history)
    // hore je posledná *prijatá*, nie posledná vôbec (tá je odpoveď)
    expect(html.slice(last, answer)).toContain("Nech sa páči")
    expect(html.slice(last, answer)).not.toContain("Ďakujeme, upravené.")
    const hist = html.slice(history)
    expect(hist).toContain("4 správy · posledná: Helpdesk")
    expect(hist.indexOf("Žiadam o zmenu")).toBeLessThan(hist.indexOf("Kontaktujte matriku."))
    expect(hist.indexOf("Kontaktujte matriku.")).toBeLessThan(hist.indexOf("Nech sa páči"))
    expect(hist.indexOf("Nech sa páči")).toBeLessThan(hist.indexOf("Ďakujeme, upravené."))
    // zobrazená hore je v histórii zbalená, ostatné celé; odpovede označené
    expect(hist.match(/<details class="thread-msg/g)).toHaveLength(1)
    expect(hist.match(/<article class="thread-msg/g)).toHaveLength(3)
    expect(hist.match(/thread-msg thread-msg--out/g)).toHaveLength(2)
    expect(hist).toContain("Odpoveď helpdesku")
    expect(hist).toContain("došlá správa")
    expect(hist).toContain("· Nech sa páči: jozko@example.sk</span>")
  })

  it("jedna sprava: len hore, bez historie", async () => {
    state.messages = [msg("a", "in", "Otázka?", 3)]
    const html = await render()
    expect(html).toContain('id="last-message"')
    expect(html).not.toContain("thread-summary")
    expect(html.match(/<article class="thread-msg/g)).toHaveLength(1)
  })
})
