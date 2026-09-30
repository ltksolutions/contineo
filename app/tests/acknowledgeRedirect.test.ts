/**
 * acknowledgeRedirect.test.ts — kam ide človek po potvrdení (Ján 30. 9. 2026).
 *
 * Úspech vedie na „Na potvrdenie" (`/documents`) — ďalšia úloha čaká v zozname.
 * Chyba a „už potvrdené" ostávajú na karte dokumentu, lebo sa jej týkajú.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const state = vi.hoisted(() => ({ result: { ok: true } as Record<string, unknown> }))

vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "vitest" }) }))
vi.mock("@/lib/session", () => ({
  onboardingContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ" },
    person: { id: "p1", email: "a@sfz.sk", fullName: "A", companyCode: "SFZ", language: "sk", roles: [] },
  }),
}))
vi.mock("@/lib/acknowledgements", () => ({ acknowledge: async () => state.result }))
vi.mock("@/lib/tracks", () => ({ trackForDocument: async () => null }))
vi.mock("@/lib/versionResponsibilityDb", () => ({ setVersionLegalBasis: async () => {}, setDraftLegalBasis: async () => {} }))
vi.mock("@/lib/library", () => ({ isContentManager: () => false }))

async function submit(): Promise<string> {
  const { acknowledgeAction } = await import("../src/app/documents/[documentId]/actions")
  const fd = new FormData()
  fd.set("documentId", "sfz:test")
  try {
    await acknowledgeAction(fd)
  } catch (e) {
    return decodeURIComponent(String((e as Error).message).replace(/\+/g, " "))
  }
  throw new Error("akcia nepresmerovala")
}

beforeEach(() => { state.result = { ok: true } })

describe("po potvrdení", () => {
  it("úspech vedie na „Na potvrdenie“ s poďakovaním", async () => {
    expect(await submit()).toBe("redirect /documents?msg=Potvrdené. Ďakujeme.")
  })

  it("už potvrdené ostáva na karte dokumentu", async () => {
    state.result = { ok: false, reason: "already-acknowledged" }
    const to = await submit()
    expect(to).toContain("redirect /documents/sfz:test?")
    expect(to).toContain("error=1")
  })

  it("chyba zápisu ostáva na karte dokumentu", async () => {
    state.result = { ok: false, reason: "write-failed" }
    expect(await submit()).toContain("redirect /documents/sfz:test?")
  })
})
