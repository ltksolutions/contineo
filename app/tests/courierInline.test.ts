import { describe, it, expect } from "vitest"
import { parseMarks, splitCourierInline } from "../src/lib/courierInline"
import { markdownToDoc, docToMarkdown } from "../src/lib/richText"
import { toBlocks } from "../src/lib/formatText"
import { previewOf } from "../src/lib/courier"

describe("kurzíva, podčiarknuté, prečiarknuté v Kuriéri", () => {
  it("rozklad aj vnorené značky", () => {
    expect(parseMarks("a _b_ c")).toEqual([{ text: "a ", marks: [] }, { text: "b", marks: ["italic"] }, { text: " c", marks: [] }])
    expect(parseMarks("~~x~~ a ++y++")).toEqual([{ text: "x", marks: ["strike"] }, { text: " a ", marks: [] }, { text: "y", marks: ["underline"] }])
    expect(parseMarks("++_z_++")).toEqual([{ text: "z", marks: ["underline", "italic"] }])
  })

  it("snake_case a adresy ostanú bez kurzívy", () => {
    expect(parseMarks("pole draft_meta_x a súbor a_b_c.pdf")).toEqual([{ text: "pole draft_meta_x a súbor a_b_c.pdf", marks: [] }])
  })

  it("odkaz von sa nerozbije podčiarkovníkmi v adrese", () => {
    const parts = splitCourierInline("[čl](https://x.sk/a_b_c) _ok_")
    expect(parts[0]).toMatchObject({ text: "čl", href: "https://x.sk/a_b_c" })
    expect(parts.at(-1)).toEqual({ text: "ok", marks: ["italic"] })
  })

  it("editor: všetky značky aj tučné prežijú cestu tam a späť", () => {
    const md = "**Tučné** _kurzíva_ ++podčiarknuté++ ~~prečiarknuté~~ **_obe_** a 😊"
    expect(docToMarkdown(markdownToDoc(md))).toBe(md)
  })

  it("spoločný rozklad (asistent, predpisy) sa nemení — značky ostanú textom", () => {
    expect(toBlocks("a _b_ ++c++ ~~d~~")[0]).toEqual({ druh: "odsek", segments: [{ druh: "text", text: "a _b_ ++c++ ~~d~~" }] })
  })

  it("náhľad v zozname vlákien je bez značiek", () => {
    expect(previewOf("Ahoj _všetci_, ++dôležité++ a ~~staré~~")).toBe("Ahoj všetci, dôležité a staré")
  })
})
