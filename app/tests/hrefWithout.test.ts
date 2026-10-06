/**
 * hrefWithout.test.ts — kam vedie potvrdenie oznamu (`Notice`):
 * tá istá adresa bez správy, vyplnené hodnoty z adresy ostanú
 * (DESIGN_ODCHYLKY P2, 6. 10. 2026).
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { hrefWithout } from "../src/lib/urlParams"
import Notice from "../src/components/Notice"

describe("hrefWithout", () => {
  it("vynechá správu, opakované hodnoty ponechá", () => {
    expect(hrefWithout("/hr/assign", { error: "Chýba dôvod", document: ["d1", "d2"], reason: "novela" }, ["error"]))
      .toBe("/hr/assign?document=d1&document=d2&reason=novela")
  })
  it("bez ďalších kľúčov holá cesta", () => {
    expect(hrefWithout("/admin/new", { msg: "x", error: "1" }, ["msg", "error"])).toBe("/admin/new")
  })
})

describe("Notice", () => {
  it("potvrdenie v jazyku prostredia", () => {
    const en = renderToStaticMarkup(createElement(Notice, { message: "Saved.", back: "/x", language: "en" }))
    expect(en).toContain(">OK</a>")
    const sk = renderToStaticMarkup(createElement(Notice, { message: "Uložené.", back: "/x", language: "sk" }))
    expect(sk).toContain(">Rozumiem</a>")
  })
})
