/**
 * courseDraft.test.ts — úpravy konceptu kurzu (rám MANAGE-COURSE): kľúče
 * častí, poradie šípkami, pravidlá blokov už pri koncepte.
 */
import { describe, it, expect } from "vitest"
import { addBlock, addPart, moveBlock, movePart, partKeyFor, removeBlock, removePart, updateBlock, updatePart } from "../src/lib/courseDraft"
import type { Part } from "../src/lib/courses"

const text = (id: string) => ({ id, type: "text" as const, markdown: id })

describe("časti", () => {
  it("kľúč z názvu, jedinečný", () => {
    expect(partKeyFor("Úvod do bezpečnosti", [])).toBe("uvod-do-bezpecnosti")
    expect(partKeyFor("Úvod", [{ key: "uvod" }, { key: "uvod-2" }])).toBe("uvod-3")
  })
  it("pridať, posunúť, upraviť, odobrať", () => {
    let parts: Part[] = addPart([], "Úvod", true)
    parts = addPart(parts, "Záver", false)
    expect(parts.map(p => p.key)).toEqual(["uvod", "zaver"])
    expect(movePart(parts, "zaver", "up").map(p => p.key)).toEqual(["zaver", "uvod"])
    expect(movePart(parts, "uvod", "up")).toBe(parts)
    expect(updatePart(parts, "uvod", { title: "Začiatok", estimatedMinutes: 12.4, required: false })[0]).toMatchObject({ title: "Začiatok", estimatedMinutes: 12, required: false, key: "uvod" })
    expect(removePart(parts, "uvod").map(p => p.key)).toEqual(["zaver"])
    expect(() => addPart(parts, "  ", true)).toThrow()
    expect(() => removePart(parts, "nie")).toThrow()
  })
})

describe("bloky", () => {
  const parts: Part[] = [{ key: "a", title: "A", required: true, tests: [], blocks: [text("1"), text("2")] }]
  it("poradie a odobratie", () => {
    expect(moveBlock(parts, "a", "2", "up")[0].blocks.map(b => b.id)).toEqual(["2", "1"])
    expect(removeBlock(parts, "a", "1")[0].blocks.map(b => b.id)).toEqual(["2"])
  })
  it("obrázok bez popisu a prázdny text neprejdú", () => {
    expect(() => addBlock(parts, "a", { id: "i", type: "image", fileId: "f", alt: " " })).toThrow()
    expect(() => addBlock(parts, "a", { id: "t", type: "text", markdown: "" })).toThrow()
    expect(() => addBlock(parts, "a", { id: "g", type: "gallery", items: [] })).toThrow()
  })
  it("externé video nemá povinné dopozeranie ani pri pridaní, ani pri úprave", () => {
    const withExt = addBlock(parts, "a", { id: "x", type: "video", source: { kind: "external", provider: "youtube", url: "https://youtu.be/abcdefghijk" }, mustWatch: true })
    const b = withExt[0].blocks[2]
    expect(b.type === "video" && b.mustWatch).toBe(false)
    const again = updateBlock(withExt, "a", "x", x => (x.type === "video" ? { ...x, mustWatch: true } : x))
    const c = again[0].blocks[2]
    expect(c.type === "video" && c.mustWatch).toBe(false)
  })
})
