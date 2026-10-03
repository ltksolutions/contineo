/**
 * trackAddNotify.test.ts — e-mail pri pridaní na trasu (3. 10. 2026).
 *
 * Zaškrtnuté „poslať pridaným" pošle e-mail len novo pridaným, ktorým
 * z trasy niečo chýba. Bez zaškrtnutia neodíde nič.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({
  sent: [] as string[],
  added: { added: 1, already: 1, addedIds: ["p1"] },
}))

// Ako skutočný `redirect()`: výnimka s `digest`, aby ju `isRedirect()` pustila ďalej.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`redirect ${to}`), { digest: `NEXT_REDIRECT;replace;${to}` }) },
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("@/lib/session", () => ({ requestHostname: async () => "intranet.test" }))
vi.mock("@/lib/hr", () => ({
  trackManagerContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", branding: { displayName: "SFZ" }, languages: ["sk"], defaultLanguage: "sk" },
    person: { id: "hr", email: "hr@sfz.sk", companyCode: "SFZ", language: "sk", roles: ["hr"] },
  }),
}))
vi.mock("@/lib/tracks", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/tracks")>()),
  addTrackMembers: async () => state.added,
}))
vi.mock("@/lib/trackNotify", () => ({
  trackRecipients: async () => ({
    track: { key: "t1", title: "Vstupné dokumenty" },
    recipients: ["p1", "p2"].map(id => ({
      person: { id, email: `${id}@sfz.sk`, language: "sk" },
      open: [{ documentTitle: "Poriadok", versionLabel: "1.0", effectiveFrom: new Date("2026-09-01") }],
    })),
  }),
}))
vi.mock("@/lib/ecomail", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/ecomail")>()),
  send: async (m: { to: string }) => { state.sent.push(m.to) },
}))
vi.mock("@/lib/audit", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/audit")>()),
  writeAudit: async () => {},
}))

async function submit(fields: Record<string, string>): Promise<string> {
  const { addMembersAction } = await import("../src/app/hr/tracks/actions")
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  try { await addMembersAction(fd) } catch (e) { return decodeURIComponent(String((e as Error).message).replace(/\+/g, " ")) }
  throw new Error("akcia nepresmerovala")
}

beforeEach(() => { state.sent = []; state.added = { added: 1, already: 1, addedIds: ["p1"] } })

describe("pridanie na trasu s e-mailom", () => {
  it("zaškrtnuté pošle len novo pridaným", async () => {
    const to = await submit({ key: "t1", person: "p1", notify: "1" })
    expect(state.sent).toEqual(["p1@sfz.sk"])
    expect(to).toContain("Pridané na trasu: 1.")
    expect(to).toContain("Odoslané 1")
    expect(to).not.toContain("error=1")
  })

  it("bez zaškrtnutia nepošle nič", async () => {
    await submit({ key: "t1", person: "p1" })
    expect(state.sent).toEqual([])
  })

  it("keď nikto nepribudol, nepošle nič", async () => {
    state.added = { added: 0, already: 1, addedIds: [] }
    await submit({ key: "t1", person: "p2", notify: "1" })
    expect(state.sent).toEqual([])
  })
})
