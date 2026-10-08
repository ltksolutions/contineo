/**
 * connectorImport.test.ts — import z MCP konektora (ADR-029, použitie B).
 *
 * Bez databázy a servera: rozklad Markdownu na bloky pre PDF, odtlačok
 * textu (re-sync vie o zmene len z neho) a to, že ten istý text dá ten istý
 * PDF — odtlačok znenia (`versionId`) musí sedieť medzi behmi.
 */

import { describe, it, expect } from "vitest"
import { parseBlocks, plainInline, renderMarkdownPdf } from "../src/lib/markdownPdf"
import { contentHash } from "../src/lib/connectorImport"

describe("markdown → bloky", () => {
  it("nadpisy, odseky, odrážky, číslované body, kód a tabuľka ako text", () => {
    const md = "# T\n\nOdsek **tučný** a `kód`.\n\n## A\n\n- jedna\n- dva\n  - vnorená\n\n1. prvý\n2) druhý\n\n```\nx = 1\n```\n\n| a | b |\n|---|---|\n"
    const b = parseBlocks(md)
    expect(b[0]).toEqual({ kind: "heading", level: 1, text: "T" })
    expect(b[1]).toEqual({ kind: "paragraph", text: "Odsek tučný a kód." })
    expect(b[2]).toEqual({ kind: "heading", level: 2, text: "A" })
    expect(b[3]).toMatchObject({ kind: "item", text: "jedna", marker: "•", indent: 0 })
    expect(b[5]).toMatchObject({ kind: "item", text: "vnorená", indent: 1 })
    expect(b[6]).toMatchObject({ kind: "item", text: "prvý", marker: "1." })
    expect(b[7]).toMatchObject({ kind: "item", text: "druhý", marker: "2." })
    expect(b[8]).toEqual({ kind: "code", lines: ["x = 1"] })
    expect(b[9]).toMatchObject({ kind: "paragraph", text: "a · b" })
  })

  it("inline znacky sa odstrania, odkaz ostane ako text", () => {
    expect(plainInline("[Sportnet](https://x) a __b__ a *c*")).toBe("Sportnet a b a c")
  })
})

describe("odtlacok a PDF", () => {
  it("hash je deterministicky a citlivy na zmenu", () => {
    expect(contentHash("a")).toBe(contentHash("a"))
    expect(contentHash("a")).not.toBe(contentHash("a "))
  })

  it("ten isty text da ten isty PDF", async () => {
    const input = { title: "Users, roles & passwords", markdown: "## How it works\n\n1. Account creation.\n\n- rule\n", texts: { page: (n: number, t: number) => `${n}/${t}`, origin: "Zdroj: Sportnet · x.md" } }
    const [a, b] = await Promise.all([renderMarkdownPdf(input), renderMarkdownPdf(input)])
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
    expect(Buffer.from(a).subarray(0, 5).toString()).toBe("%PDF-")
  })
})
