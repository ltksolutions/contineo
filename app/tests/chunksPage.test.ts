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
vi.mock("../src/app/library/actions", () => ({
  applyChunkingProfileAction: async () => {},
  saveChunkingProfileAction: async () => {},
  requestChunkingAdviceAction: async () => {},
}))
vi.mock("@/components/SubmitButton", () => ({ default: ({ children }: { children: unknown }) => children }))

const stored = [
  { chunkIndex: 0, heading: "Úvodné ustanovenia", articleRef: null, chunkType: "preambula", text: "Finančná smernica upravuje " + "x".repeat(25000), tokens: 7187 },
]
vi.mock("@/lib/chunkingInspect", async (orig) => {
  const real = await orig<typeof import("../src/lib/chunkingInspect")>()
  return {
    ...real,
    inspectChunking: async (_c: string, id: string, trialValues?: { articleWord: string; annexWord?: string; maxTokens: number; minTokens: number }) => id === "sfz:nic" ? null : ({
      documentId: id, title: "Finančná smernica SFZ",
      version: { versionId: "v1", label: "2026" },
      profile: { key: "zakladny", label: "Základný", values: { articleWord: "Článok", annexWord: "PRÍLOHA", headerRepeats: 3, minTokens: 300, maxTokens: 800 } },
      stored, stats: real.chunkStats(stored), warnings: real.chunkWarnings(stored, { minTokens: 300, maxTokens: 800 }),
      today: { count: 1, withArticlePercent: 0, outdated: false },
      profiles: [
        { key: "zakladny", label: "Základný", values: { articleWord: "Článok", annexWord: "PRÍLOHA", headerRepeats: 3, minTokens: 300, maxTokens: 800 } },
        { key: "zakon", label: "Zákon (§)", values: { articleWord: "§", annexWord: "PRÍLOHA", headerRepeats: 3, minTokens: 300, maxTokens: 800 } },
      ],
      advice: id === "sfz:s_navrhom" ? {
        at: new Date("2026-10-05T12:00:00Z"), by: "Ján Letko", model: "claude-sonnet-5", strategy: "articles",
        values: { articleWord: "Článok", annexWord: "PRÍLOHA", headerRepeats: 3, minTokens: 250, maxTokens: 700 },
        confidence: "high", reasoning: "Nadpisy článkov sú tučné.", issues: ["Tabuľka v čl. 4 je veľká."],
      } : null,
      trial: trialValues ? {
        values: trialValues,
        chunks: [{ chunkIndex: 0, heading: "Predmet", articleRef: "§ 1", chunkType: "clanok", text: "§ 1 text", tokens: 400, complete: true }],
        stats: { count: 1, withArticle: 1, withArticlePercent: 100, tokensMin: 400, tokensMax: 400, tokensAvg: 400 },
        warnings: [],
        matchesProfile: trialValues.articleWord === "§" && trialValues.maxTokens === 800 ? "zakon" : null,
        sameAsCurrent: trialValues.annexWord === "Príloha",
      } : null,
      analysis: { signals: { lines: 120, articleWord: 0, paragraphSign: 0, pointWord: 0, numberedParagraphs: 4, markdownHeadings: 9, annexes: 0, repeatedLines: 0 }, suggestions: [{ key: "volny_text", articleWord: null, hits: 0, score: 0 }], confident: false },
    }),
  }
})

async function render(id: string, query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/library/[id]/chunks/page")
  return renderToStaticMarkup(await Page({
    params: Promise.resolve({ id: encodeURIComponent(id) }),
    searchParams: Promise.resolve(query),
  }) as never)
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

  it("skúšobný rez: porovnanie, skúšobné úseky a uloženie nového profilu", async () => {
    const html = await render("sfz:financna_smernica_sfz", { trial: "1", articleWord: "Bod", maxTokens: "600" })
    expect(html).toContain("Porovnanie")
    expect(html).toContain("Úseky po skúšobnom reze")
    expect(html).toContain("Uložiť hodnoty skúšky ako nový profil")
    expect(html).toMatch(/name="articleWord"[^>]*value="Bod"|value="Bod"[^>]*name="articleWord"/)
    expect(html).toContain("Zrušiť skúšku")
  })

  it("skúška zhodná s existujúcim profilom ho ponúkne, nový sa neukladá", async () => {
    const html = await render("sfz:financna_smernica_sfz", { trial: "1", articleWord: "§" })
    expect(html).toContain("Tieto hodnoty má profil „Zákon (§)“.")
    expect(html).not.toContain("Uložiť hodnoty skúšky ako nový profil")
    expect(html).toMatch(/<option[^>]*value="zakon"[^>]*selected/)
  })

  it("skúška s iným zápisom, ale rovnakým rezom: netreba nič meniť, nový profil sa neponúka", async () => {
    const html = await render("sfz:financna_smernica_sfz", { trial: "1", annexWord: "Príloha" })
    expect(html).toContain("Skúšobný rez je rovnaký ako súčasný — netreba nič meniť.")
    expect(html).not.toContain("Uložiť hodnoty skúšky ako nový profil")
  })

  it("bez skúšky: zoznam uložených úsekov, výber profilu, žiadne ukladanie nového", async () => {
    const html = await render("sfz:financna_smernica_sfz")
    expect(html).toContain("Skúsiť iný rez")
    expect(html).toContain("Použiť existujúci profil")
    expect(html).not.toContain("Uložiť hodnoty skúšky ako nový profil")
  })

  it("návrh AI: odôvodnenie, nálezy a odkaz na skúšobný rez s navrhnutými hodnotami", async () => {
    const html = await render("sfz:s_navrhom")
    expect(html).toContain("Návrh AI")
    expect(html).toContain("Po článkoch — slovo „Článok“, úsek 250–700 tokenov.")
    expect(html).toContain("Nadpisy článkov sú tučné.")
    expect(html).toContain("Tabuľka v čl. 4 je veľká.")
    expect(html).toContain("istota vysoká")
    expect(html).toContain("trial=1&amp;articleWord=%C4%8Cl%C3%A1nok&amp;annexWord=PR%C3%8DLOHA&amp;minTokens=250&amp;maxTokens=700")
    expect(html).toContain("Analyzovať znova")
  })

  it("bez návrhu: vysvetlenie a tlačidlo analýzy", async () => {
    const html = await render("sfz:financna_smernica_sfz")
    expect(html).toContain("Analyzovať pomocou AI")
    expect(html).toContain("nie celý text")
  })

  it("neznámy dokument je 404", async () => {
    await expect(render("sfz:nic")).rejects.toThrow("notFound")
  })

  it("pomocné funkcie sú tie isté ako na stránke", () => {
    expect(chunkWarnings(stored, { minTokens: 300, maxTokens: 800 })[0]).toEqual({ code: "oneBlock" })
    expect(chunkStats(stored).count).toBe(1)
  })
})
