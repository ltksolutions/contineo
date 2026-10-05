/**
 * chunksPage.test.ts — stránka Členenie dokumentu (ADR-027, krok A).
 */
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { chunkStats, chunkWarnings } from "../src/lib/chunkingInspect"

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound") }, redirect: (to: string) => { throw new Error(`redirect ${to}`) } }))
vi.mock("@/components/AppShell", () => ({
  default: ({ children, title }: { children: unknown; title: string }) => [`[title:${title}]`, children],
}))
vi.mock("@/lib/library", () => ({
  libraryContext: async () => ({
    state: "ready", tenant: { companyCode: "SFZ", branding: { displayName: "Intranet SFZ" } },
    person: { language: "sk" },
  }),
}))
vi.mock("@/lib/tenants", () => ({ brandingView: () => ({ displayName: "Intranet SFZ" }) }))

const stored = [
  { chunkIndex: 0, heading: "Úvodné ustanovenia", articleRef: null, chunkType: "preambula", text: "Finančná smernica upravuje " + "x".repeat(25000), tokens: 7187 },
]
vi.mock("@/lib/chunkingInspect", async (orig) => {
  const real = await orig<typeof import("../src/lib/chunkingInspect")>()
  return {
    ...real,
    inspectChunking: async (_c: string, id: string) => id === "sfz:nic" ? null : ({
      documentId: id, title: "Finančná smernica SFZ",
      version: { versionId: "v1", label: "2026" },
      profile: { key: "zakladny", label: "Základný", values: { articleWord: "Článok", annexWord: "PRÍLOHA", headerRepeats: 3, minTokens: 300, maxTokens: 800 } },
      stored, stats: real.chunkStats(stored), warnings: real.chunkWarnings(stored, { minTokens: 300, maxTokens: 800 }),
      today: { count: 1, withArticlePercent: 0, outdated: false },
      analysis: { signals: { lines: 120, articleWord: 0, paragraphSign: 0, pointWord: 0, numberedParagraphs: 4, markdownHeadings: 9, annexes: 0, repeatedLines: 0 }, suggestions: [{ key: "volny_text", articleWord: null, hits: 0, score: 0 }], confident: false },
    }),
  }
})

async function render(id: string) {
  const { default: Page } = await import("../src/app/library/[id]/chunks/page")
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ id: encodeURIComponent(id) }) }) as never)
}

describe("stránka Členenie na úseky", () => {
  it("dokument v jednom bloku: súhrn, upozornenia, rozbor a úsek so značkou", async () => {
    const html = await render("sfz:financna_smernica_sfz")
    expect(html).toContain("[title:Členenie na úseky]")
    expect(html).toContain("Základný")
    expect(html).toContain("Celý text je v jednom úseku")
    expect(html).toContain("väčší než 1200 tokenov")
    expect(html).toContain("Potrebuje členenie podľa nadpisov")
    expect(html).toContain("7187 tokenov")
    expect(html).toContain("veľký")
    expect(html).toContain("Úseky zodpovedajú dnešnému členeniu.")
  })

  it("neznámy dokument je 404", async () => {
    await expect(render("sfz:nic")).rejects.toThrow("notFound")
  })

  it("pomocné funkcie sú tie isté ako na stránke", () => {
    expect(chunkWarnings(stored, { minTokens: 300, maxTokens: 800 })[0]).toEqual({ code: "oneBlock" })
    expect(chunkStats(stored).count).toBe(1)
  })
})
