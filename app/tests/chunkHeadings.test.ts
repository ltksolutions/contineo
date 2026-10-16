/**
 * chunkHeadings.test.ts — prvý rez zo štruktúry Markdownu (ADR-035, D230).
 */
import { describe, it, expect } from "vitest"
import { headingBoundaries, hasStructure, CUT_MAX } from "../src/lib/chunkHeadings"
import { splitBlocks, pseudoHeadingLevel, cutByBoundaries, groupTokens, refFromHeading } from "../src/lib/chunkBlocks"

const para = (n: number) => `${"Slovo vety v odseku. ".repeat(n)}`.trim()

describe("nadpisy bez mriežok", () => {
  it("úroveň z číslovania, článku a časti; veta s bodkou nie je nadpis", () => {
    expect(pseudoHeadingLevel("**1. Podania**")).toBe(2)
    expect(pseudoHeadingLevel("**1.2 Spracovanie**")).toBe(3)
    expect(pseudoHeadingLevel("**1.2.3 Lehoty**")).toBe(4)
    expect(pseudoHeadingLevel("**Upozornenie**")).toBe(3)
    expect(pseudoHeadingLevel("Článok 5 – Pojmy")).toBe(3)
    expect(pseudoHeadingLevel("§ 12 Účinnosť")).toBe(3)
    expect(pseudoHeadingLevel("ČASŤ PRVÁ")).toBe(2)
    expect(pseudoHeadingLevel("**Toto je veta.**")).toBe(0)
    expect(pseudoHeadingLevel("Bežný odsek bez tučného písma")).toBe(0)
  })
  it("tučný nadpis hneď nad textom (prevod PDF) je samostatný blok", () => {
    const b = splitBlocks("**1.2 Spracovanie**\nTajomník sleduje podania.")
    expect(b.map(x => [x.kind, x.level])).toEqual([["heading", 3], ["paragraph", 0]])
  })
  it("citácia z nadpisu v tvare chunkera", () => {
    expect(refFromHeading("Článok 5 – Pojmy")).toBe("čl. 5")
    expect(refFromHeading("Čl. 12a Prechodné")).toBe("čl. 12a")
    expect(refFromHeading("§ 3 Rozsah")).toBe("§ 3")
    expect(refFromHeading("Príloha č. 2 – Sadzobník")).toBe("príloha č. 2")
    expect(refFromHeading("1.2 Spracovanie")).toBe("1.2 Spracovanie")
    // Tvar z databázy noriem: malé „čl." a dlhá pomlčka.
    expect(refFromHeading("čl. 5 — Predmet úpravy")).toBe("čl. 5")
    expect(refFromHeading("ČLÁNOK 13a – Prechodné")).toBe("čl. 13a")
    expect(refFromHeading("PRÍLOHA č. 2")).toBe("príloha č. 2")
    expect(refFromHeading("Príloha č. 1a – Vzor")).toBe("príloha č. 1a")
  })
})

describe("headingBoundaries", () => {
  it("text bez nadpisov nemá štruktúru — rez chunkerom", () => {
    expect(headingBoundaries(`${para(10)}\n\n${para(10)}`)).toBeNull()
    expect(hasStructure(splitBlocks("# Jeden nadpis\n\ntext"))).toBe(false)
  })

  it("krátky dokument s nadpismi je jeden úsek", () => {
    expect(headingBoundaries(`# Názov\n\n${para(5)}\n\n## A\n\n${para(5)}\n\n## B\n\n${para(5)}`)).toEqual([])
  })

  it("manuál: časti ## nad cieľ, veľká časť sa delí na ###, názov sa pripojí k prvej časti", () => {
    const text = [
      "# Podania na komisie", "Úvod manuálu.",
      "## 1. Podania", para(30),
      "### 1.1 Odkiaľ", para(120),
      "### 1.2 Spracovanie", para(120),
      "## 2. Centrálny register", para(120),
      "## Zdroje", "- odkaz jeden", "- odkaz dva",
    ].join("\n\n")
    const blocks = splitBlocks(text)
    const cuts = headingBoundaries(text)!
    const starts = cuts.map(b => blocks[b].text)
    expect(starts).toEqual(["### 1.1 Odkiaľ", "### 1.2 Spracovanie", "## 2. Centrálny register"])
    // Zdroje (malé) sa pripojili k časti 2, úvod a „## 1." k sebe navzájom.
    expect(groupTokens(blocks, cuts).every(t => t <= CUT_MAX)).toBe(true)
  })

  it("malá časť sa nepripojí k nasledujúcej vyššej úrovne", () => {
    const text = ["# Doc", "## A", para(130), "### A.1", para(10), "## B", para(130)].join("\n\n")
    const blocks = splitBlocks(text)
    const starts = headingBoundaries(text)!.map(b => blocks[b].text)
    expect(starts).toContain("## B")
  })

  it("dlhá časť bez podnadpisov sa delí medzi odsekmi, tabuľka ostáva pri vete s dvojbodkou", () => {
    const text = ["# Doc", "## A", para(150), para(150), "Lehoty sú v tabuľke:", "| a | b |\n|---|---|\n| 1 | 2 |", para(150), "## B", para(40)].join("\n\n")
    const blocks = splitBlocks(text)
    const cuts = headingBoundaries(text)!
    const table = blocks.findIndex(b => b.kind === "table")
    expect(cuts).not.toContain(table)
    expect(cuts.length).toBeGreaterThan(1)
  })

  it("úsek z rezu nesie kontext a citáciu článku", () => {
    const text = ["# Smernica", "## Článok 1 – Predmet", para(140), "## Článok 2 – Pojmy", para(140)].join("\n\n")
    const chunks = cutByBoundaries(text, headingBoundaries(text)!, "Finančná smernica")
    // Názov dokumentu stojí hneď nad článkom 1 — patrí k nemu, citácia je čl. 1.
    expect(chunks.map(c => c.articleRef)).toEqual(["čl. 1", "čl. 2"])
    const art2 = chunks.find(c => c.articleRef === "čl. 2")!
    expect(art2.text.startsWith("Finančná smernica › Smernica\n\n## Článok 2 – Pojmy")).toBe(true)
    expect(art2.typ).toBe("clanok")
  })

  it("norma: krátke články sa nezlučujú, časť sa pripojí k prvému článku (porovnanie 16. 10. 2026)", () => {
    const text = [
      "# Poriadok", "## PRVÁ ČASŤ", "### Článok 1 – Predmet", "(1) Krátky.",
      "### Článok 2 – Pojmy", "(1) Krátky.", "## DRUHÁ ČASŤ", "### Článok 3 – Konanie", "(1) Krátky.",
    ].join("\n\n")
    const chunks = cutByBoundaries(text, headingBoundaries(text)!, "Poriadok")
    expect(chunks.map(c => c.articleRef)).toEqual(["čl. 1", "čl. 2", "čl. 3"])
    expect(chunks[2].text).toContain("## DRUHÁ ČASŤ\n\n### Článok 3")
  })

  it("dlhý článok sa delí medzi odsekmi a citácia nesie odseky", () => {
    const ods = (n: number) => `(${n}) ${para(60)}`
    const text = ["# Poriadok", "## Článok 1 – Krátky", "(1) Text.", "## Článok 12 – Dlhý", ...[1, 2, 3, 4, 5, 6].map(ods), "## Článok 13 – Ďalší", "(1) Text."].join("\n\n")
    const refs = cutByBoundaries(text, headingBoundaries(text)!, "Poriadok").map(c => c.articleRef)
    expect(refs[0]).toBe("čl. 1")
    expect(refs.at(-1)).toBe("čl. 13")
    const parts = refs.filter(r => r?.startsWith("čl. 12"))
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every(r => /^čl\. 12 ods\. \d+(–\d+)?$/.test(r!))).toBe(true)
    expect(parts[0]).toMatch(/^čl\. 12 ods\. 1/)
  })

  it("úsek s nadpisom dokumentu a oddielom cituje oddiel, nie názov dokumentu", () => {
    const text = ["# Podania na komisie", "Úvod.", "## 1. Podania na komisie", "### 1.1 Odkiaľ", para(20), "## 2. Register", para(20)].join("\n\n")
    const chunks = cutByBoundaries(text, [5], "Podania")
    expect(chunks.map(c => c.articleRef)).toEqual(["1. Podania na komisie", "2. Register"])
  })
})
