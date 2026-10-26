/**
 * rangeField.test.ts — posuvník `.field-range` (design system, 25. 10. 2026).
 *
 * Vykreslenie na serveri = stav bez JavaScriptu: natívny posuvník s menom,
 * rozsahom a uloženou hodnotou, ktorý sa odošle vo formulári; číslo vedľa
 * popisu ukazuje uloženú hodnotu.
 */

import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import RangeField from "../src/components/RangeField"

describe("RangeField bez JavaScriptu", () => {
  const html = renderToStaticMarkup(createElement(RangeField, {
    name: "capDocuments", label: "Knižnica a konektory", hint: "Predvolene 8.", min: 3, max: 15, defaultValue: 8,
  }))

  it("natívny posuvník s menom, rozsahom a uloženou hodnotou", () => {
    expect(html).toMatch(/<input[^>]*type="range"/)
    expect(html).toMatch(/name="capDocuments"/)
    expect(html).toMatch(/min="3"/)
    expect(html).toMatch(/max="15"/)
    expect(html).toMatch(/value="8"/)
    expect(html).toContain('class="field-range-input"')
  })
  it("popis je naviazaný na posuvník a hodnota je vidieť", () => {
    expect(html).toMatch(/<label class="field-label" for="range-capDocuments">Knižnica a konektory<\/label>/)
    expect(html).toMatch(/<output[^>]*class="field-range-value"[^>]*>8<\/output>/)
  })
  it("krajné hodnoty a nápoveda", () => {
    expect(html).toMatch(/field-range-scale[^>]*><span>3<\/span><span>15<\/span>/)
    expect(html).toContain("Predvolene 8.")
  })
})
