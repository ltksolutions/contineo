/**
 * ratingPanel.test.ts — panel posudku (EVAL-posudok, 8. 10. 2026): áno/nie
 * ako `.seg` s natívnymi rádiami, vo fronte sekcia bez karty v karte,
 * čitateľ s tichými tlačidlami.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Rating from "../src/components/Rating"

describe("Rating — EVAL-posudok", () => {
  it("hodnotiteľ: dve otázky ako radiogroup s natívnymi rádiami, doplnenie v details", () => {
    const html = renderToStaticMarkup(createElement(Rating, { recordId: "r1", canEvaluate: true }))
    expect(html).toContain('<div class="card rating">')
    expect(html.match(/role="radiogroup"/g)).toHaveLength(2)
    expect(html.match(/<input type="radio" name="correct-r1"/g)).toHaveLength(2)
    expect(html.match(/<input type="radio" name="hallucination-r1"/g)).toHaveLength(2)
    expect(html).toContain('aria-labelledby="rq-correct-r1"')
    // Pred voľbou žiadna farba — tá patrí až zvolenému segmentu.
    expect(html).not.toMatch(/seg-opt is-(ok|bad)/)
    expect(html).toContain('<details class="rating-more">')
    expect(html).toContain('class="field-input"')
    expect(html).not.toContain("style=")
  })

  it("vo fronte je posudok sekcia karty položky, nie ďalšia karta", () => {
    const html = renderToStaticMarkup(createElement(Rating, { recordId: "r1", canEvaluate: true, as: "section" }))
    expect(html.startsWith('<section class="rating">')).toBe(true)
    expect(html).not.toContain("card")
  })

  it("čitateľ: Sedí / Nesedí ako tiché tlačidlá", () => {
    const html = renderToStaticMarkup(createElement(Rating, { recordId: "r1" }))
    expect(html.match(/class="button button--quiet button--sm"/g)).toHaveLength(2)
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toContain("style=")
  })
})
