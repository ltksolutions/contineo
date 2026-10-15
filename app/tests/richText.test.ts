import { describe, it, expect } from "vitest"
import { markdownToDoc, docToMarkdown, isInternalHref } from "../src/lib/richText"
import { toBlocks } from "../src/lib/formatText"

const round = (md: string) => docToMarkdown(markdownToDoc(md))

describe("richText — Markdown správy ↔ editor (D208)", () => {
  it("odsek, nadpis, odrážky, číslovanie, tučné a vnútorný odkaz prežijú cestu tam a späť", () => {
    const md = [
      "## Pozvánka",
      "Ahoj, **dôležité** je toto: [Registračný poriadok](/documents/sfz%3Arapp).",
      "- prvé\n- druhé",
      "1. krok\n2. krok",
    ].join("\n\n")
    expect(round(md)).toBe(md)
    // To, čo editor zapíše, vykreslí `formatText` rovnako ako pôvodný text.
    expect(toBlocks(round(md))).toEqual(toBlocks(md))
  })

  it("odkaz von editor nezapíše ako odkaz — ostane len text", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "klik", marks: [{ type: "link", attrs: { href: "https://zly.web" } }] },
    ] }] }
    expect(docToMarkdown(doc)).toBe("klik")
  })

  it("tučné s medzerou na okraji drží medzeru mimo hviezdičiek", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "a" }, { type: "text", text: " b ", marks: [{ type: "bold" }] }, { type: "text", text: "c" },
    ] }] }
    expect(docToMarkdown(doc)).toBe("a **b** c")
  })

  it("prázdny text je jeden prázdny odsek a späť prázdny reťazec", () => {
    expect(markdownToDoc("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] })
    expect(docToMarkdown(markdownToDoc(""))).toBe("")
  })

  it("vnútorná cesta áno, von nie", () => {
    expect(isInternalHref("/documents/x")).toBe(true)
    expect(isInternalHref("//cudzi.web")).toBe(false)
    expect(isInternalHref("https://x.sk")).toBe(false)
    expect(isInternalHref("javascript:alert(1)")).toBe(false)
  })
})
