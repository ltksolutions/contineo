/**
 * widgetSources.test.ts — výber zdrojov vo widgete kanála (KANAL-widget-zdroje,
 * 23. 10. 2026) a tokeny design systému prenesené do Shadow DOM.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { pickWidgetSources, searchedScopeOf } from "../src/lib/widgetSources"
import { WIDGET_TOKENS, widgetScript } from "../src/lib/widgetScript"

const allowed = [{ id: "library", name: "Knižnica" }, { id: "c1", name: "Sportnet dokumentácia" }]

describe("výber z widgetu", () => {
  it("len podmnožina povolených", () => {
    expect(pickWidgetSources(["c1"], allowed).map(s => s.id)).toEqual(["c1"])
    expect(pickWidgetSources(["library", "cudzi"], allowed).map(s => s.id)).toEqual(["library"])
  })
  it("prázdny, neznámy alebo chýbajúci výber = všetky povolené (Q3, starý skript)", () => {
    expect(pickWidgetSources([], allowed)).toEqual(allowed)
    expect(pickWidgetSources(["cudzi"], allowed)).toEqual(allowed)
    expect(pickWidgetSources(undefined, allowed)).toEqual(allowed)
    expect(pickWidgetSources("library", allowed)).toEqual(allowed)
  })
  it("v čom sa hľadalo: knižnica a názvy živých zdrojov", () => {
    expect(searchedScopeOf(allowed)).toEqual({ library: true, live: ["Sportnet dokumentácia"] })
    expect(searchedScopeOf([allowed[1]])).toEqual({ library: false, live: ["Sportnet dokumentácia"] })
  })
})

describe("tokeny widgetu = :root v globals.css", () => {
  const css = readFileSync("src/app/globals.css", "utf8")
  // Svetlé hodnoty: všetko pred blokom tmavej témy (`:root` má v komentároch aj `}`).
  const root = css.slice(css.indexOf(":root {"), css.indexOf('html[data-theme="dark"]'))
  it.each(Object.entries(WIDGET_TOKENS))("%s", (name, value) => {
    const m = root.match(new RegExp(`\\n\\s*${name.replace(/[-]/g, "\\-")}:\\s*([^;]+);`))
    expect(m?.[1].trim()).toBe(value)
  })
  it("skript nesie tokeny a zdroje kanála", () => {
    const js = widgetScript({ apiBase: "https://x", channel: "k", accent: "#1450DF", texts: {}, language: "sk", contact: null,
      sources: [{ id: "library", name: "Knižnica", sub: "Predpisy a dokumenty SFZ" }] })
    expect(js).toContain("--surface-2:#eceef1")
    expect(js).toContain('"sources":[{"id":"library"')
    expect(js).not.toContain("'btn'")
  })
})
