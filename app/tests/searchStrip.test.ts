/**
 * searchStrip.test.ts — pás hľadania v zozname (knižnica, adresár, osoby).
 *
 * Stráži tvar z `ZAKLAD.html` / `KNIZNICA.html`: lupa je **vnútri** rámika
 * spolu s poľom, nie samostatne pred ním — tak to bolo implementované
 * do 29. 9. 2026 na všetkých troch obrazovkách.
 */
import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import SearchStrip from "../src/components/SearchStrip"

const render = (over: Partial<Parameters<typeof SearchStrip>[0]> = {}) =>
  renderToStaticMarkup(createElement(SearchStrip, {
    name: "search", placeholder: "Hľadať v názve, čísle alebo kľúči…", label: "Hľadať", ...over,
  }))

describe("pás hľadania", () => {
  it("lupa a pole sú v jednom rámiku, lupa pred poľom a pre čítačku skrytá", () => {
    const html = render({ defaultValue: "poriadok" })
    expect(html).toMatch(/^<div class="search-strip"><span class="search-strip-icon" aria-hidden="true"><svg[^]*<\/svg><\/span><input type="search" class="search-strip-input" name="search"/)
    expect(html).toContain('aria-label="Hľadať"')
    expect(html).toContain('value="poriadok"')
  })

  it("tlačidlo na odoslanie len pre čítačku, a len keď je", () => {
    expect(render({ submitLabel: "Filtrovať" })).toContain('<button type="submit" class="sr-only">Filtrovať</button>')
    expect(render()).not.toContain("<button")
  })
})
