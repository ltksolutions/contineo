/**
 * askScope.test.ts — výber zdrojov na `/ask` (ASK-zdroje-hladania, 23. 10. 2026).
 * Zmena výberu nič nespúšťa; adresa nesie `src` v oboch tvaroch; oznam
 * „Zdroje sa zmenili" menuje zdroje rovnako ako hlavička (Q3 — znenie z 8. 10.).
 */

import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { scopeFromQuery } from "../src/lib/askScope"
import { answerFrom, answerKicker, type KickerScope } from "../src/lib/answerKicker"
import { dictionary, type UiLanguage } from "../src/lib/i18n"
import Search from "../src/components/Search"

describe("rozsah z adresy", () => {
  const ids = ["c1"]
  it("čiarky (so skriptom) aj opakované src (formulár bez skriptu)", () => {
    expect(scopeFromQuery("library,c1", ids)).toEqual(["library", "c1"])
    expect(scopeFromQuery(["library", "c1"], ids)).toEqual(["library", "c1"])
    expect(scopeFromQuery(["library,c1", "c1"], ids)).toEqual(["library", "c1"])
  })
  it("neznáme id zahodí, prázdne = predvolené (prázdny zoznam)", () => {
    expect(scopeFromQuery("library,zmizol", ids)).toEqual(["library"])
    expect(scopeFromQuery(undefined, ids)).toEqual([])
    expect(scopeFromQuery("", ids)).toEqual([])
  })
})

describe("oznam o zmenených zdrojoch", () => {
  const scopes: KickerScope[] = [
    { library: true, live: [] },
    { library: true, live: ["Sportnet dokumentácia"] },
    { library: false, live: ["Sportnet dokumentácia"] },
    { library: false, live: ["A", "B"] },
  ]
  it.each(["sk", "cs", "en"] as UiLanguage[])("odkiaľ odpoveď je = hlavička bez slova „Odpoveď“ (%s)", lang => {
    const prefix = { sk: "Odpoveď ", cs: "Odpověď ", en: "Answer " }[lang]
    for (const sc of scopes) expect(prefix + answerFrom(sc, "SFZ", lang)).toBe(answerKicker(sc, "SFZ", lang))
  })
  it("len pri jedinom zdroji", () => {
    const t = dictionary("sk").ask
    expect(t.scopeChanged(answerFrom({ library: true, live: [] }, "SFZ", "sk"), true))
      .toBe("Zdroje sa zmenili. Odpoveď nižšie je len z dokumentov SFZ.")
  })
})

describe("Search: výber zdrojov", () => {
  const props = { preset: "Ako zapíšem striedanie?", organisation: "SFZ", language: "sk" as UiLanguage }
  it("plachta je GET formulár s checkboxmi src, bez prepínača pohľadu a bez oznamu", () => {
    const html = renderToString(createElement(Search, { ...props, liveSources: [{ id: "c1", name: "Sportnet dokumentácia" }] }))
    expect(html).toContain('<details class="ask-scope"')
    expect(html).toContain("Zdroje: Knižnica ▾")
    const form = html.match(/<form[^>]*>/)?.[0] ?? ""
    expect(form).toContain('method="get"')
    expect(form).toContain('action="/ask"')
    expect(html.match(/type="checkbox" name="src"/g)).toHaveLength(2)
    expect(html).toContain('name="q" value="Ako zapíšem striedanie?"')
    expect(html).not.toContain("view-switch")
    expect(html).not.toContain("Zdroje sa zmenili")
  })
  it("predvolený výber podľa „používať predvolene“ a z adresy", () => {
    const on = renderToString(createElement(Search, { ...props, liveSources: [{ id: "c1", name: "Sportnet", defaultOn: true }] }))
    expect(on).toContain("Zdroje: všetky ▾")
    const url = renderToString(createElement(Search, { ...props, liveSources: [{ id: "c1", name: "Sportnet" }], initialScope: ["c1"] }))
    expect(url).toContain("Zdroje: Sportnet ▾")
  })
  it("bez živého zdroja sa výber nekreslí", () => {
    expect(renderToString(createElement(Search, { ...props, liveSources: [] }))).not.toContain("ask-scope")
  })
})
