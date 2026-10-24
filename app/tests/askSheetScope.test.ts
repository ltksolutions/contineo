/**
 * askSheetScope.test.ts — výber zdrojov v plachte otázky (ASK-zdroje-v-plachte,
 * 23. 10. 2026): ešte pred prvou odpoveďou, v tom istom GET formulári.
 */

import { describe, it, expect, vi } from "vitest"
import { createElement } from "react"
import { renderToString } from "react-dom/server"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }))

import AskSheet from "../src/components/AskSheet"
import { defaultScope } from "../src/lib/askScope"

const live = [{ id: "c1", name: "Sportnet dokumentácia", defaultOn: false }]

describe("plachta otázky so zdrojmi", () => {
  it("tlačidlo v lište, riadky src v tom istom GET formulári, veta podľa výberu", () => {
    const html = renderToString(createElement(AskSheet, { mode: "inline", organisation: "SFZ", language: "sk", live }))
    expect(html).toContain('class="ask-scope ask-sheet-scope"')
    expect(html).toContain("Zdroje: Knižnica ▾")
    expect(html.match(/type="checkbox" name="src"/g)).toHaveLength(2)
    expect(html).toContain("Odpoveď sa skladá len z dokumentov SFZ.")
  })
  it("výber z obrazovky odpovede („Upraviť otázku“)", () => {
    const html = renderToString(createElement(AskSheet, { mode: "inline", organisation: "SFZ", language: "sk", live, initialSources: ["library", "c1"] }))
    expect(html).toContain("Zdroje: Knižnica, Sportnet dokumentácia ▾")
    expect(html).toContain("Odpoveď sa skladá len z dokumentov SFZ a zo zdroja Sportnet dokumentácia.")
  })
  it("bez živého zdroja nič navyše, veta ako dnes", () => {
    const html = renderToString(createElement(AskSheet, { mode: "inline", organisation: "SFZ", language: "sk", live: [] }))
    expect(html).not.toContain("ask-sheet-scope")
    expect(html).not.toContain('name="src"')
    expect(html).toContain("Odpoveď sa skladá len z dokumentov SFZ.")
  })
  it("predvolený výber: Knižnica a „používať predvolene“", () => {
    expect(defaultScope([{ id: "c1", defaultOn: true }, { id: "c2", defaultOn: false }])).toEqual(["library", "c1"])
  })
})
