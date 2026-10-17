/**
 * markupGuardFlow.test.ts — strážca zápisu pri uložení textu (16. 10. 2026).
 *
 * Akcia: zmena, v ktorej sa nezmenilo ani písmeno, len značky Markdownu,
 * uloženie zastaví a text odloží; rozhodnutie „pôvodný zápis" uloží úpravy
 * človeka s pôvodným zápisom. Stránka: s odloženým textom vykreslí zoznam
 * a dve tlačidlá; dokument s platným znením otvorí editor v Markdowne.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"

const state = vi.hoisted(() => ({
  base: "",
  pending: null as string | null,
  saved: [] as string[],
  staged: [] as string[],
  cleared: 0,
  active: true,
  editorMode: "" as string,
}))

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound") },
  redirect: (to: string) => { throw new Error(`redirect ${to}`) },
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/server", () => ({ after: () => {} }))
vi.mock("@/lib/library", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/library")>()),
  libraryContext: async () => ({
    state: "ready",
    tenant: { companyCode: "SFZ", name: "SFZ" },
    person: { id: "p1", email: "a@sfz.sk", companyCode: "SFZ", language: "sk", roles: ["content_manager"] },
  }),
}))
vi.mock("@/lib/libraryRead", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/libraryRead")>()),
  libraryDetail: async () => ({
    title: "Súťažný poriadok",
    editableText: state.base,
    versions: [{ versionId: "v1", isActive: state.active }],
  }),
}))
vi.mock("@/lib/libraryWrite", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/libraryWrite")>()),
  saveDraft: async (_c: string, _id: string, text: string) => { state.saved.push(text) },
  stagePendingText: async (_c: string, _id: string, text: string) => { state.staged.push(text); state.pending = text },
  pendingText: async () => state.pending,
  clearPendingText: async () => { state.cleared++; state.pending = null },
}))
vi.mock("@/lib/mongodb", () => ({
  getCollection: async () => ({
    findOne: async () => (state.pending ? { pendingText: { text: state.pending } } : {}),
  }),
}))
vi.mock("@/lib/tenants", async importOriginal => ({
  ...(await importOriginal<typeof import("../src/lib/tenants")>()),
  brandingView: () => ({}),
}))
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: unknown }) => children }))
vi.mock("@/components/TenantHeader", () => ({ tenantStyle: () => ({}) }))
vi.mock("@/components/TextEditor", () => ({
  default: ({ mode }: { mode?: string }) => { state.editorMode = mode ?? ""; return null },
}))

import { saveTextAction } from "../src/app/library/actions"

const BEFORE = ["(1) Text odseku.", "", "***Uvedie sa po mene.", "(4) Strany dohody."].join("\n")
// Človek doplnil slovo v (4); editor prepísal poznámku *** na *.
const AFTER = ["(1) Text odseku.", "", "*Uvedie sa po mene.", "(4) Strany dohody podpísali."].join("\n")

function form(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try { await p } catch (e) { return String((e as Error).message) }
  return ""
}

beforeEach(() => {
  Object.assign(state, { base: BEFORE, pending: null, saved: [], staged: [], cleared: 0, active: true, editorMode: "" })
})

describe("saveTextAction so strážcom zápisu", () => {
  it("zmenu zápisu neuloží, odloží ju a vráti na rozhodnutie", async () => {
    const to = await redirectOf(saveTextAction(form({ documentId: "D1", markdown: AFTER })))
    expect(to).toContain("/library/D1/text?markup=1")
    expect(state.saved).toEqual([])
    expect(state.staged).toEqual([AFTER])
  })

  it("úpravu bez zmeny zápisu uloží rovno", async () => {
    const plain = BEFORE.replace("Strany dohody.", "Strany dohody podpísali.")
    const to = await redirectOf(saveTextAction(form({ documentId: "D1", markdown: plain })))
    expect(to).toContain("msg=")
    expect(state.saved).toEqual([plain])
    expect(state.staged).toEqual([])
  })

  it("„pôvodný zápis“ vráti *** a nechá úpravu človeka", async () => {
    state.pending = AFTER
    await redirectOf(saveTextAction(form({ documentId: "D1", markupChoice: "original" })))
    expect(state.saved).toHaveLength(1)
    expect(state.saved[0]).toContain("***Uvedie sa")
    expect(state.saved[0]).toContain("podpísali.")
    expect(state.cleared).toBe(1)
  })

  it("„uložiť aj tak“ uloží text tak, ako ho editor poslal", async () => {
    state.pending = AFTER
    await redirectOf(saveTextAction(form({ documentId: "D1", markupChoice: "accept" })))
    expect(state.saved).toEqual([AFTER])
  })

  it("bez odloženého textu rozhodnutie nič neuloží a povie prečo", async () => {
    const to = await redirectOf(saveTextAction(form({ documentId: "D1", markupChoice: "original" })))
    expect(to).toContain("error=1")
    expect(state.saved).toEqual([])
  })
})

describe("stránka textu", () => {
  async function render(): Promise<string> {
    const { default: Page } = await import("../src/app/library/[id]/text/page")
    const el = await Page({ params: Promise.resolve({ id: "D1" }), searchParams: Promise.resolve({ markup: "1" }) })
    return renderToStaticMarkup(el)
  }

  it("s odloženým textom ukáže zmenený riadok a dve rozhodnutia", async () => {
    state.pending = AFTER
    const html = await render()
    expect(html).toContain("Riadok 3")
    expect(html).toContain("***Uvedie sa po mene.")
    expect(html).toContain("mení počet hviezdičiek")
    expect(html).toContain("Uložiť s pôvodným zápisom")
    expect(html).toContain("Uložiť aj tak")
  })

  it("dokument s platným znením otvorí editor v Markdowne, koncept vo vizuálnom režime", async () => {
    await render()
    expect(state.editorMode).toBe("markdown")
    state.active = false
    await render()
    expect(state.editorMode).toBe("wysiwyg")
  })
})
