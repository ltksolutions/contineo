/**
 * chunkBlocks.test.ts — bloky textu, rez podľa ručných hraníc a voľba rezu
 * pri indexovaní (KNIZ-rezac-blokov, Q3 A).
 */
import { describe, it, expect } from "vitest"
import {
  splitBlocks, cutByBoundaries, normalizeBoundaries, groupBlocks, boundariesFromChunks, boundaryDiff, groupTokens, headingText,
} from "../src/lib/chunkBlocks"
import { cutForIndex, manualCutFor, type ChunkCut } from "../src/lib/chunkCut"
import { textFingerprint, chunkingFingerprint } from "../src/lib/chunkIdentity"
import { numberedBlocks, parseProposal, roundsFor, oversizedNewChunks, TEXT_MAX_CHARS, type ChunkRound } from "../src/lib/chunkProposal"

const manual = `# Podania na komisie

Tento manuál opisuje podania.

## 1 Podania
Podanie sa podáva cez ISSF.
Druhý riadok toho istého odseku.

### 1.1 Prílohy
- PDF do 10 MB
- JPG alebo PNG
  pokračovanie položky

## 2 Lehoty

Lehoty sú v tabuľke:

| Úkon | Lehota |
|---|---|
| Vloženie | 10 dní |
`

describe("splitBlocks", () => {
  it("nadpis, odsek, položka a celá tabuľka sú bloky; prázdny riadok blok ukončí", () => {
    const b = splitBlocks(manual)
    expect(b.map(x => x.kind)).toEqual([
      "heading", "paragraph", "heading", "paragraph", "heading", "item", "item", "heading", "paragraph", "table",
    ])
    expect(b.map(x => x.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(b[3].text).toBe("Podanie sa podáva cez ISSF.\nDruhý riadok toho istého odseku.")
    expect(b[6].text).toContain("pokračovanie položky")
    expect(b[9].text.split("\n")).toHaveLength(3)
    expect(b[4].level).toBe(3)
    expect(headingText(b[2])).toBe("1 Podania")
  })
  it("nadpis bez prázdneho riadku pred ním aj tak začne nový blok", () => {
    expect(splitBlocks("odsek\n## Nadpis\nďalší").map(x => x.kind)).toEqual(["paragraph", "heading", "paragraph"])
  })
})

describe("hranice", () => {
  it("normalizeBoundaries: bez 0, bez duplicít, v rozsahu, vzostupne", () => {
    expect(normalizeBoundaries([5, 0, 2, 2, 99, -1, "3", 2.4], 6)).toEqual([2, 3, 5])
    expect(normalizeBoundaries("nie", 6)).toEqual([])
  })
  it("groupBlocks rozdelí indexy podľa hraníc", () => {
    expect(groupBlocks(5, [2, 4])).toEqual([[0, 1], [2, 3], [4]])
    expect(groupBlocks(3, [])).toEqual([[0, 1, 2]])
  })
  it("boundaryDiff: pridané, zrušené, zhodné", () => {
    expect(boundaryDiff([2, 4, 7], [2, 5, 7])).toEqual({ added: [5], removed: [4], kept: [2, 7] })
  })
})

describe("cutByBoundaries", () => {
  it("úsek nesie nadpis, ktorým začína, inak posledný nadpis pred ním", () => {
    const chunks = cutByBoundaries(manual, [2, 5, 7])
    expect(chunks.map(c => c.articleRef)).toEqual(["Podania na komisie", "1 Podania", "1.1 Prílohy", "2 Lehoty"])
    // Úsek 3 začína položkou, nie nadpisom — pokračuje v 1.1 Prílohy.
    expect(chunks[2].uplnaJednotka).toBe(false)
    // Riadok kontextu (nadradené nadpisy), potom telo úseku.
    expect(chunks[2].text).toBe("Podania na komisie › 1 Podania › 1.1 Prílohy\n\n- PDF do 10 MB\n- JPG alebo PNG\n  pokračovanie položky")
    expect(chunks[3].obsahujeTabulku).toBe(true)
    expect(chunks[3].text).toContain("Lehoty sú v tabuľke:\n\n| Úkon | Lehota |")
    expect(chunks.map(c => c.chunkIndex)).toEqual([0, 1, 2, 3])
  })
  it("text bez nadpisu je preambula bez článku", () => {
    const [c] = cutByBoundaries("prvý odsek\n\ndruhý odsek", [])
    expect(c).toMatchObject({ articleRef: null, typ: "preambula", heading: "" })
  })
})

describe("boundariesFromChunks", () => {
  it("nájde hranice uložených úsekov v blokoch", () => {
    const blocks = splitBlocks(manual)
    const chunks = cutByBoundaries(manual, [2, 7])
    expect(boundariesFromChunks(blocks, chunks.map(c => c.text))).toEqual({ boundaries: [2, 7], approximate: false })
  })
  it("úsek, ktorý začína uprostred bloku, dá hranicu na tom bloku a príznak približnosti", () => {
    const blocks = splitBlocks(manual)
    const r = boundariesFromChunks(blocks, ["…", "Druhý riadok toho istého odseku."])
    expect(r).toEqual({ boundaries: [3], approximate: true })
  })
  it("uložený úsek s riadkom kontextu a zlúčeným telom nájde svoj nadpis", () => {
    const blocks = splitBlocks(manual)
    const stored = [
      "Podania na komisie › Úvod\n# Podania na komisie Tento manuál opisuje podania.",
      "Podania na komisie › 2 Lehoty\n## 2 Lehoty Lehoty sú v tabuľke: | Úkon | Lehota |",
    ]
    expect(boundariesFromChunks(blocks, stored)).toEqual({ boundaries: [7], approximate: false })
  })
  it("úsek začínajúci uprostred dlhého odseku so zlúčeným textom cez hranicu bloku sa nájde kratšou vzorkou", () => {
    const blocks = splitBlocks(manual)
    // Druhý úsek začína v odseku bloku 3 a pokračuje cez nadpis bloku 4 (zlúčené).
    const r = boundariesFromChunks(blocks, ["…", "Druhý riadok toho istého odseku. ### 1.1 Prílohy - PDF do 10 MB"])
    expect(r).toEqual({ boundaries: [3], approximate: true })
  })
  it("tokeny skupín", () => {
    const blocks = splitBlocks(manual)
    const t = groupTokens(blocks, [7])
    expect(t).toHaveLength(2)
    expect(t.every(n => n > 0)).toBe(true)
  })
})

describe("cutForIndex — voľba rezu (Q3 A)", () => {
  const cut = (boundaries: number[], text = manual): ChunkCut => ({ textHash: textFingerprint(text), boundaries, round: 1, at: new Date(), by: "Ján" })

  it("ručné hranice pre presne tento text majú prednosť pred profilom", () => {
    const r = cutForIndex(manual, "Manuál", [cut([7])])
    expect(r.manual?.boundaries).toEqual([7])
    expect(r.chunks).toHaveLength(2)
    expect(r.fingerprintProfile).toEqual({ rucne: [7] })
  })
  it("iný text (nové znenie) ručné hranice nepoužije — reže profil", () => {
    const r = cutForIndex(`${manual}\n\nNový odsek.`, "Manuál", [cut([7])])
    expect(r.manual).toBeNull()
  })
  it("najnovší rez k textu vyhráva; iný rez dá iný odtlačok členenia", () => {
    const a = cut([7]); const b = { ...cut([2, 7]), round: 2 }
    expect(manualCutFor([a, b], manual)?.round).toBe(2)
    const fa = cutForIndex(manual, "M", [a]); const fb = cutForIndex(manual, "M", [b])
    expect(chunkingFingerprint(fa.chunks, fa.fingerprintProfile)).not.toBe(chunkingFingerprint(fb.chunks, fb.fingerprintProfile))
  })
  it("bez ručných hraníc: text s nadpismi ide zo štruktúry (ADR-035)", () => {
    const r = cutForIndex(manual, "M", [])
    expect(r.manual).toBeNull()
    expect(r.method).toBe("headings")
    expect(r.fingerprintProfile).toMatchObject({ nadpisy: 2 })
  })
})

describe("návrh AI — čisté funkcie", () => {
  it("numberedBlocks: celý text s indexmi; priveľký sa oreže, nadpisy nie", () => {
    const blocks = splitBlocks(manual)
    const { text, trimmed } = numberedBlocks(blocks)
    expect(trimmed).toBe(false)
    expect(text.startsWith("[0] # Podania na komisie\n\n[1] Tento manuál")).toBe(true)
    const big = splitBlocks(`# Nadpis\n\n${"slovo ".repeat(40_000)}\n\n${"ďalšie ".repeat(10_000)}`)
    const r = numberedBlocks(big)
    expect(r.trimmed).toBe(true)
    expect(r.text.length).toBeLessThanOrEqual(TEXT_MAX_CHARS)
    expect(r.text).toContain("[0] # Nadpis")
    expect(r.text).toContain("[…]")
  })
  it("parseProposal skladá rez zo súčasného, pridaných a zrušených hraníc a očistí zdôvodnenia", () => {
    const meta = { no: 2, at: new Date(), by: "Ján", source: "ai" as const, model: "m", textHash: "h", note: "x" }
    const r = parseProposal({
      add: [7, 2, 2, 0, 99], remove: [4, 5],
      reasons: [{ block: 7, why: " nová téma " }, { block: 50, why: "mimo" }, { block: 2, why: "" }],
      summary: " Rozdelil som. ", issues: ["", "tabuľka"], confidence: "zle",
    }, 10, meta, [4, 8])
    // 4 zrušená, 8 ostáva (nespomenutá), 2 a 7 pridané; 5 nebola hranicou, 0 a 99 sú mimo.
    expect(r).toMatchObject({ boundaries: [2, 7, 8], reasons: [{ block: 7, why: "nová téma" }], summary: "Rozdelil som.", issues: ["tabuľka"], confidence: "medium", no: 2 })
  })
  it("parseProposal: prázdne zmeny = súčasný rez, nič sa nestratí vynechaním", () => {
    const meta = { no: 3, at: new Date(), by: "Ján", source: "ai" as const, model: "m", textHash: "h", note: null }
    const current = Array.from({ length: 171 }, (_, i) => i + 1)
    const r = parseProposal({ add: [], remove: [], reasons: [], summary: "Bez zmeny.", issues: [], confidence: "high" }, 200, meta, current)
    expect(r.boundaries).toEqual(current)
  })
  it("oversizedNewChunks: nový úsek nad strop áno, ponechaný z dnešného rezu nie", () => {
    const para = (n: number) => `${"slovo ".repeat(n)}`.trim()
    // Bloky: 0 nadpis, 1–3 po ~600 tokenov, 4 nadpis, 5 ~1 500 tokenov (dnes samostatný úsek).
    const md = ["# A", para(450), para(450), para(450), "# B", para(1150)].join("\n\n")
    const blocks = splitBlocks(md)
    const current = [2, 3, 4]
    expect(oversizedNewChunks(blocks, current, current)).toEqual([])
    const merged = oversizedNewChunks(blocks, current, [4])
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ start: 0, end: 4 })
    expect(merged[0].tokens).toBeGreaterThan(1350)
  })
  it("roundsFor: len kolá k tomuto textu, najnovšie hore", () => {
    const h = textFingerprint(manual)
    const r = (no: number, textHash: string) => ({ no, textHash }) as ChunkRound
    expect(roundsFor([r(1, h), r(2, "iný"), r(3, h)], manual).map(x => x.no)).toEqual([3, 1])
  })
})
