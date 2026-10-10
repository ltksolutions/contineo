/**
 * wordDiff.test.ts — porovnanie odpovede FAQ po slovach (fronta kuratora).
 */

import { describe, it, expect } from "vitest"
import { wordDiff, hasChanges } from "../src/lib/wordDiff"

describe("wordDiff", () => {
  it("zmena jedneho slova v odseku je jedno slovo, nie cely odsek", () => {
    const parts = wordDiff("Heslo musí mať 8 znakov a jedno veľké písmeno.", "Heslo musí mať 8 znakov a jedno číslo.")
    expect(parts.filter(p => p.kind === "removed").map(p => p.text.trim())).toEqual(["veľké písmeno."])
    expect(parts.filter(p => p.kind === "added").map(p => p.text.trim())).toEqual(["číslo."])
    expect(parts.map(p => (p.kind === "added" ? "" : p.text)).join("")).toBe("Heslo musí mať 8 znakov a jedno veľké písmeno.")
    expect(parts.map(p => (p.kind === "removed" ? "" : p.text)).join("")).toBe("Heslo musí mať 8 znakov a jedno číslo.")
  })
  it("rovnake texty nemaju zmeny, novy riadok sa zachova", () => {
    expect(hasChanges(wordDiff("a\nb", "a\nb"))).toBe(false)
    expect(wordDiff("a", "a\nb").map(p => p.text).join("")).toBe("a\nb")
  })
})
