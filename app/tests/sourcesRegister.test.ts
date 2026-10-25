/**
 * sourcesRegister.test.ts — register zdrojov (ADR-040, D266): živé zdroje
 * pre výber na Opýtať sa vznikajú z registra tým istým pravidlom ako
 * doteraz z konektorov — zapnutý, pripojený, dovolený, vie hľadať, úroveň.
 */

import { describe, it, expect } from "vitest"
import { liveSourcesFor, type RegisteredSource } from "../src/lib/sourcesRegister"
import { ORG_SECTIONS } from "../src/lib/orgSections"

const base: RegisteredSource = {
  id: "c1", kind: "mcp", adapter: null, name: "Sportnet", enabled: true, connected: true, allowed: true, defaultOn: false,
  accessLevel: "internal", uses: { retrieval: true, import: true, tools: false }, href: "/organisation/sources/connectors/c1", detail: "api.sportnet.online",
}
const library: RegisteredSource = { ...base, id: "library", kind: "file", name: "Knižnica", accessLevel: "internal", uses: { retrieval: true, import: true, tools: false } }
const mailbox: RegisteredSource = { ...base, id: "mailbox:podpora", kind: "mailbox", adapter: "graph", name: "Podpora", accessLevel: "public", uses: { retrieval: false, import: true, tools: false }, href: "/channels/podpora", detail: "podpora@futbalsfz.sk" }
const law: RegisteredSource = { ...base, id: "slov-lex", kind: "web", adapter: "slov-lex", name: "Legislatíva", accessLevel: "public", defaultOn: true, uses: { retrieval: true, import: false, tools: false } }

describe("živé zdroje z registra", () => {
  it("knižnica ani schránka nie sú živý zdroj; konektor a legislatíva áno, s predvoľbou", () => {
    expect(liveSourcesFor([library, mailbox, base, law], "internal")).toEqual([
      { id: "c1", name: "Sportnet", defaultOn: false },
      { id: "slov-lex", name: "Legislatíva", defaultOn: true },
    ])
  })
  it("verejný pýtajúci sa nevidí interný konektor, zákon áno", () => {
    expect(liveSourcesFor([library, base, law], "public").map(s => s.id)).toEqual(["slov-lex"])
  })
  it("vypnutý, nepripojený, blokovaný alebo bez hľadania sa neponúka", () => {
    expect(liveSourcesFor([{ ...base, enabled: false }], "internal")).toEqual([])
    expect(liveSourcesFor([{ ...base, connected: false }], "internal")).toEqual([])
    expect(liveSourcesFor([{ ...law, allowed: false }], "internal")).toEqual([])
    expect(liveSourcesFor([{ ...base, uses: { retrieval: false, import: true, tools: true } }], "internal")).toEqual([])
  })
})

describe("sekcia Zdroje", () => {
  it("je medzi časťami organizácie za Umelou inteligenciou; Konektory už nie sú časť, ale jej podstránka (D263, D267 krok 2)", () => {
    expect(ORG_SECTIONS.indexOf("sources")).toBeGreaterThan(ORG_SECTIONS.indexOf("ai"))
    expect(ORG_SECTIONS).not.toContain("connectors")
  })
})
