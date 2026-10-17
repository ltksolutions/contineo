/**
 * chunksPage.test.ts — Členenie na úseky ako rezač blokov (KNIZ-rezac-blokov).
 *
 * Stav rezača sa podvrhne (`cutterState`); bloky a hranice sú skutočné
 * (`chunkBlocks.ts`), aby test overil, čo naozaj vidno pri bloku a hranici.
 */
import { describe, it, expect, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { splitBlocks, groupTokens } from "../src/lib/chunkBlocks"

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
  proposeChunkCutAction: async () => {},
  acceptChunkRoundAction: async () => {},
}))
vi.mock("@/components/SubmitButton", () => ({ default: ({ children }: { children: unknown }) => children }))

const text = `# Podania na komisie

Úvod manuálu.

## 1.2 Prílohy

Prílohy vo formáte PDF ${"dlhý opis príloh, ".repeat(400)}

## 1.3 Stav podania

Po odoslaní má podanie stav Prijaté.

## 2.2 Zverejnenie

Matrika zmluvu zverejní.

## 2.3 Lehoty

| Úkon | Lehota |
|---|---|
| Vloženie | 10 dní |`

const blocks = splitBlocks(text)
// Skutočné veľkosti skupín blokov — stránka kreslí bloky, len keď sedia s uloženými úsekmi.
const [t1, t2] = groupTokens(blocks, [6])
// Cieľ je pravidlo (ADR-035): limit „veľký" = 900 × 1,5 = 1350 tokenov.
const limit = 1350
const base = (over: Record<string, unknown> = {}) => ({
  inspection: {
    documentId: "sfz:issf_08", title: "Podania na komisie",
    version: { versionId: "v1", label: "znenie účinné od 11. 10. 2026" },
    stored: [], stats: { count: 2 }, warnings: [], today: { count: 2, withArticlePercent: 100, outdated: false },
  },
  blocks, text, draft: false, manual: false, method: "headings", approximate: false, category: "manual", reviewed: false,
  // Dnes: dva úseky — druhý veľký.
  current: [6],
  todayChunks: [
    { chunkIndex: 0, heading: "Podania na komisie", articleRef: "Podania na komisie", text: blocks.slice(0, 6).map(b => b.text).join("\n\n"), tokens: t1, complete: true },
    { chunkIndex: 1, heading: "2.2 Zverejnenie", articleRef: "2.2 Zverejnenie", text: blocks.slice(6).map(b => b.text).join("\n\n"), tokens: t2, complete: true },
  ],
  rounds: [],
  ...over,
})
const round = {
  no: 2, at: new Date("2026-10-15T08:42:00Z"), by: "Ján Letko", source: "ai", model: "claude-opus-5-5", textHash: "h",
  note: "Tabuľka lehôt patrí k vete.", boundaries: [4, 6], summary: "Rozdelil som prvý úsek pred 1.3.",
  reasons: [{ block: 4, why: "Stav podania je samostatná téma." }], issues: ["Tabuľka nemá nadpis stĺpca Kto."], confidence: "high",
}
const auto = { ...round, no: 1, source: "auto", by: "jan@sfz.sk", note: null, boundaries: [6], summary: "", reasons: [] }
const cutter = vi.hoisted(() => ({ state: null as unknown }))
vi.mock("@/lib/chunkCutter", () => ({ cutterState: async (_c: string, id: string) => (id === "sfz:nic" ? null : cutter.state) }))

async function render(id: string, query: Record<string, string> = {}) {
  const { default: Page } = await import("../src/app/library/[id]/chunks/page")
  return renderToStaticMarkup(await Page({
    params: Promise.resolve({ id: encodeURIComponent(id) }),
    searchParams: Promise.resolve(query),
  }) as never)
}

describe("Členenie — rezač blokov", () => {
  it("Dnes: text ako bloky úsekov, súhrn v riadku, veľký úsek so štítkom a tabuľka v rámiku", async () => {
    cutter.state = base()
    const html = await render("sfz:issf_08")
    expect(html).toContain("[title:Členenie na úseky]")
    expect(t1 > limit && t2 <= limit).toBe(true)
    expect(html).toContain('class="cut-block cut-tone-1 is-oversized"')
    expect(html).toContain('class="cut-block cut-tone-2"')
    expect(html).toContain("nad 1350 — asistent z neho dostane priveľa naraz")
    expect(html).toContain("podľa nadpisov")
    expect(html).toContain("1 úsek nesedí")
    expect(html).toContain('<pre class="cut-pre">| Úkon | Lehota |')
    expect(html).toContain("<h2>1.2 Prílohy</h2>")
    // Bez kola: tiché Navrhnúť rezy a vysvetlenie, žiadne Prijať ani prepínač.
    expect(html).toContain("Navrhnúť rezy")
    expect(html).toContain("Návrh rezov od AI")
    expect(html).not.toContain("Prijať a preindexovať")
    expect(html).not.toContain("view-switch")
    // Profily zanikli (ADR-035).
    expect(html).not.toContain("profileKey")
  })

  it("Dnes: keď nájdené hranice nesedia s veľkosťou uložených úsekov, ukáže sa uložený text, nie zavádzajúce bloky", async () => {
    cutter.state = base({
      current: [1], approximate: true,
      todayChunks: [
        { chunkIndex: 0, heading: "", articleRef: null, text: "Zlúčený text prvého úseku.", tokens: 1204 },
        { chunkIndex: 1, heading: "", articleRef: null, text: "Zlúčený text druhého úseku.", tokens: 1017 },
      ],
    })
    const html = await render("sfz:issf_08")
    expect(html).toContain('<p class="cut-flat">Zlúčený text prvého úseku.</p>')
    expect(html).not.toContain("cut-approx")
  })

  it("Rozdiel: nová hranica so zdôvodnením, zhodná tichá, súhrn kola a jediné plné Prijať", async () => {
    cutter.state = base({ rounds: [round, auto] })
    const html = await render("sfz:issf_08", { view: "diff" })
    expect(html).toContain("Návrh AI z 15. 10. 2026 (claude-opus-5-5, 2. kolo)")
    expect(html).toContain("nová hranica · pred 1.3 Stav podania")
    expect(html).toContain("Stav podania je samostatná téma.")
    expect(html).not.toContain("pred 2.2 Zverejnenie</span>")
    expect(html).toContain("Návrh pridáva 1 hranicu a ruší 0.")
    expect(html).toContain("Rozdelil som prvý úsek pred 1.3.")
    expect(html).toContain("Tabuľka nemá nadpis stĺpca Kto.")
    expect(html).toContain('class="view-switch-item is-on" aria-current="page" href="/library/sfz%3Aissf_08/chunks?view=diff&amp;round=2"')
    // Dlhý opis príloh ostáva v prvom úseku návrhu — veľký.
    expect(html).toContain("1 úsek nesedí")
    expect(html).toContain('name="round" value="2"')
    expect(html).toContain("Prijať návrh (kolo 2) a preindexovať")
    // Kolá: aktuálne zobrazené, staršie s odkazom; automatické kolo pomenované.
    expect(html).toContain("„Tabuľka lehôt patrí k vete.“")
    expect(html).toContain("automaticky pri nahratí")
    expect(html).toContain("?view=diff&amp;round=1")
    expect(html).toContain("Navrhnúť znova")
  })

  it("Rozdiel staršieho kola: zrušená hranica prečiarknutá vnútri spojeného úseku", async () => {
    cutter.state = base({ rounds: [round, auto], current: [4, 6] })
    const html = await render("sfz:issf_08", { view: "diff", round: "1" })
    expect(html).toContain("cut-boundary--removed")
    expect(html).toContain("zrušená hranica · pred 1.3 Stav podania")
    expect(html).toContain("Návrh pridáva 0 hraníc a ruší 1.")
  })

  it("koncept nového znenia: poznámka, že rez platí pri zverejnení", async () => {
    cutter.state = base({ draft: true, rounds: [round] })
    const html = await render("sfz:issf_08", { view: "proposal" })
    expect(html).toContain("Reže sa koncept nového znenia.")
    expect(html).toContain("koncept nového znenia")
    expect(html).toContain("uplatní sa pri zverejnení")
  })

  it("bez textu: prázdny stav; neznámy dokument 404", async () => {
    cutter.state = base({ text: "", blocks: [], todayChunks: [] })
    expect(await render("sfz:issf_08")).toContain("Dokument zatiaľ nemá text")
    await expect(render("sfz:nic")).rejects.toThrow("notFound")
  })
})
